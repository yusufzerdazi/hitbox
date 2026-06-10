import Game from "../../game";
import GameMode from "../../game/gameMode";
import Player from "../../players/player";
import Constants from "../../constants";
import { HeadlessRoom } from "./headlessRoom";

// Each tick in the live game is ~16.7ms (60Hz). Wall-clock-based respawn
// delays in the mode classes use setTimeout, which would either pause the
// trainer (waiting for the event loop) or fire at arbitrary times relative
// to the next tick. To keep training deterministic and infinitely fast, we
// schedule respawns in tick-space and drain them each frame.
const TICK_MS = 1000 / 60;

interface PendingAction {
    tickAt: number;
    action: () => void;
}

// Wraps a Game so a trainer can run it synchronously, with no wall-clock
// dependence and no PlayFab calls.
export class HeadlessGame {
    room: HeadlessRoom;
    game: Game;
    private pending: PendingAction[] = [];
    private ticks = 0;
    // Set whenever endCondition returns end=true. Trainer reads this to
    // tally rewards and tear the game down — we *don't* auto-restart like
    // the real Game.endGameLogic would.
    finished = false;
    winner: Player | null = null;
    endStatus: any = null;

    constructor(room: HeadlessRoom) {
        this.room = room;
        this.game = new Game();
    }

    setMode(ModeClass: typeof GameMode, mapName?: string): GameMode {
        // Restrict to the requested mode so endGameLogic — if it ever fired
        // — would pick the same one again.
        this.game.gameModes = [ModeClass as any];
        if (mapName) this.room.state.map = mapName;
        const gm = new (ModeClass as any)(this.room);
        this.game.gameMode = gm;
        this.patchModeForHeadless(gm);
        return gm;
    }

    // Replace setTimeout-based respawn callbacks with tick-queue versions
    // and skip the async ranking step. Mode-specific patches go here because
    // each mode has its own onPlayerDeath implementation.
    private patchModeForHeadless(mode: GameMode) {
        const room = this.room;
        const queue = this.pending;
        const tickAdd = (delayMs: number, fn: () => void) => {
            queue.push({ tickAt: this.ticks + Math.max(1, Math.round(delayMs / TICK_MS)), action: fn });
        };

        const modeName = mode.title;
        const teamBased = mode.teamBased;
        // Football, CTF, Tag, CollectTheBoxes all use a 1000ms delay before
        // respawning a player; the ball/flag respawn instantly.
        if (modeName === "Football") {
            mode.onPlayerDeath = (player: Player) => {
                const players = Array.from(room.state.players.values());
                if (player.type === "ball") {
                    player.respawn(players, room.state.level, teamBased);
                    return;
                }
                tickAdd(1000, () => {
                    if (!this.finished) player.respawn(players, room.state.level, teamBased);
                });
            };
        } else if (modeName === "Capture The Flag") {
            const finishedRef = () => this.finished;
            const origDeath = mode.onPlayerDeath.bind(mode);
            mode.onPlayerDeath = (player: Player) => {
                const players = Array.from(room.state.players.values());
                const delay = player.type === "flag" ? 0 : 1000;
                tickAdd(delay, () => {
                    if (!finishedRef()) player.respawn(players, room.state.level, teamBased);
                });
            };
        } else if (modeName === "Tag") {
            mode.onPlayerDeath = (player: Player) => {
                let stillHasStar = false;
                const players = Array.from(room.state.players.values());
                if (player.it && players.length > 1) {
                    player.it = false;
                    const possible = players.filter((p) => p.clientId != player.clientId);
                    if (possible.length) possible[Math.floor(Math.random() * possible.length)].it = true;
                } else if (player.it) {
                    stillHasStar = true;
                }
                tickAdd(1000, () => {
                    if (!this.finished) {
                        stillHasStar = stillHasStar || player.it;
                        player.respawn(players, room.state.level);
                        player.it = stillHasStar;
                    }
                });
            };
        } else if (modeName === "Collect the Boxes") {
            mode.onPlayerDeath = (player: Player) => {
                const players = Array.from(room.state.players.values());
                const playerLives = player.lives;
                tickAdd(1000, () => {
                    if (!this.finished) {
                        player.respawn(players, room.state.level);
                        player.lives = playerLives;
                    }
                });
            };
        }
    }

    // Single tick. Runs physics + game logic + handles end condition. Returns
    // the events emitted this tick (cleared from the room each call).
    step(): { type: string; payload: any }[] {
        if (this.finished) return [];
        this.ticks++;
        this.room.state.serverTime += TICK_MS;
        // Drain any pending tick-scheduled actions whose time has come.
        for (let i = this.pending.length - 1; i >= 0; i--) {
            const item = this.pending[i];
            if (item.tickAt <= this.ticks) {
                item.action();
                this.pending.splice(i, 1);
            }
        }
        const gm = this.game.gameMode;
        gm.onTick();
        // Replicate the same calculations Game.runGameLogic does, but
        // synchronously and without async ranking.
        const players = Array.from(this.room.state.players.values());
        this.room.state.runningPlayers = players
            .filter((p) => !p.attachedToPlayer)
            .reduce(
                (acc, cur) => acc + +(cur.type != "ball" && cur.onSurface && cur.xVelocity != 0),
                0
            );

        // The real Game owns a Physics instance; piggyback on it so we exercise
        // exactly the same code path as production.
        const messages = (this.game as any).physics.calculate(players, this.room.state.level, gm);
        messages.forEach((m: any[]) => this.room.broadcast(m[0], m[1]));

        // AI move (NeuralAi included): same signature as production.
        const allPlayers = Array.from(this.room.state.players.values());
        allPlayers.filter((p) => p.ai).forEach((p) =>
            p.move(
                allPlayers.filter((pl) => pl.clientId != p.clientId),
                this.room.state.serverTime,
                this.room.state.level
            )
        );

        // Mark deaths.
        allPlayers.filter((p) => p.alive && p.health == 0).forEach((p) => {
            p.alive = false;
            gm.onPlayerDeath(p, allPlayers, this.room.state.level);
        });

        const status = gm.endCondition();
        if (status && status.end) {
            this.finished = true;
            this.winner = status.winner || null;
            this.endStatus = status;
        }
        return this.room.consumeEvents();
    }

    // Run until finished or max ticks reached. Returns the final tick count.
    runUntilEnd(maxTicks: number, onEvent?: (e: { type: string; payload: any }) => void): number {
        while (!this.finished && this.ticks < maxTicks) {
            const events = this.step();
            if (onEvent && events.length) for (const e of events) onEvent(e);
        }
        return this.ticks;
    }
}
