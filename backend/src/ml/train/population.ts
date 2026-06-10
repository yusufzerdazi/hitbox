import { Brain, BrainJSON, BrainShape } from "../agents/network";

export interface PopulationOptions {
    size: number;
    eliteCount: number; // how many top brains survive unchanged each gen
    mutationRate: number;
    mutationSigma: number; // initial sigma; annealed over generations
    crossoverRate: number;
    // Geometric decay applied to sigma after each generation. Defaults keep
    // sigma roughly stable for ~200 gens, then halve every ~700 gens — fine
    // tuning emerges as the population converges.
    sigmaDecay?: number;
    sigmaMin?: number;
}

export interface ScoredBrain {
    brain: Brain;
    fitness: number;
}

// A simple generational genetic algorithm. Elites pass through untouched,
// the rest of the new population is built by tournament-selecting parents,
// crossing them over with probability `crossoverRate`, then mutating.
export class Population {
    shape: BrainShape;
    opts: PopulationOptions;
    brains: Brain[];
    // Per-brain mean fitness over the last evaluation.
    fitness: number[];
    generation = 0;
    // Annealed mutation sigma — high early for fast exploration, decayed
    // toward sigmaMin so late-generation fine-tuning doesn't get scrambled.
    currentSigma: number;

    constructor(shape: BrainShape, opts: PopulationOptions) {
        this.shape = shape;
        this.opts = opts;
        this.brains = Array.from({ length: opts.size }, () => Brain.random(shape));
        this.fitness = new Array(opts.size).fill(0);
        this.currentSigma = opts.mutationSigma;
    }

    // Replace each brain's fitness for this generation. `scores` must have the
    // same length as `brains`.
    setFitness(scores: number[]): void {
        this.fitness = scores.slice();
    }

    // Standard 3-way tournament selection: sample three brains, return the
    // index of the fittest.
    private tournament(): number {
        const a = (Math.random() * this.brains.length) | 0;
        const b = (Math.random() * this.brains.length) | 0;
        const c = (Math.random() * this.brains.length) | 0;
        const fa = this.fitness[a];
        const fb = this.fitness[b];
        const fc = this.fitness[c];
        if (fa >= fb && fa >= fc) return a;
        if (fb >= fc) return b;
        return c;
    }

    evolve(): void {
        const sorted = this.brains
            .map((brain, idx) => ({ brain, fitness: this.fitness[idx], idx }))
            .sort((x, y) => y.fitness - x.fitness);
        const elites = sorted.slice(0, this.opts.eliteCount).map((s) => s.brain.clone());

        const next: Brain[] = [...elites];
        while (next.length < this.opts.size) {
            const parentA = this.brains[this.tournament()];
            const parentB = this.brains[this.tournament()];
            let child: Brain;
            if (Math.random() < this.opts.crossoverRate) {
                child = Brain.crossover(parentA, parentB);
            } else {
                child = parentA.clone();
            }
            child.mutate(this.opts.mutationRate, this.currentSigma);
            next.push(child);
        }
        this.brains = next;
        this.fitness = new Array(this.opts.size).fill(0);
        this.generation++;
        // Anneal: shrink sigma but never below the floor so the population
        // can still escape shallow local optima late in training.
        const decay = this.opts.sigmaDecay ?? 0.999;
        const floor = this.opts.sigmaMin ?? Math.max(0.01, this.opts.mutationSigma * 0.15);
        this.currentSigma = Math.max(floor, this.currentSigma * decay);
    }

    bestBrain(): Brain {
        let best = 0;
        for (let i = 1; i < this.fitness.length; i++) {
            if (this.fitness[i] > this.fitness[best]) best = i;
        }
        return this.brains[best];
    }

    stats(): { best: number; mean: number; worst: number } {
        let best = -Infinity, worst = Infinity, sum = 0;
        for (const f of this.fitness) {
            if (f > best) best = f;
            if (f < worst) worst = f;
            sum += f;
        }
        return { best, mean: sum / this.fitness.length, worst };
    }

    // Persist enough state that a later run can pick up where we left off:
    // every brain in the population, plus generation counter and current
    // sigma (the annealed mutation amplitude).
    toJSON(): PopulationJSON {
        return {
            shape: this.shape,
            opts: this.opts,
            generation: this.generation,
            currentSigma: this.currentSigma,
            brains: this.brains.map((b) => b.toJSON()),
        };
    }

    // Restore from a previously persisted PopulationJSON. If `expectedShape`
    // is provided and doesn't match, returns null so the caller can fall
    // back to random init (avoids loading weights from a stale observation
    // layout).
    static fromJSON(json: PopulationJSON, expectedShape?: BrainShape): Population | null {
        if (expectedShape) {
            if (
                expectedShape.inputSize !== json.shape.inputSize ||
                expectedShape.hiddenSize !== json.shape.hiddenSize ||
                expectedShape.outputSize !== json.shape.outputSize
            ) {
                return null;
            }
        }
        const pop = new Population(json.shape, json.opts);
        pop.brains = json.brains.map((bj) => Brain.fromJSON(bj));
        pop.generation = json.generation;
        pop.currentSigma = json.currentSigma;
        return pop;
    }
}

export interface PopulationJSON {
    shape: BrainShape;
    opts: PopulationOptions;
    generation: number;
    currentSigma: number;
    brains: BrainJSON[];
}
