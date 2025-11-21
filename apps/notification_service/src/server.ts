// Must be at the very top
import { logger } from "@repo/common";
import AppInit from "./app";
import { connectDatabase } from "./configs/database.config";
import ServerConfigs from "./configs/server.config";

async function startServer() {
  await connectDatabase();

  // await redis.connectClient();

  // await rabbitmqInstance.connectClient();

  const ExpressApp = await AppInit();
  const server = ExpressApp.listen(Number(ServerConfigs.APP_PORT), () => {
    logger.info(`Server started at PORT: ${ServerConfigs.APP_PORT}`);
  });
}

startServer();
