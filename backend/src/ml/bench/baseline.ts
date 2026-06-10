// Baseline benchmark: trains each game mode for N generations with the
// default trainer settings and prints the fitness trajectory.
import { runOne, printRun } from "./harness";
import { WorkerPool } from "../workerPool";
import { ModeName } from "../train/trainer";

const ALL_MODES: ModeName[] = [
    "Battle Royale",
    "Spleef",
    "Tag",
    "Collect the Boxes",
    "Death Wall",
    "Football",
    "Capture The Flag",
];

const GENS = Number(process.env.GENS || 100);
const SAMPLE = Number(process.env.SAMPLE || 10);

(async () => {
    const pool = new WorkerPool(4);
    const t0 = Date.now();
    const all = [];
    for (const m of ALL_MODES) {
        const r = await runOne(
            m,
            { populationSize: 32, matchesPerBrainPerGen: 2, hiddenSize: 32 },
            "default",
            { generations: GENS, sampleEvery: SAMPLE, pool }
        );
        printRun(r);
        all.push(r);
    }
    console.log(`\n=== baseline summary (${GENS} gens) ===`);
    console.log("  mode".padEnd(22), "| gen0 mean | finalMean | finalBest |   Δ mean | avg ms/gen");
    for (const r of all) {
        const g0 = r.samples[0]?.mean ?? 0;
        const dMean = r.finalMean - g0;
        console.log(
            `  ${r.mode.padEnd(22)}|`,
            g0.toFixed(2).padStart(9),
            "|",
            r.finalMean.toFixed(2).padStart(9),
            "|",
            r.finalBest.toFixed(2).padStart(9),
            "|",
            (dMean >= 0 ? "+" : "") + dMean.toFixed(2).padStart(8),
            "|",
            r.avgGenMs.toFixed(0).padStart(10)
        );
    }
    console.log(`\nTotal wall time: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    await pool.terminate();
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
