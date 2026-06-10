import { Trainer, ModeName, TrainerOptions } from "../train/trainer";
import { WorkerPool } from "../workerPool";

// Trajectory of a single (mode, config) benchmark run.
export interface TrainRun {
    mode: ModeName;
    label: string;
    config: Partial<TrainerOptions>;
    samples: { gen: number; best: number; mean: number; worst: number; ms: number }[];
    finalMean: number;
    finalBest: number;
    avgGenMs: number;
}

export interface BenchOptions {
    generations: number;
    sampleEvery?: number; // record stats every N gens; defaults to 10
    pool?: WorkerPool;
}

// Run one (mode, config) experiment. Returns the full fitness trajectory so
// we can compare configs by both ceiling AND slope-of-improvement.
export async function runOne(
    mode: ModeName,
    config: Partial<TrainerOptions>,
    label: string,
    opts: BenchOptions
): Promise<TrainRun> {
    const sampleEvery = opts.sampleEvery ?? 10;
    const trainer = new Trainer(
        { mode, snapshotEvery: 1_000_000, resume: false, ...config },
        opts.pool
    );
    const samples: TrainRun["samples"] = [];
    let totalMs = 0;
    let n = 0;
    trainer.on("stats", (s) => {
        totalMs += s.elapsedMs;
        n++;
        if (s.generation === 0 || s.generation % sampleEvery === 0) {
            samples.push({
                gen: s.generation,
                best: s.best,
                mean: s.mean,
                worst: s.worst,
                ms: s.elapsedMs,
            });
        }
    });
    await trainer.run(opts.generations);
    const last = samples[samples.length - 1];
    return {
        mode,
        label,
        config,
        samples,
        finalMean: last?.mean ?? 0,
        finalBest: last?.best ?? 0,
        avgGenMs: n ? totalMs / n : 0,
    };
}

// Convenience: print a trajectory and summary line.
export function printRun(r: TrainRun) {
    const head = `[${r.mode} · ${r.label}]  avgGenMs=${r.avgGenMs.toFixed(0)}`;
    console.log(head);
    console.log("  gen  |    best  |    mean  |   worst");
    for (const s of r.samples) {
        console.log(
            `  ${String(s.gen).padStart(4)} | ${s.best.toFixed(2).padStart(8)} | ${s.mean
                .toFixed(2)
                .padStart(8)} | ${s.worst.toFixed(2).padStart(8)}`
        );
    }
    console.log(`  -> final: best=${r.finalBest.toFixed(2)} mean=${r.finalMean.toFixed(2)}`);
}

// Run a battery of configs against a single mode and print results.
export async function compareConfigs(
    mode: ModeName,
    configs: { label: string; config: Partial<TrainerOptions> }[],
    opts: BenchOptions
): Promise<TrainRun[]> {
    const out: TrainRun[] = [];
    for (const { label, config } of configs) {
        const r = await runOne(mode, config, label, opts);
        printRun(r);
        out.push(r);
    }
    // Side-by-side summary so the winner is obvious.
    console.log(`\n=== ${mode} comparison ===`);
    console.log("  config".padEnd(28), "| finalBest |  finalMean | avgGenMs");
    for (const r of out) {
        console.log(
            `  ${r.label.padEnd(28)}|`,
            r.finalBest.toFixed(2).padStart(9),
            "|",
            r.finalMean.toFixed(2).padStart(10),
            "|",
            r.avgGenMs.toFixed(0).padStart(8)
        );
    }
    return out;
}
