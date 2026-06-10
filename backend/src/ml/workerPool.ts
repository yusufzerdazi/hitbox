import { Worker } from "worker_threads";
import path from "path";
import os from "os";

import { BrainJSON } from "./agents/network";

// Each slot in a match is one player. The kind decides which Player subclass
// to instantiate; populationIndex says whether the trainer scores the slot
// (>=0) or treats it as a non-scored opponent (-1 for HOF / heuristic).
export type SlotKind = "brain" | "simple" | "clever" | "running";
export interface MatchSlot {
    kind: SlotKind;
    populationIndex: number;
    // Required when kind === "brain"; absent for heuristics.
    brain?: BrainJSON;
    // For team modes; ignored otherwise.
    team?: string;
}

export interface MatchJob {
    mode: string;
    slots: MatchSlot[];
    recordSnapshot: boolean;
    generation: number;
}

export interface MatchResult {
    fitness: Record<number, number>;
    snapshot: any | null;
}

interface PendingJob {
    job: MatchJob;
    resolve: (r: MatchResult) => void;
    reject: (e: Error) => void;
    jobId: number;
}

interface WorkerSlot {
    worker: Worker;
    busy: boolean;
    currentJobId: number | null;
}

// Round-robin worker pool. Each match is a single job dispatched to whichever
// worker comes free next.
export class WorkerPool {
    private slots: WorkerSlot[] = [];
    private queue: PendingJob[] = [];
    private nextJobId = 0;
    private pending = new Map<number, PendingJob>();

    constructor(size: number = Math.max(1, os.cpus().length - 1)) {
        // Choose the right entry: TypeScript bootstrap in dev, compiled .js
        // in production builds. The presence of the build/ tree is a
        // reliable signal we're running compiled.
        const fs = require("fs");
        const builtWorker = path.join(__dirname, "worker.js");
        const isBuilt = fs.existsSync(builtWorker) && !__filename.endsWith(".ts");
        const workerEntry = isBuilt ? builtWorker : path.join(__dirname, "workerBootstrap.js");

        for (let i = 0; i < size; i++) {
            this.slots.push({ worker: null as any, busy: false, currentJobId: null });
            this.spawnSlot(i, workerEntry);
        }
    }

    private spawnSlot(slotIdx: number, workerEntry: string) {
        const worker = new Worker(workerEntry);
        worker.on("message", (msg) => this.handleMessage(slotIdx, msg));
        worker.on("error", (err) => this.handleError(slotIdx, err));
        worker.on("exit", (code) => {
            // If a worker dies while holding a job, the pending promise would
            // hang forever — fail it explicitly so the trainer can recover.
            const slot = this.slots[slotIdx];
            if (slot && slot.currentJobId !== null) {
                const pending = this.pending.get(slot.currentJobId);
                if (pending) {
                    this.pending.delete(slot.currentJobId);
                    pending.reject(new Error(`Worker ${slotIdx} exited with code ${code} during job ${slot.currentJobId}`));
                }
            }
            if (code !== 0) console.error(`Worker ${slotIdx} exited with code ${code}`);
        });
        this.slots[slotIdx].worker = worker;
        this.slots[slotIdx].busy = false;
        this.slots[slotIdx].currentJobId = null;
    }

    size(): number {
        return this.slots.length;
    }

    runMatch(job: MatchJob): Promise<MatchResult> {
        return new Promise((resolve, reject) => {
            const jobId = this.nextJobId++;
            const pending: PendingJob = { job, resolve, reject, jobId };
            this.pending.set(jobId, pending);
            this.queue.push(pending);
            this.tryDispatch();
        });
    }

    private tryDispatch() {
        while (this.queue.length > 0) {
            const slot = this.slots.find((s) => !s.busy);
            if (!slot) return;
            const pending = this.queue.shift()!;
            slot.busy = true;
            slot.currentJobId = pending.jobId;
            slot.worker.postMessage({
                type: "job",
                jobId: pending.jobId,
                mode: pending.job.mode,
                slots: pending.job.slots,
                recordSnapshot: pending.job.recordSnapshot,
                generation: pending.job.generation,
            });
        }
    }

    private handleMessage(slotIdx: number, msg: any) {
        const slot = this.slots[slotIdx];
        const pending = this.pending.get(msg.jobId);
        if (!pending) return;
        this.pending.delete(msg.jobId);
        slot.busy = false;
        slot.currentJobId = null;
        if (msg.type === "result") {
            pending.resolve({ fitness: msg.fitness, snapshot: msg.snapshot });
        } else if (msg.type === "error") {
            pending.reject(new Error(msg.message));
        }
        this.tryDispatch();
    }

    private handleError(slotIdx: number, err: Error) {
        const slot = this.slots[slotIdx];
        if (slot.currentJobId !== null) {
            const pending = this.pending.get(slot.currentJobId);
            if (pending) {
                this.pending.delete(slot.currentJobId);
                pending.reject(err);
            }
        }
        // Workers occasionally crash on bad maths in the physics engine —
        // simplest recovery is to restart that slot so the pool stays at
        // full strength.
        try {
            slot.worker.terminate();
        } catch {}
        const fs = require("fs");
        const builtWorker = path.join(__dirname, "worker.js");
        const isBuilt = fs.existsSync(builtWorker) && !__filename.endsWith(".ts");
        const workerEntry = isBuilt ? builtWorker : path.join(__dirname, "workerBootstrap.js");
        this.spawnSlot(slotIdx, workerEntry);
        this.tryDispatch();
    }

    async terminate(): Promise<void> {
        await Promise.all(
            this.slots.map(async (s) => {
                try {
                    s.worker.postMessage({ type: "shutdown" });
                } catch {}
                await s.worker.terminate();
            })
        );
    }
}
