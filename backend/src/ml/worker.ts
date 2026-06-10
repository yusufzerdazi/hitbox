import { parentPort, workerData } from "worker_threads";

import BattleRoyale from "../game/battleRoyale";
import Tag from "../game/tag";
import CollectTheBoxes from "../game/collectTheBoxes";
import DeathWall from "../game/deathWall";
import Football from "../game/football";
import CaptureTheFlag from "../game/captureTheFlag";
import Spleef from "../game/spleef";
import GameMode from "../game/gameMode";

import Utils from "../utils";
import Constants from "../constants";

import { Brain, BrainJSON } from "./agents/network";
import NeuralAi from "./agents/neuralPlayer";
import SimpleAi from "../players/simpleAi";
import CleverAi from "../players/cleverAi";
import RunningAi from "../players/runningAi";
import Player from "../players/player";
import { HeadlessRoom } from "./sim/headlessRoom";
import { HeadlessGame } from "./sim/headlessGame";
import { FITNESS_TRACKERS } from "./train/fitness";
import { MatchSlot } from "./workerPool";

// Mirrors trainer.ts MODE_CLASSES — duplicated rather than imported because
// importing the trainer from a worker would also boot its EventEmitter
// machinery, websocket types, etc., bloating each worker boot.
const MODE_CLASSES: Record<string, typeof GameMode> = {
    "Battle Royale": BattleRoyale as any,
    Spleef: Spleef as any,
    Tag: Tag as any,
    "Collect the Boxes": CollectTheBoxes as any,
    "Death Wall": DeathWall as any,
    Football: Football as any,
    "Capture The Flag": CaptureTheFlag as any,
};

const MAX_TICKS: Record<string, number> = {
    "Battle Royale": 3600,
    Spleef: 3600,
    Tag: 3600,
    "Collect the Boxes": 3600,
    "Death Wall": 4800,
    Football: 5400,
    "Capture The Flag": 5400,
};

const PALETTE = [
    "#ff3864", "#22d3ee", "#a3e635", "#facc15", "#c084fc", "#fb923c", "#34d399", "#f472b6",
];

// Incoming job message — main thread sends one of these per match.
interface JobMessage {
    type: "job";
    jobId: number;
    mode: string;
    slots: MatchSlot[];
    recordSnapshot: boolean;
    generation: number;
}

interface ShutdownMessage {
    type: "shutdown";
}

type IncomingMessage = JobMessage | ShutdownMessage;

function makeSlotPlayer(slot: MatchSlot, mode: string, i: number, teamBased: boolean): { player: Player; name: string } {
    const colour = PALETTE[i % PALETTE.length];
    const name = `agent_${slot.populationIndex}_${i}_${Math.floor(Math.random() * 9999)}`;
    let player: Player;
    switch (slot.kind) {
        case "brain": {
            if (!slot.brain) throw new Error("brain slot missing brain JSON");
            player = new NeuralAi(colour, name, Brain.fromJSON(slot.brain), mode);
            break;
        }
        case "simple":
            player = new SimpleAi(colour, name);
            break;
        case "clever":
            player = new CleverAi(colour, name);
            break;
        case "running":
            player = new RunningAi(colour, name);
            break;
    }
    (player as any).clientId = Utils.uuidv4();
    if (teamBased) {
        player.team = slot.team || (i % 2 === 0 ? Constants.TEAM1 : Constants.TEAM2);
    }
    return { player, name };
}

