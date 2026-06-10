import Player from "../../players/player";
import { HeadlessGame } from "../sim/headlessGame";
import Constants from "../../constants";

// Per-mode shaping. Each builder returns a function that given a player +
// the running game returns a numeric reward delta for *this tick*. We then
// stream events from the room.broadcast queue into mode-aware bonuses (kills,
// goals, captures, etc.). At end-of-game we add a sparse terminal reward.

export interface PerPlayerFitness {
    [playerKey: string]: number;
}

// We key everything by `player.name` because that's stable across the
// lifecycle and is what the broadcast event payloads use.
const keyOf = (p: Player) => p.name;

export interface FitnessTracker {
    onEvent(event: { type: string; payload: any }, players: Player[]): void;
    onTick(players: Player[], hg: HeadlessGame): void;
    finalize(players: Player[], hg: HeadlessGame): PerPlayerFitness;
}

function blank(players: Player[]): PerPlayerFitness {
    const out: PerPlayerFitness = {};
    for (const p of players) if (!p.type) out[keyOf(p)] = 0;
    return out;
}

// --- Spleef ----------------------------------------------------------------
// Spleef's only mechanic that produces wins is *pounding* (down+airborne)
// to crack the platform an opponent is standing on. The pure kill/survive
// shaping used for BR gives random brains almost no signal because deaths
// come from falling (no killer attribution). We add per-tick shaping for:
//   * Standing above a nearby opponent (positions a pound)
//   * Hammering the pound action while airborne with downward velocity
//   * Crediting the brain closest above a death as the "killer" since the
//     death event itself has no killer field for falls.
const spleefTracker = (): FitnessTracker => {
    const scores: PerPlayerFitness = {};
    const TERMINAL = 30; // matches Constants.TERMINAL — duplicated to avoid bringing constants here.
    return {
        onEvent(event, players) {
            for (const p of players) if (!p.type && scores[keyOf(p)] === undefined) scores[keyOf(p)] = 0;
            if (event.type === "event" && event.payload?.type === "death") {
                const victimName = event.payload.killed?.name;
                if (victimName && scores[victimName] !== undefined) scores[victimName] -= 1;
                // Spleef deaths are falls — no killer is set. Attribute the
                // kill to whoever is closest *above* the death location.
                if (!event.payload.killer && event.payload.location) {
                    const loc = event.payload.location;
                    let best: Player | null = null;
                    let bestD = Infinity;
                    for (const p of players) {
                        if (p.type || !p.alive) continue;
                        if (p.y >= loc.y - 30) continue;
                        const d = Math.abs(p.x - loc.x);
                        if (d < 250 && d < bestD) {
                            bestD = d;
                            best = p;
                        }
                    }
                    if (best && scores[keyOf(best)] !== undefined) {
                        scores[keyOf(best)] += 5;
                    }
                }
            }
        },
        onTick(players) {
            for (const p of players) {
                if (p.type) continue;
                if (scores[keyOf(p)] === undefined) scores[keyOf(p)] = 0;
                if (!p.alive) continue;
                scores[keyOf(p)] += 0.002; // surviving tick
                // Positioning shaping: bonus for being above and close to an
                // opponent — that's the spot to pound from.
                for (const other of players) {
                    if (other === p || other.type || !other.alive) continue;
                    if (p.y < other.y - 30 && Math.abs(p.x - other.x) < 120) {
                        scores[keyOf(p)] += 0.003;
                    }
                }
                // Action shaping: nudge the brain toward the pound input
                // (down + airborne + downward velocity faster than gravity).
                if (!p.onSurface && p.down && p.yVelocity > TERMINAL * 0.8) {
                    scores[keyOf(p)] += 0.004;
                }
            }
        },
        finalize(players, hg) {
            if (hg.winner && scores[keyOf(hg.winner)] !== undefined) scores[keyOf(hg.winner)] += 20;
            return scores;
        },
    };
};

// --- BattleRoyale / Spleef share a kill/survive structure -------------------
function makeKillSurviveTracker(survivorBonus: number): () => FitnessTracker {
    return () => {
        const scores: PerPlayerFitness = {};
        const init = (ps: Player[]) => {
            for (const p of ps) if (!p.type && scores[keyOf(p)] === undefined) scores[keyOf(p)] = 0;
        };
        return {
            onEvent(event, players) {
                init(players);
                if (event.type === "event" && event.payload?.type === "death") {
                    const killerName = event.payload.killer?.name;
                    const victimName = event.payload.killed?.name;
                    if (killerName && scores[killerName] !== undefined) scores[killerName] += 5;
                    if (victimName && scores[victimName] !== undefined) scores[victimName] -= 1;
                }
            },
            onTick(players) {
                init(players);
                // Tiny reward for staying alive each tick — encourages survival
                // without dominating the kill signal.
                for (const p of players) {
                    if (!p.type && p.alive) scores[keyOf(p)] += 0.001;
                }
            },
            finalize(players, hg) {
                init(players);
                if (hg.winner && scores[keyOf(hg.winner)] !== undefined) {
                    scores[keyOf(hg.winner)] += survivorBonus;
                }
                return scores;
            },
        };
    };
}

