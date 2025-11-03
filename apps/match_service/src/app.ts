import "reflect-metadata";
import { attachRequestId, ErrorMiddleware, logger } from "@repo/common";
import { container } from "tsyringe";
import cors from "cors";
import http from "http";
import express, { Express, Request, Response } from "express";
import ServerConfigs from "./configs/server.config";
import MatchRouter from "./routes/match.router";
import matchEventHandler from "./utils/events/match.events";
import matchCrons from "./utils/jobs/match";
import { connectProducer } from "./utils/kafka";
import { Server as SocketIOServer } from "socket.io";

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
    await matchEventHandler.handle();
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
  const server = http.createServer(expressApp);
  const io = new SocketIOServer(server, { cors: { origin: "*" } });

  // register io in tsyringe container so controllers/services can inject it
  container.registerInstance("SocketIO", io);

  // === add connection listener ===
  io.on("connection", (socket) => {
    console.log("[io] client connected:", socket.id, "from", socket.handshake.address);

    // allow client to join match rooms
    socket.on("join", (matchId: string) => {
      console.log(`[io] socket ${socket.id} joining room ${matchId}`);
      try { socket.join(matchId); } catch (e) { console.warn("join error", e); }
    });

    socket.on("leave", (matchId: string) => {
      socket.leave(matchId);
    });

    socket.on("disconnect", (reason) => {
      console.log("[io] client disconnected", socket.id, reason);
    });
  });

  expressApp.use(cors());
  expressApp.use(express.json());
  expressApp.use(attachRequestId);

  await BrokerInit();
  await CronsInit();

  expressApp.use("/api/v1", MatchRouter);
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
