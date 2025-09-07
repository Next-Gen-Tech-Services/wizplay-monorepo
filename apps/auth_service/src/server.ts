// Must be at the very top
import { logger } from "@repo/common";
import AppInit from "./app";
import { connectDatabase } from "./configs/database.config";
import rabbitmqInstance from "./configs/rabbitmq.config";
import redis from "./configs/redis.config";
import ServerConfigs from "./configs/server.config";
import { shutDown } from "./utils/shutdown";

async function startServer() {
  await connectDatabase();

  await redis.connectClient();

  await rabbitmqInstance.connectClient();

  const ExpressApp = await AppInit();
  const server = ExpressApp.listen(Number(ServerConfigs.APP_PORT), () => {
    logger.info(`Server started at PORT: ${ServerConfigs.APP_PORT}`);
  });

  process.on("SIGTERM", () => shutDown(1, server));
  process.on("SIGINT", () => shutDown(1, server));

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