function runMatch(msg: JobMessage) {
    const { mode, slots, recordSnapshot } = msg;
    const ModeClass = MODE_CLASSES[mode];
    if (!ModeClass) throw new Error(`Unknown mode ${mode}`);
    const room = new HeadlessRoom();
    const teamBased = mode === "Football" || mode === "Capture The Flag";

    // Seed the room with one player per slot. Heuristic slots use the same
    // Player subclasses the live game would use; brain slots wrap the
    // supplied weights in a NeuralAi. Slot.populationIndex tells the
    // fitness aggregator below whether to record this slot's score.
    const slotByName: Record<string, MatchSlot> = {};
    slots.forEach((slot, i) => {
        const { player, name } = makeSlotPlayer(slot, mode, i, teamBased);
        room.state.players.set((player as any).clientId, player);
        slotByName[name] = slot;
    });

    const hg = new HeadlessGame(room);
    hg.setMode(ModeClass);

    const players = Array.from(room.state.players.values());
    players.forEach((p) => {
        if (!p.type) p.respawn(players, room.state.level, teamBased);
    });
    // Player.reset() — invoked by respawn() — clears mode-specific player
    // flags (notably `it` for Tag). Re-run onGameStart so the mode can
    // restore those flags (Tag.choosePlayerIt, etc.) on the freshly
    // positioned players. The base GameMode.onGameStart broadcasts a
    // "newGame" event with raw Player objects — those hold a non-cloneable
    // reference to the NeuralAi.observe function and would break the
    // structured clone of any later snapshot, so we drain the events queue
    // immediately afterwards.
    (hg.game.gameMode as any).onGameStart?.();
    room.consumeEvents();

    const tracker = FITNESS_TRACKERS[mode]();
    const snapshot = recordSnapshot
        ? {
              mode,
              map: room.state.level?.name || "",
              level: {
                  platforms: room.state.level.platforms.map((p) => ({
                      x: p.leftX(),
                      y: p.topY(),
                      width: p.width,
                      height: p.height,
                      type: (p as any).type,
                      colour: (p as any).colour,
                      durability: (p as any).durability,
                  })),
                  gravity: room.state.level.gravity || 1,
              },
              frames: [] as any[],
              generation: msg.generation,
              winner: undefined as string | undefined,
          }
        : null;

    const stepLimit = MAX_TICKS[mode];
    let tick = 0;
    while (!hg.finished && tick < stepLimit) {
        const events = hg.step();
        const players = Array.from(room.state.players.values());
        for (const e of events) tracker.onEvent(e, players);
        tracker.onTick(players, hg);
        if (snapshot) {
            snapshot.frames.push({
                t: tick,
                players: players.map((p) => ({
                    name: p.name,
                    colour: p.colour,
                    team: p.team,
                    type: p.type || undefined,
                    x: p.x,
                    y: p.y,
                    xV: p.xVelocity || 0,
                    yV: p.yVelocity || 0,
                    alive: !!p.alive,
                    health: p.health,
                    it: !!p.it,
                    ducked: !!p.ducked,
                    onSurface: !!p.onSurface,
                    lives: p.lives || 0,
                    attachedToPlayer: p.attachedToPlayer || undefined,
                    width: p.width,
                    height: p.height,
                    angle: p.angle || 0,
                })),
                events,
            });
            if (snapshot.frames.length > 1500) snapshot.frames.shift();
        }
        tick++;
    }
    if (snapshot) snapshot.winner = hg.winner?.name;

    const finalScores = tracker.finalize(Array.from(room.state.players.values()), hg);
    const fitness: Record<number, number> = {};
    for (const [name, score] of Object.entries(finalScores)) {
        const slot = slotByName[name];
        // Only population brains get scored — HOF and heuristic AIs are
        // there as opponents and have populationIndex < 0.
        if (slot && slot.populationIndex >= 0) {
            fitness[slot.populationIndex] = (fitness[slot.populationIndex] || 0) + score;
        }
    }
    return { fitness, snapshot };
}

parentPort?.on("message", (msg: IncomingMessage) => {
    if (msg.type === "shutdown") {
        process.exit(0);
    }
    if (msg.type === "job") {
        try {
            const { fitness, snapshot } = runMatch(msg);
            parentPort?.postMessage({ type: "result", jobId: msg.jobId, fitness, snapshot });
        } catch (err: any) {
            parentPort?.postMessage({
                type: "error",
                jobId: msg.jobId,
                message: err?.message || String(err),
            });
        }
    }
});
