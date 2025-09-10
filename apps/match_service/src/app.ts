import { attachRequestId, ErrorMiddleware, logger } from "@repo/common";
import cors from "cors";
import express, { Express, Request, Response } from "express";
import ServerConfigs from "./configs/server.config";
import AuthRouter from "./routes/match.router";
import { UserEvents } from "./utils/events/user.events";
import matchCrons from "./utils/jobs/match";

import {
  connectProducer,
  publishUserEvent,
  subscribeToUserEvents,
} from "./utils/kafka";

const BrokerInit = async () => {
  try {
    // Wait for Kafka to be ready
    logger.info("Waiting for Kafka to be ready...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // create producer to create topics
    const producer = await connectProducer();
    logger.info("Successfully created topics");

    // start consuming events
    await subscribeToUserEvents();
    logger.info("Successfully subscribed to user events");

    // Example publishing event (maybe move this to after server starts)
    await publishUserEvent(UserEvents.USER_SIGNUP, {
      userId: "123",
      email: "abc@test.com",
    });
    logger.info("Test event published successfully");
  } catch (error) {
    logger.error("Failed to initialize Kafka broker:", error);
    setTimeout(async () => {
      logger.info("Retrying Kafka initialization...");
      await BrokerInit();
    }, 10000);
  }
};

const CronsInit = async () => {
  try {
    logger.info("Waiting for crons to be initialized...");
    await matchCrons.scheduleJob();
    logger.info("Cron jobs scheduled successfully");
  } catch (error) {
    logger.error("Failed to initialize cron jobs:", error);
  }
};

const AppInit = async () => {
  const expressApp: Express = express();

  expressApp.use(cors());
  expressApp.use(express.json());
  expressApp.use(attachRequestId);

  await BrokerInit();
  await CronsInit();

  expressApp.use("/api/v1", AuthRouter);
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
