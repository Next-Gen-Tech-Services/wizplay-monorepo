import { attachRequestId, ErrorMiddleware, logger } from "@repo/common";
import cors from "cors";
import express, { Express, Request, Response } from "express";
import ServerConfigs from "./configs/server.config";
import WalletRouter from "./routes/wallet.router";
import userEventHandler from "./utils/events/user.events";
import { connectProducer } from "./utils/kafka";

const BrokerInit = async (retryCount = 0, maxRetries = 10) => {
  try {
    // Wait for Kafka to be ready with exponential backoff
    const waitTime = Math.min(5000 + retryCount * 2000, 30000); // Max 30 seconds
    logger.info(`Waiting for Kafka to be ready... (attempt ${retryCount + 1}/${maxRetries}, wait: ${waitTime}ms)`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));

    // create producer to create topics
    await connectProducer();
    logger.info("✅ Successfully created topics and connected producer");

    // start consuming events
    // await contestEventHandler.handle();
    await userEventHandler.handle();

    logger.info("✅ Successfully subscribed to user events");
  } catch (error: any) {
    logger.error(`Failed to initialize Kafka broker (attempt ${retryCount + 1}/${maxRetries}):`, error?.message || error);
    
    if (retryCount < maxRetries) {
      const nextRetryTime = Math.min(10000 + retryCount * 5000, 60000); // Max 60 seconds between retries
      logger.info(`Retrying Kafka initialization in ${nextRetryTime}ms...`);
      setTimeout(async () => {
        await BrokerInit(retryCount + 1, maxRetries);
      }, nextRetryTime);
    } else {
      logger.error("❌ Max Kafka connection retries reached. Service will continue without Kafka.");
      // Don't crash the service, just log the error
    }
  }
};

const AppInit = async () => {
  const expressApp: Express = express();

  expressApp.use(cors());
  expressApp.use(express.json());
  expressApp.use(attachRequestId);

  await BrokerInit();

  expressApp.use("/api/v1", WalletRouter);
  expressApp.get(
    `/${ServerConfigs.API_VERSION}/health-check`,
    async (req: Request, res: Response): Promise<Response> => {
      logger.debug("Sending response: Server running");
      return res.status(200).json({
        message: "server running...",
      });
    }
  );

  expressApp.use(ErrorMiddleware.handleError);
  return expressApp;
};

export default AppInit;
