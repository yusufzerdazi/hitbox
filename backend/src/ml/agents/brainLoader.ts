import fs from "fs";
import path from "path";

import { Brain, BrainJSON } from "./network";
import NeuralAi from "./neuralPlayer";
import Player from "../../players/player";
import Utils from "../../utils";

// Cache loaded brains so repeated AI spawns are cheap. We re-check the file's
// mtime so the live game picks up freshly-trained weights without a restart.
interface CacheEntry {
    mtimeMs: number;
    brain: Brain;
}

const WEIGHTS_DIR = path.join(__dirname, "..", "weights");
const cache = new Map<string, CacheEntry>();

function slug(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

// Returns null if no trained weights exist (or fail to load) for the mode.
export function loadBrainForMode(mode: string): Brain | null {
    const file = path.join(WEIGHTS_DIR, `${slug(mode)}.json`);
    if (!fs.existsSync(file)) return null;
    try {
        const stat = fs.statSync(file);
        const cached = cache.get(file);
        if (cached && cached.mtimeMs === stat.mtimeMs) return cached.brain;
        const json: BrainJSON = JSON.parse(fs.readFileSync(file, "utf-8"));
        const brain = Brain.fromJSON(json);
        cache.set(file, { mtimeMs: stat.mtimeMs, brain });
        return brain;
    } catch (e) {
        // Bad file — fall back to non-trained AI so the live game keeps working.
        return null;
    }
}

// Convenience: build a NeuralAi configured for the given mode using whatever
// weights are currently on disk. Returns null when no weights are available.
export function makeNeuralAi(
    mode: string,
    colour: string,
    name: string
): NeuralAi | null {
    const brain = loadBrainForMode(mode);
    if (!brain) return null;
    const ai = new NeuralAi(colour, name, brain, mode);
    (ai as any).clientId = Utils.uuidv4();
    return ai;
}

// Helper used by gameMode hooks: replace an existing player slot with a
// NeuralAi while preserving its score / clientId / team. Returns true if a
// substitution happened.
export function tryReplaceWithNeuralAi(mode: string, player: Player): NeuralAi | null {
    const brain = loadBrainForMode(mode);
    if (!brain) return null;
    const ai = new NeuralAi(player.colour, player.name, brain, mode);
    ai.score = player.score;
    ai.team = player.team;
    (ai as any).clientId = (player as any).clientId;
    return ai;
}
