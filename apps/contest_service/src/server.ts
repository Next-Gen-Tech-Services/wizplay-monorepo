// Must be at the very top
import { logger } from "@repo/common";
import AppInit from "./app";
import { connectDatabase } from "./configs/database.config";
import ServerConfigs from "./configs/server.config";
import { shutDown } from "./utils/shutdown";
import { contestStatusUpdaterJob } from "./jobs/contest-status-updater.job";

async function startServer() {
  await connectDatabase();

  // await redis.connectClient();

  const ExpressApp = await AppInit();
  const server = ExpressApp.listen(Number(ServerConfigs.APP_PORT), () => {
    logger.info(`Server started at PORT: ${ServerConfigs.APP_PORT}`);
    
    // Start the contest status updater job
    contestStatusUpdaterJob.start();
  });
  // Set server timeout to 3 minutes for AI generation endpoints
  server.timeout = 180000; // 3 minutes
  server.keepAliveTimeout = 185000; // Slightly longer than timeout

  process.on("SIGTERM", () => {
    contestStatusUpdaterJob.stop();
    shutDown(1, server);
  });
  
  process.on("SIGINT", () => {
    contestStatusUpdaterJob.stop();
    shutDown(1, server);
  });

  process.on("uncaughtException", (err) => {
    logger.error("Uncaught Exception:", err);
    shutDown(1, server);
  });

  process.on("unhandledRejection", (reason: any) => {
    logger.error("Unhandled Rejection:", reason);
    shutDown(1, server);
  });
}

startServer();
