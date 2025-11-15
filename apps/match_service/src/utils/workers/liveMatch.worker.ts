import { parentPort, workerData } from "worker_threads";
import redisClient from "../../configs/redis.config";
import MatchLiveRepository from "../../repositories/matchLive.repository";

let isRunning = true;
const matchLiveRepo = new MatchLiveRepository();

const BATCH_CONFIG = {
  BATCH_SIZE: parseInt(process.env.BATCH_SIZE || "50"),
  BATCH_INTERVAL: parseInt(process.env.BATCH_INTERVAL || "2000"),
  IDLE_LIMIT: parseInt(process.env.IDLE_LIMIT || "1500000"), // stop worker if no data for X ms (optional)
};

let lastActivity = Date.now();

(async () => {
  try {
    await redisClient.connectClient();
    parentPort?.postMessage(`🚀 Worker started for Match: ${workerData.matchId}`);
  } catch (err) {
    parentPort?.postMessage(`❌ Redis connection failed for Match ${workerData.matchId}`);
    process.exit(1);
  }
})();

const processBatch = async () => {
  if (!isRunning) return;

  const listKey = `${workerData.matchId}:live_updates`;
  try {
    const events = await redisClient.popBatch(listKey, BATCH_CONFIG.BATCH_SIZE);

    if (events.length) {
      lastActivity = Date.now(); 
      const savedCount = await matchLiveRepo.bulkStoreLiveMatchData(workerData.matchId, events);
      parentPort?.postMessage(`✅ Saved ${savedCount} updates for match: ${workerData.matchId}`);
    } else {
      // 💤 Auto-stop worker after idle time (optional safety)
      if (Date.now() - lastActivity >= BATCH_CONFIG.IDLE_LIMIT) {
        parentPort?.postMessage(`⚠️ No activity for ${BATCH_CONFIG.IDLE_LIMIT}ms, auto-stopping worker`);
        stopWorker();
      }
    }
  } catch (error: any) {
    parentPort?.postMessage(`❌ Error in worker for match ${workerData.matchId}: ${error.message}`);
  }
};

const interval = setInterval(processBatch, BATCH_CONFIG.BATCH_INTERVAL);

function stopWorker() {
  isRunning = false;
  clearInterval(interval);
  redisClient.disconnectClient(); // 🛑 Close Redis connection
  parentPort?.postMessage(`🛑 Worker stopped for match: ${workerData.matchId}`);
  process.exit(0);
}

parentPort?.on("message", (msg) => {
  if (msg.type === "STOP") {
    stopWorker();
  }
});
