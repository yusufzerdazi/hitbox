import { EventEmitter } from "events";
import fs from "fs";
import path from "path";

import GameMode from "../../game/gameMode";

import { OBSERVATION_SIZES } from "../agents/observation";
import { Population, PopulationJSON } from "./population";
import { WorkerPool, MatchSlot, SlotKind } from "../workerPool";
import { BrainJSON } from "../agents/network";

// Where each mode's full population checkpoint is persisted between runs.
// The single-best brain still lives in weights/<slug>.json for the live
// game; the population checkpoint adds the rest so training resumes
// instead of starting over from random.
const CHECKPOINT_DIR = path.join(__dirname, "..", "weights");
function slug(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
function checkpointPath(mode: string) {
    return path.join(CHECKPOINT_DIR, `${slug(mode)}-pop.json`);
}

// Hall of fame keeps historical-best brains as "external" opponents so the
// population can't drift into a local optimum where everyone is mediocre at
// the same thing. HOF brains are sampled into matches but never scored.
const HOF_MAX = 8;
const HOF_INJECT_RATE = 0.2;
// Sprinkle in hand-coded heuristic AIs as opponents so the brains learn to
// beat known-sensible strategies rather than only their own population.
// Kept small because non-scored slots eat into the per-brain fitness signal:
// at 10% with HOF at 20%, ~70% of slots still score the population.
const HEURISTIC_INJECT_RATE = 0.1;
// Which Player subclasses make sense as opponents in each mode. We use
// CleverAi exclusively because SimpleAi is mostly noise (so it doesn't
// teach the brains anything they couldn't get from a random init). An
// empty array disables heuristic injection — Death Wall's RunningAi doesn't
// help (DW fitness is per-individual distance, independent of opponent
// type), so we'd just be paying the scoring-throughput tax for no benefit.
const HEURISTIC_KINDS: Record<string, SlotKind[]> = {
    "Battle Royale": ["clever"],
    Spleef: ["clever"],
    Tag: ["clever"],
    "Collect the Boxes": ["clever"],
    "Death Wall": [],
    Football: ["clever"],
    "Capture The Flag": ["clever"],
};

export type ModeName =
    | "Battle Royale"
    | "Spleef"
    | "Tag"
    | "Collect the Boxes"
    | "Death Wall"
    | "Football"
    | "Capture The Flag";

// How many brains play in each match. Team modes need 4 so we have 2v2; FFA
// modes can do 4-way fights. Death Wall is single-player-but-comparable.
const PLAYERS_PER_MATCH: Record<ModeName, number> = {
    "Battle Royale": 4,
    Spleef: 4,
    Tag: 4,
    "Collect the Boxes": 4,
    "Death Wall": 4,
    Football: 4,
    "Capture The Flag": 4,
};

export interface TrainerOptions {
    mode: ModeName;
    populationSize?: number;
    eliteCount?: number;
    matchesPerBrainPerGen?: number;
    hiddenSize?: number;
    // Legacy knob: kept so callers that still pass it don't break. With the
    // new "record a random match every gen" behaviour we don't really need
    // a snapshot cadence anymore — every generation streams its own clip.
    snapshotEvery?: number;
    // How often to persist the full population to disk. The default is
    // small so a crash / Ctrl+C loses only a handful of generations.
    checkpointEvery?: number;
    // Benchmark / debugging knob: when false, the trainer skips both
    // auto-loading any saved checkpoint and auto-saving on snapshots. Lets
    // us measure clean learning curves without disk-state interference.
    resume?: boolean;
}

export interface TrainerStats {
    mode: ModeName;
    generation: number;
    best: number;
    mean: number;
    worst: number;
    elapsedMs: number;
}

export interface SnapshotFrame {
    t: number;
    players: {
        name: string;
        colour: string;
        team?: string;
        type?: string;
        x: number;
        y: number;
        xV: number;
        yV: number;
        alive: boolean;
        health: number;
        it: boolean;
        ducked: boolean;
        onSurface: boolean;
        lives: number;
        attachedToPlayer?: string;
        width: number;
        height: number;
        angle?: number;
    }[];
    events: { type: string; payload: any }[];
}

export interface MatchSnapshot {
    mode: ModeName;
    map: string;
    level: {
        platforms: { x: number; y: number; width: number; height: number; type?: string; colour?: string; durability?: number }[];
        gravity: number;
    };
    frames: SnapshotFrame[];
    generation: number;
    winner?: string;
}

const PALETTE = [
    "#ff3864", "#22d3ee", "#a3e635", "#facc15", "#c084fc", "#fb923c", "#34d399", "#f472b6",
];

// Trainer is an EventEmitter — UI / CLI subscribe to:
//   "stats"     : per-gen aggregate fitness numbers (TrainerStats)
//   "snapshot"  : exhibition match recording every N gens (MatchSnapshot)
//   "log"       : free-form info strings
export class Trainer extends EventEmitter {
    mode: ModeName;
    population: Population;
    opts: Required<TrainerOptions>;
    private pool: WorkerPool;
    private running = false;
    private stopRequested = false;
    // Rolling list of historical-best brain weights. Used to prevent the
    // population from collapsing into a single equilibrium strategy.
    private hallOfFame: BrainJSON[] = [];

    constructor(opts: TrainerOptions, pool?: WorkerPool) {
        super();
        this.mode = opts.mode;
        this.opts = {
            mode: opts.mode,
            populationSize: opts.populationSize ?? 32,
            eliteCount: opts.eliteCount ?? 4,
            matchesPerBrainPerGen: opts.matchesPerBrainPerGen ?? 2,
            hiddenSize: opts.hiddenSize ?? 32,
            snapshotEvery: opts.snapshotEvery ?? 1000,
            // Default to checkpointing every 10 generations so an unplanned
            // interrupt costs at most ~10 gens of work to redo.
            checkpointEvery: opts.checkpointEvery ?? 10,
            resume: opts.resume ?? true,
        };
        const inputSize = OBSERVATION_SIZES[opts.mode];
        if (!inputSize) throw new Error(`No observation builder registered for mode ${opts.mode}`);
        const shape = { inputSize, hiddenSize: this.opts.hiddenSize, outputSize: 7 };
        const popOpts = {
            size: this.opts.populationSize,
            eliteCount: this.opts.eliteCount,
            mutationRate: 0.15,
            mutationSigma: 0.12,
            crossoverRate: 0.5,
        };
        // Try to resume from a saved population. We require the brain shape
        // to match exactly — stale weights from an old observation layout
        // would silently produce garbage actions.
        const resumed = this.opts.resume ? this.tryLoadCheckpoint(opts.mode, shape) : null;
        if (resumed) {
            this.population = resumed;
            console.log(`[${opts.mode}] resumed at gen ${resumed.generation} (sigma=${resumed.currentSigma.toFixed(4)})`);
        } else {
            this.population = new Population(shape, popOpts);
        }
        this.pool = pool ?? new WorkerPool();
    }

    private tryLoadCheckpoint(mode: string, expectedShape: { inputSize: number; hiddenSize: number; outputSize: number }): Population | null {
        const file = checkpointPath(mode);
        if (!fs.existsSync(file)) return null;
        try {
            const json: PopulationJSON = JSON.parse(fs.readFileSync(file, "utf-8"));
            const pop = Population.fromJSON(json, expectedShape);
            if (!pop) {
                console.warn(`[${mode}] checkpoint shape mismatch (expected ${JSON.stringify(expectedShape)}, found ${JSON.stringify(json.shape)}) — starting fresh.`);
                return null;
            }
            return pop;
        } catch (e) {
            console.warn(`[${mode}] failed to load checkpoint:`, e);
            return null;
        }
    }

    // Public so a graceful-shutdown handler can flush a final checkpoint
    // outside the regular cadence (e.g. on SIGINT).
    saveCheckpoint(): void {
        try {
            if (!fs.existsSync(CHECKPOINT_DIR)) fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
            fs.writeFileSync(checkpointPath(this.mode), JSON.stringify(this.population.toJSON()));
        } catch (e) {
            console.warn(`[${this.mode}] failed to save checkpoint:`, e);
        }
    }

    // Run one generation: shuffle brains into matches, dispatch them in
    // parallel across the worker pool, then evolve.
    async runGeneration(): Promise<TrainerStats> {
        const t0 = Date.now();
        const populationSize = this.opts.populationSize;
        const k = PLAYERS_PER_MATCH[this.mode];
        const slots: number[] = [];
        for (let pass = 0; pass < this.opts.matchesPerBrainPerGen; pass++) {
            for (let i = 0; i < populationSize; i++) slots.push(i);
        }
        for (let i = slots.length - 1; i > 0; i--) {
            const j = (Math.random() * (i + 1)) | 0;
            [slots[i], slots[j]] = [slots[j], slots[i]];
        }
        const totals = new Array(populationSize).fill(0);
        const counts = new Array(populationSize).fill(0);

        // Serialize all brains once per generation — many matches will share
        // them, but the worker_threads structured-clone copy is fast enough
        // that pre-caching isn't worth the bookkeeping.
        const brainJSONs = this.population.brains.map((b) => b.toJSON());

        // Pick one of this generation's matches to record so the UI gets a
        // fresh playback every gen without us paying for an extra match.
        const matchCount = Math.floor(slots.length / k);
        const recordIdx = matchCount > 0 ? (Math.random() * matchCount) | 0 : -1;
        let latestSnapshot: any = null;

        const teamBased = this.mode === "Football" || this.mode === "Capture The Flag";
        const heuristicKinds = HEURISTIC_KINDS[this.mode] || ["simple", "clever"];
        const heuristicEnabled = heuristicKinds.length > 0;
        const effectiveHeuristicRate = heuristicEnabled ? HEURISTIC_INJECT_RATE : 0;
        const pickHeuristicKind = (): SlotKind =>
            heuristicKinds[(Math.random() * heuristicKinds.length) | 0];

        const jobs: Promise<void>[] = [];
        let matchIdx = 0;
        for (let i = 0; i + k <= slots.length; i += k, matchIdx++) {
            const popIndices = slots.slice(i, i + k);
            // Build per-slot descriptors. A roll per slot decides whether
            // the slot is a scored population brain, a HOF opponent, or a
            // heuristic-AI opponent. Non-scored slots use populationIndex=-1.
            const matchSlots: MatchSlot[] = [];
            popIndices.forEach((bi, slotIdx) => {
                const r = Math.random();
                const team = teamBased ? (slotIdx % 2 === 0 ? "red" : "blue") : undefined;
                if (this.hallOfFame.length > 0 && r < HOF_INJECT_RATE) {
                    const hof = this.hallOfFame[(Math.random() * this.hallOfFame.length) | 0];
                    matchSlots.push({ kind: "brain", brain: hof, populationIndex: -1, team });
                } else if (heuristicEnabled && r < HOF_INJECT_RATE + effectiveHeuristicRate) {
                    matchSlots.push({ kind: pickHeuristicKind(), populationIndex: -1, team });
                } else {
                    matchSlots.push({
                        kind: "brain",
                        brain: brainJSONs[bi],
                        populationIndex: bi,
                        team,
                    });
                }
            });
            const shouldRecord = matchIdx === recordIdx;
            jobs.push(
                this.pool
                    .runMatch({
                        mode: this.mode,
                        slots: matchSlots,
                        recordSnapshot: shouldRecord,
                        generation: this.population.generation,
                    })
                    .then((result) => {
                        for (const s of matchSlots) {
                            if (s.populationIndex < 0) continue;
                            totals[s.populationIndex] += result.fitness[s.populationIndex] || 0;
                            counts[s.populationIndex] += 1;
                        }
                        if (shouldRecord && result.snapshot) {
                            latestSnapshot = result.snapshot;
                        }
                    })
                    .catch((err) => {
                        // One failed match shouldn't sink the whole generation —
                        // leave the affected brains' fitness untouched so they
                        // either get scored on other matches this gen or stay
                        // at zero.
                        console.warn(`Match failed: ${err?.message || err}`);
                    })
            );
        }
        await Promise.all(jobs);

        const mean = totals.map((t, i) => (counts[i] ? t / counts[i] : 0));
        this.population.setFitness(mean);

        const stats = this.population.stats();
        const result: TrainerStats = {
            mode: this.mode,
            generation: this.population.generation,
            best: stats.best,
            mean: stats.mean,
            worst: stats.worst,
            elapsedMs: Date.now() - t0,
        };
        this.emit("stats", result);

        // Emit a snapshot every generation — one of the regular fitness
        // matches above was randomly tagged to record its frames, so this
        // costs no extra match. The UI swaps to the freshly finished game
        // automatically.
        if (latestSnapshot) this.emit("snapshot", latestSnapshot);

        // Checkpoint cadence is independent of snapshots: persists the
        // entire population every `checkpointEvery` generations so a
        // shutdown / crash can resume cleanly. Writing 7 modes' populations
        // each gen would be wasteful; default cadence (10) keeps the worst-
        // case lost work small without thrashing the disk.
        if (
            this.opts.resume &&
            this.population.generation > 0 &&
            this.population.generation % this.opts.checkpointEvery === 0
        ) {
            this.saveCheckpoint();
        }

        this.population.evolve();
        // After evolve, the new generation's best brain may surpass anyone
        // we've kept; copy the elite to HOF (capped so memory stays bounded).
        if (this.population.brains[0]) {
            this.hallOfFame.push(this.population.brains[0].toJSON());
            if (this.hallOfFame.length > HOF_MAX) this.hallOfFame.shift();
        }
        return result;
    }

    async run(maxGenerations: number): Promise<void> {
        if (this.running) throw new Error("Trainer already running");
        this.running = true;
        this.stopRequested = false;
        try {
            for (let g = 0; g < maxGenerations && !this.stopRequested; g++) {
                await this.runGeneration();
            }
        } finally {
            this.running = false;
        }
    }

    stop(): void {
        this.stopRequested = true;
    }

    bestBrainJSON(): any {
        return this.population.bestBrain().toJSON();
    }
}
