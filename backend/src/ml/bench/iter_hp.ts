// Hyperparameter sweep: does Tag (noisiest mode) benefit from a bigger
// population, more matches per brain, or a wider net? Test each lever in
// isolation against the same baseline.
import { compareConfigs } from "./harness";
import { WorkerPool } from "../workerPool";

(async () => {
    const pool = new WorkerPool(4);
    await compareConfigs(
        "Tag",
        [
            { label: "baseline (32/2/h32)", config: { populationSize: 32, matchesPerBrainPerGen: 2, hiddenSize: 32 } },
            { label: "pop=64", config: { populationSize: 64, matchesPerBrainPerGen: 2, hiddenSize: 32 } },
            { label: "matches=4", config: { populationSize: 32, matchesPerBrainPerGen: 4, hiddenSize: 32 } },
            { label: "hidden=64", config: { populationSize: 32, matchesPerBrainPerGen: 2, hiddenSize: 64 } },
            { label: "pop=64 matches=4", config: { populationSize: 64, matchesPerBrainPerGen: 4, hiddenSize: 32 } },
        ],
        { generations: 120, sampleEvery: 30, pool }
    );
    await pool.terminate();
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
