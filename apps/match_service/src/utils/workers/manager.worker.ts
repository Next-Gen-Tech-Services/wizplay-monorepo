import { Worker } from "worker_threads";
import path from "path";

type WorkerMap = Map<string, Worker>; // matchId -> Worker
const workers: WorkerMap = new Map();

/**
 * ✅ Start a worker for a specific match
 */
export function startMatchWorker(matchId: string) {
  if (workers.has(matchId)) {
    console.log(`⚠️ Worker already running for match ${matchId}`);
    return;
  }

  const worker = new Worker(
    path.resolve(__dirname, "./workers/liveMatchWorker.js"), // compiled JS
    {
      workerData: { matchId },
    }
  );

  workers.set(matchId, worker);

  worker.on("message", (msg) => {
    console.log(`[Worker ${matchId}] ${msg}`);
  });

  worker.on("error", (err) => {
    console.error(`❌ Worker error (match ${matchId}):`, err);
  });

  worker.on("exit", (code) => {
    console.log(`🛑 Worker for match ${matchId} exited with code ${code}`);
    workers.delete(matchId); // remove from map
  });

  console.log(`🚀 Worker started for match ${matchId}`);
}

/**
 * ✅ Stop worker for a specific match
 */
export function stopMatchWorker(matchId: string) {
  const worker = workers.get(matchId);
  if (!worker) {
    console.log(`⚠️ No worker found for match ${matchId}`);
    return;
  }

  worker.postMessage({ type: "STOP" });
  console.log(`🛑 Stop signal sent to worker ${matchId}`);
}

/**
 * ✅ Stop all running workers (useful during shutdown)
 */
export function stopAllWorkers() {
  workers.forEach((worker, matchId) => {
    console.log(`🛑 Stopping worker for match ${matchId}`);
    worker.postMessage({ type: "STOP" });
  });
}
