// Must be at the very top
import { logger } from "@repo/common";
import AppInit from "./app";
import { connectDatabase } from "./configs/database.config";
import redis from "./configs/redis.config";
import ServerConfigs from "./configs/server.config";
import rabbitmqInstance from "./configs/rabbitmq.config";

async function startServer() {
  await connectDatabase();

  await redis.connectClient();

  await rabbitmqInstance.connectClient();

  const { server } = await AppInit();
  
  // Start the HTTP server (which has Socket.IO attached)
  server.listen(Number(ServerConfigs.APP_PORT), () => {
    logger.info(`Server started at PORT: ${ServerConfigs.APP_PORT}`);
    logger.info(`Socket.IO server is ready at http://localhost:${ServerConfigs.APP_PORT}`);
  });
}

startServer();