// --- Tag --------------------------------------------------------------------
// Win condition is "holds halo when timer expires". Bonus structure now
// gives every brain a dense, role-aware signal so evolution isn't dominated
// by initial-it RNG: free brains are nudged TOWARDS the "it" player (chase
// the halo); the "it" brain is nudged AWAY from others (evasion). Both
// share the +30 terminal winner bonus.
const tagTracker = (): FitnessTracker => {
    const scores: PerPlayerFitness = {};
    return {
        onEvent(event, players) {
            for (const p of players) if (!p.type && scores[keyOf(p)] === undefined) scores[keyOf(p)] = 0;
            if (event.type === "event" && event.payload?.type === "halo") {
                const toName = event.payload.to?.name;
                const fromName = event.payload.from?.name;
                if (toName && scores[toName] !== undefined) scores[toName] += 3;
                if (fromName && scores[fromName] !== undefined) scores[fromName] -= 2;
            }
        },
        onTick(players) {
            // Find the current halo holder so the rest of the field can be
            // rewarded for closing the gap.
            const itPlayer = players.find((p) => !p.type && p.it && p.alive);
            for (const p of players) {
                if (p.type) continue;
                if (scores[keyOf(p)] === undefined) scores[keyOf(p)] = 0;
                if (!p.alive) continue;
                if (p.it) {
                    scores[keyOf(p)] += 0.03;
                    // Evasion shaping: bonus for keeping the nearest free
                    // player away. Caps at 0.01/tick so it can't dominate.
                    let minD = Infinity;
                    for (const other of players) {
                        if (other === p || other.type || !other.alive) continue;
                        const d = Math.hypot(other.x - p.x, other.y - p.y);
                        if (d < minD) minD = d;
                    }
                    if (isFinite(minD)) scores[keyOf(p)] += Math.min(0.01, minD / 80000);
                } else if (itPlayer) {
                    // Chase shaping: closer to "it" = more reward, up to
                    // 0.008/tick. Pushes free brains to pursue the halo.
                    const d = Math.hypot(itPlayer.x - p.x, itPlayer.y - p.y);
                    scores[keyOf(p)] += Math.max(0, 0.008 - d / 200000);
                }
            }
        },
        finalize(players, hg) {
            const winner = hg.winner;
            if (winner && scores[keyOf(winner)] !== undefined) scores[keyOf(winner)] += 30;
            return scores;
        },
    };
};

// --- CollectTheBoxes --------------------------------------------------------
const collectBoxesTracker = (): FitnessTracker => {
    const scores: PerPlayerFitness = {};
    return {
        onEvent(event, players) {
            for (const p of players) if (!p.type && scores[keyOf(p)] === undefined) scores[keyOf(p)] = 0;
            if (event.type === "event" && event.payload?.type === "box") {
                const n = event.payload.player?.name;
                if (n && scores[n] !== undefined) scores[n] += 10;
            }
            if (event.type === "event" && event.payload?.type === "death") {
                const v = event.payload.killed?.name;
                if (v && scores[v] !== undefined) scores[v] -= 0.5;
            }
        },
        onTick(players) {
            // Small shaping: gradient toward the orb so the brain has signal
            // even before it scores its first box.
            const orb = players.find((p) => p.orb);
            if (!orb) return;
            for (const p of players) {
                if (p.type) continue;
                if (scores[keyOf(p)] === undefined) scores[keyOf(p)] = 0;
                if (!p.alive) continue;
                const d = Math.hypot(p.x - orb.x, p.y - orb.y);
                // Closer = a tiny positive nudge.
                scores[keyOf(p)] += Math.max(0, 0.005 - d / 200000);
            }
        },
        finalize(players, hg) {
            if (hg.winner && scores[keyOf(hg.winner)] !== undefined) scores[keyOf(hg.winner)] += 20;
            return scores;
        },
    };
};

