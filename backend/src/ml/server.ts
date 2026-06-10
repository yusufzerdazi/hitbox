import express from "express";
import http from "http";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import fs from "fs";
import path from "path";

import { Trainer, ModeName } from "./train/trainer";
import { WorkerPool } from "./workerPool";

const WEIGHTS_DIR = path.join(__dirname, "weights");

// All seven modes train concurrently against a shared worker pool. Each
// Trainer drives its own population independently and emits its own stats
// and snapshots. The web UI subscribes to every mode at once and shows the
// one the user picked — switching tabs doesn't pause anyone's training.

const ALL_MODES: ModeName[] = [
    "Battle Royale",
    "Spleef",
    "Tag",
    "Collect the Boxes",
    "Death Wall",
    "Football",
    "Capture The Flag",
];

interface ModeState {
    trainer: Trainer;
    recentStats: any[];
    latestSnapshot: any;
}

const STATS_BUFFER = 500;
const trainers = new Map<ModeName, ModeState>();
// One dedicated worker per trainer — keeps each mode's match throughput
// independent of every other mode's. 7 trainers → 7 workers total.
const pools: WorkerPool[] = [];

function broadcastJSON(wss: WebSocketServer, msg: any) {
    const text = JSON.stringify(msg);
    wss.clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(text);
    });
}

function slug(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function attachTrainer(mode: ModeName, ms: ModeState, wss: WebSocketServer) {
    ms.trainer.on("stats", (s) => {
        ms.recentStats.push(s);
        if (ms.recentStats.length > STATS_BUFFER) ms.recentStats.shift();
        broadcastJSON(wss, { type: "stats", mode, data: s });
    });
    ms.trainer.on("snapshot", (snap) => {
        ms.latestSnapshot = snap;
        broadcastJSON(wss, { type: "snapshot", mode, data: snap });
        // Persist best brain so the live game picks it up on the next match.
        try {
            if (!fs.existsSync(WEIGHTS_DIR)) fs.mkdirSync(WEIGHTS_DIR, { recursive: true });
            const f = path.join(WEIGHTS_DIR, `${slug(snap.mode)}.json`);
            fs.writeFileSync(f, JSON.stringify(ms.trainer.bestBrainJSON()));
        } catch (e) {
            console.warn("Failed to persist weights:", e);
        }
    });
}

function startAllTrainers(wss: WebSocketServer) {
    const snapshotEvery = Number(process.env.SNAPSHOT_EVERY || 1000);
    const populationSize = Number(process.env.POPULATION_SIZE || 32);
    for (const mode of ALL_MODES) {
        if (trainers.has(mode)) continue;
        // One dedicated worker per trainer. Matches within a mode run
        // sequentially through that worker; modes run in parallel because
        // each has its own.
        const pool = new WorkerPool(1);
        pools.push(pool);
        const trainer = new Trainer({ mode, snapshotEvery, populationSize }, pool);
        const ms: ModeState = { trainer, recentStats: [], latestSnapshot: null };
        trainers.set(mode, ms);
        attachTrainer(mode, ms, wss);
        trainer.run(1_000_000).catch((err) => console.error(`Trainer ${mode} crashed:`, err));
    }
}

export function startServer(port = 2568) {
    const app = express();
    app.use(cors());
    app.use(express.json());

    app.get("/api/status", (req, res) => {
        // Optional ?mode= filter for the page to fetch a single mode's data
        // on first paint without lugging six other modes' history along.
        const mode = req.query.mode as string | undefined;
        if (mode && trainers.has(mode as ModeName)) {
            const ms = trainers.get(mode as ModeName)!;
            return res.json({
                mode,
                generation: ms.trainer.population.generation,
                recentStats: ms.recentStats,
                latestSnapshot: ms.latestSnapshot,
            });
        }
        const summary: Record<string, any> = {};
        for (const [m, ms] of trainers) {
            summary[m] = {
                generation: ms.trainer.population.generation,
                latest: ms.recentStats[ms.recentStats.length - 1] || null,
                hasSnapshot: !!ms.latestSnapshot,
            };
        }
        res.json({ modes: ALL_MODES, summary });
    });

    app.get("/api/weights/:mode", (req, res) => {
        const f = path.join(WEIGHTS_DIR, `${slug(req.params.mode)}.json`);
        if (!fs.existsSync(f)) return res.status(404).json({ error: "no weights yet" });
        res.sendFile(f);
    });

    app.post("/api/stop", (_req, res) => {
        for (const ms of trainers.values()) ms.trainer.stop();
        res.json({ ok: true });
    });

    const server = http.createServer(app);
    const wss = new WebSocketServer({ server, path: "/ws" });
    wss.on("connection", (ws) => {
        // Hand the new client per-mode buffers so it can render whichever
        // tab is open without an extra HTTP round-trip.
        const perMode: Record<string, any> = {};
        for (const [m, ms] of trainers) {
            perMode[m] = {
                recentStats: ms.recentStats.slice(-200),
                latestSnapshot: ms.latestSnapshot,
            };
        }
        ws.send(JSON.stringify({ type: "hello", modes: ALL_MODES, perMode }));
    });

    server.listen(port, () => {
        console.log(`Trainer server listening on http://localhost:${port}`);
        console.log(`Training ${ALL_MODES.length} modes simultaneously.`);
    });

    startAllTrainers(wss);

    // Graceful shutdown: flush a final checkpoint for every mode so even an
    // interrupt between the regular `checkpointEvery` cadence doesn't lose
    // generations of work. SIGINT (Ctrl+C) and SIGTERM (systemd / pm2) both
    // trigger the flush.
    let shuttingDown = false;
    const flushAndExit = (signal: string) => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log(`\nReceived ${signal} — flushing final checkpoints…`);
        for (const [mode, ms] of trainers) {
            ms.trainer.stop();
            try {
                ms.trainer.saveCheckpoint();
                console.log(`  [${mode}] saved gen ${ms.trainer.population.generation}`);
            } catch (e) {
                console.warn(`  [${mode}] checkpoint flush failed`, e);
            }
        }
        process.exit(0);
    };
    process.on("SIGINT", () => flushAndExit("SIGINT"));
    process.on("SIGTERM", () => flushAndExit("SIGTERM"));

    return { app, server, wss };
}

if (require.main === module) {
    startServer(Number(process.env.PORT || 2568));
}
