// Worker_threads in Node does not inherit any TS loader from the parent
// process. We register tsx's CJS hook so `require()` can pick up the .ts
// worker. Using tsx rather than ts-node because tsx works cleanly with
// worker_threads, whereas ts-node-dev's hot-reload model deadlocks them.
// When the project is compiled to build/ this file is unused — the .js
// worker is run directly (see workerPool.ts).
require("tsx/cjs");
require("./worker.ts");
