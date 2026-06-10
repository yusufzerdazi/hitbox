// Experiment: does Tag's negative-learning curve flatten / reverse if we
// reduce per-brain fitness noise by playing more matches per brain?
import { compareConfigs } from "./harness";
import { WorkerPool } from "../workerPool";

(async () => {
    const pool = new WorkerPool(4);
    await compareConfigs(
        "Tag",
        [
            { label: "default (matches=2)", config: { matchesPerBrainPerGen: 2 } },
            { label: "matches=4", config: { matchesPerBrainPerGen: 4 } },
            { label: "matches=6", config: { matchesPerBrainPerGen: 6 } },
        ],
        { generations: 80, sampleEvery: 20, pool }
    );
    await pool.terminate();
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
