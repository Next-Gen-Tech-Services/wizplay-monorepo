import "reflect-metadata";
import dotenv from "dotenv";
import { createApp } from "./app";
import { connectDB } from "./configs/database.config";
import ServerConfigs from "./configs/server.config";
import { initializeKafkaConsumer } from "./utils/kafka.consumer";
import { logger } from "@repo/common";

// Load environment variables
dotenv.config();

const startServer = async () => {
  try {
    // Connect to database
    logger.info("Connecting to database...");
    await connectDB();
    logger.info("Database connected successfully");

    // Initialize Kafka consumer
    logger.info("Initializing Kafka consumer...");
    await initializeKafkaConsumer();
    logger.info("Kafka consumer initialized successfully");

    // Create Express app
    const app = createApp();

    // Start server
    const PORT = ServerConfigs.PORT || "5006";
    app.listen(PORT, () => {
      logger.info(`Notification service started on port ${PORT}`);
      logger.info(`Environment: ${ServerConfigs.NODE_ENV}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM signal received: closing HTTP server");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT signal received: closing HTTP server");
  process.exit(0);
});

// Start the server
startServer();
