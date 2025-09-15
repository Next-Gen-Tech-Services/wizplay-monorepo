import { attachRequestId, ErrorMiddleware, logger } from "@repo/common";
import cors from "cors";
import express, { Express, Request, Response } from "express";
import ServerConfigs from "./configs/server.config";
import ContestRouter from "./routes/contest.router";
import userEventHandler from "./utils/events/contest.events";
import { connectProducer } from "./utils/kafka";

const BrokerInit = async () => {
  try {
    // Wait for Kafka to be ready
    logger.info("Waiting for Kafka to be ready...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // create producer to create topics
    await connectProducer();
    logger.info("Successfully created topics");

    // start consuming events
    await userEventHandler.handle();
    logger.info("Successfully subscribed to user events");
  } catch (error) {
    logger.error("Failed to initialize Kafka broker:", error);
    setTimeout(async () => {
      logger.info("Retrying Kafka initialization...");
      await BrokerInit();
    }, 10000);
  }
};

const AppInit = async () => {
  const expressApp: Express = express();

  expressApp.use(cors());
  expressApp.use(express.json());
  expressApp.use(attachRequestId);

  await BrokerInit();

  expressApp.use("/api/v1", ContestRouter);
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