// --- DeathWall --------------------------------------------------------------
const deathWallTracker = (): FitnessTracker => {
    const scores: PerPlayerFitness = {};
    const lastX: Record<string, number> = {};
    return {
        onEvent(_e, players) {
            for (const p of players) if (!p.type && scores[keyOf(p)] === undefined) {
                scores[keyOf(p)] = 0;
                lastX[keyOf(p)] = p.x;
            }
        },
        onTick(players) {
            for (const p of players) {
                if (p.type) continue;
                const k = keyOf(p);
                if (scores[k] === undefined) {
                    scores[k] = 0;
                    lastX[k] = p.x;
                }
                if (!p.alive) continue;
                // Reward per-tick forward progress (only positive).
                const gain = Math.max(0, p.x - lastX[k]);
                scores[k] += gain * 0.01;
                // Tiny living bonus to discourage early suicide on the wall.
                scores[k] += 0.002;
                lastX[k] = p.x;
            }
        },
        finalize(players, hg) {
            if (hg.winner && scores[keyOf(hg.winner)] !== undefined) scores[keyOf(hg.winner)] += 25;
            return scores;
        },
    };
};

// --- Football ---------------------------------------------------------------
const footballTracker = (): FitnessTracker => {
    const scores: PerPlayerFitness = {};
    // Distance from the ball to each team's *opponent goal* on the previous
    // tick. Δ between ticks tells us which team made the ball more dangerous.
    const lastBallDistToGoal: Record<string, number> = {};
    const ensure = (players: Player[]) => {
        for (const p of players) if (!p.type && scores[keyOf(p)] === undefined) scores[keyOf(p)] = 0;
    };
    const goalCentreFor = (players: Player[], team: string, hg: HeadlessGame) => {
        const goal = hg.room.state.level.platforms.find(
            (pl) => (pl as any).type === "goal" && (pl as any).colour === team
        );
        if (!goal) return null;
        return { x: goal.leftX() + goal.width / 2, y: goal.topY() + goal.height / 2 };
    };
    return {
        onEvent(event, players) {
            ensure(players);
            if (event.type === "event" && event.payload?.type === "goal" && event.payload.colour) {
                // event.payload.colour is the goal that got scored against;
                // scoring team is the *opposite* one.
                const concedingTeam = event.payload.colour;
                for (const p of players) {
                    if (p.type) continue;
                    if (p.team === concedingTeam) scores[keyOf(p)] -= 15;
                    else scores[keyOf(p)] += 15;
                }
            }
        },
        onTick(players, hg) {
            ensure(players);
            const ball = players.find((p) => p.type === "ball");
            if (!ball) return;
            // Per-team ball-to-opponent-goal distance; positive Δ to that
            // team means the ball got closer to scoring on the opponent.
            const teams: { team: string; opp: string }[] = [
                { team: Constants.TEAM1, opp: Constants.TEAM2 },
                { team: Constants.TEAM2, opp: Constants.TEAM1 },
            ];
            for (const { team, opp } of teams) {
                const goal = goalCentreFor(players, opp, hg);
                if (!goal) continue;
                const d = Math.hypot(ball.x - goal.x, ball.y - goal.y);
                const last = lastBallDistToGoal[team];
                if (last !== undefined) {
                    // Reward gets divided across the team's players so the
                    // total shaping per goal-attempt stays bounded.
                    const teamPlayers = players.filter((p) => !p.type && p.team === team && p.alive);
                    if (teamPlayers.length > 0) {
                        const share = (last - d) * 0.01 / teamPlayers.length;
                        for (const p of teamPlayers) scores[keyOf(p)] += share;
                    }
                }
                lastBallDistToGoal[team] = d;
            }
            // Tiny ball-proximity bonus — keeps the gradient non-zero even
            // before the team has nudged the ball anywhere.
            for (const p of players) {
                if (p.type || !p.alive) continue;
                const d = Math.hypot(p.x - ball.x, p.y - ball.y);
                scores[keyOf(p)] += Math.max(0, 0.001 - d / 1_000_000);
            }
        },
        finalize(players, hg) {
            ensure(players);
            if (hg.endStatus?.winningTeam) {
                for (const p of players) {
                    if (p.type) continue;
                    scores[keyOf(p)] += p.team === hg.endStatus.winningTeam ? 30 : -30;
                }
            }
            return scores;
        },
    };
};

// --- CaptureTheFlag ---------------------------------------------------------
// Captures are extremely rare for random brains, so the old shaping only
// gave signal to whoever happened to have already grabbed the enemy flag.
// We add three pieces of denser shaping so all four brains have gradient
// information from tick one:
//   * Every non-carrier on a team gets a tiny bonus for being closer to the
//     enemy flag (anchor the chase).
//   * Carriers get a stronger reward proportional to how much closer to
//     their own goal they got in this tick (anchor the run).
//   * +6 one-shot bonus the tick a player picks up the enemy flag.
const ctfTracker = (): FitnessTracker => {
    const scores: PerPlayerFitness = {};
    // Tracks who was carrying each flag at the end of the previous tick so
    // we can detect new pickups without modifying the broadcast payloads.
    const prevCarrier: Record<string, string | null> = {};
    // Distance from the carrier to their own goal on the previous tick;
    // positive Δ between ticks means the carrier made progress.
    const prevGoalDist: Record<string, number> = {};
    const ensure = (players: Player[]) => {
        for (const p of players) if (!p.type && scores[keyOf(p)] === undefined) scores[keyOf(p)] = 0;
    };
    return {
        onEvent(event, players) {
            ensure(players);
            if (event.type === "event" && event.payload?.type === "capture") {
                // The broadcast `colour` is the *goal's* colour, which is
                // also the winning team's colour (see captureTheFlag.onTick:
                // `this.winningTeam = goal.colour;`). The old code flipped
                // it, attributing the immediate +/- to the wrong side —
                // capture moments looked LIKE a loss to the carrier, so the
                // brain converged on "hold the flag, don't deliver".
                const winningTeam = event.payload.colour;
                for (const p of players) {
                    if (p.type) continue;
                    scores[keyOf(p)] += p.team === winningTeam ? 50 : -20;
                }
            }
        },
        onTick(players, hg) {
            ensure(players);
            const level = hg.room.state.level;
            // Pre-index flags + goals so the inner loop stays cheap.
            const teamFlags: Record<string, Player | undefined> = {};
            for (const p of players) {
                if (p.type === "flag" && p.colour) teamFlags[p.colour] = p;
            }
            const teamGoals: Record<string, { x: number; y: number } | undefined> = {};
            for (const plat of level.platforms) {
                const t = (plat as any).type;
                const c = (plat as any).colour;
                if (t === "goal" && c) {
                    teamGoals[c] = {
                        x: plat.leftX() + plat.width / 2,
                        y: plat.topY() + plat.height / 2,
                    };
                }
            }
            for (const p of players) {
                if (p.type || !p.alive || !p.team) continue;
                const enemyTeam = p.team === Constants.TEAM1 ? Constants.TEAM2 : Constants.TEAM1;
                const enemyFlag = teamFlags[enemyTeam];
                if (!enemyFlag) continue;
                const isCarrier = enemyFlag.attachedToPlayer === p.name;
                if (isCarrier) {
                    // One-shot pickup bonus, kept small so pickup-farming
                    // (grab → get thwacked → re-grab) isn't competitive
                    // with actually delivering.
                    if (prevCarrier[enemyTeam] !== p.name) {
                        scores[keyOf(p)] += 3;
                    }
                    const myGoal = teamGoals[p.team];
                    if (myGoal) {
                        const d = Math.hypot(p.x - myGoal.x, p.y - myGoal.y);
                        // Continuous proximity reward — strong gradient that
                        // always points toward own goal regardless of motion.
                        scores[keyOf(p)] += Math.max(0, 0.015 - d / 400_000);
                        // Progress delta on top — extra reward for actively
                        // closing the gap.
                        const last = prevGoalDist[p.name];
                        if (last !== undefined) {
                            const progress = Math.max(0, last - d);
                            scores[keyOf(p)] += progress * 0.04;
                        }
                        prevGoalDist[p.name] = d;
                        // Tick cost while carrying — there's a clock on
                        // delivering. Stops "sit on the flag" from being a
                        // viable equilibrium.
                        scores[keyOf(p)] -= 0.004;
                    }
                } else {
                    // Chase shaping: closer to enemy flag = small positive.
                    const d = Math.hypot(p.x - enemyFlag.x, p.y - enemyFlag.y);
                    scores[keyOf(p)] += Math.max(0, 0.003 - d / 1_000_000);
                    delete prevGoalDist[p.name];
                }
            }
            // Update carrier tracking after the per-player pass.
            for (const c of Object.keys(teamFlags)) {
                prevCarrier[c] = teamFlags[c]?.attachedToPlayer || null;
            }
        },
        finalize(players, hg) {
            ensure(players);
            if (hg.endStatus?.winningTeam) {
                for (const p of players) {
                    if (p.type) continue;
                    scores[keyOf(p)] += p.team === hg.endStatus.winningTeam ? 30 : -30;
                }
            }
            return scores;
        },
    };
};

export const FITNESS_TRACKERS: Record<string, () => FitnessTracker> = {
    "Battle Royale": makeKillSurviveTracker(20),
    Spleef: spleefTracker,
    Tag: tagTracker,
    "Collect the Boxes": collectBoxesTracker,
    "Death Wall": deathWallTracker,
    Football: footballTracker,
    "Capture The Flag": ctfTracker,
};
