// packages/common/src/utils/logger.ts
import fs from "fs";
import path from "path";
import winston from "winston";

const { combine, timestamp, errors, printf, colorize } = winston.format;

// Simple log format
const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} ${level}: ${stack || message}`;
});

// Determine the correct log directory
// In a monorepo, we want logs in the service directory, not the package directory
function getLogDirectory(): string {
  // Use LOG_DIR environment variable if provided
  if (process.env.LOG_DIR) {
    return path.resolve(process.env.LOG_DIR);
  }

  // Default to logs directory in the current working directory
  // This works correctly when:
  // - Running from service directory: logs go to service/logs
  // - Running from monorepo root via turbo: logs go to root/logs (or can be overridden with LOG_DIR)
  return path.join(process.cwd(), "logs");
}

const logDir = getLogDirectory();

// Ensure logs folder exists
try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
} catch (error) {
  console.error("Failed to create logs directory:", error);
  // Fallback to console-only logging if file logging fails
}

// Determine log level from environment variable or default
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug");

// Create transports array
const transports: winston.transport[] = [];

// Try to add file transports, but don't fail if it doesn't work
try {
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, "server.log"),
      handleExceptions: true,
      handleRejections: true,
    })
  );
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
      handleExceptions: true,
      handleRejections: true,
    })
  );
} catch (error) {
  console.error("Failed to initialize file transports, falling back to console only:", error);
}

// Base winston logger
const baseLogger = winston.createLogger({
  level: logLevel,
  format: combine(timestamp(), errors({ stack: true }), logFormat),
  transports,
  exitOnError: false,
});

// Always add console in non-production, and optionally in production if CONSOLE_LOGS is enabled
if (process.env.NODE_ENV !== "production" || process.env.CONSOLE_LOGS === "true") {
  baseLogger.add(
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
      handleExceptions: true,
      handleRejections: true,
    })
  );
}

// Handle transport errors
baseLogger.on("error", (error) => {
  console.error("Logger error:", error);
});

// Function to get caller information
function getCallerInfo(): string {
  const stack = new Error().stack;
  if (!stack) return "";

  const stackLines = stack.split("\n");

  // Skip the first few lines: Error, getCallerInfo, and the logger method
  for (let i = 3; i < stackLines.length; i++) {
    const line = stackLines[i]?.trim();

    // Skip internal Node.js modules and winston
    if (
      line?.includes("at ") &&
      !line?.includes("node_modules") &&
      !line?.includes("internal/") &&
      !line?.includes("winston") &&
      !line?.includes("logger.ts") &&
      !line?.includes("logger.js") &&
      !line?.includes("globalLogger")
    ) {
      // Try to extract file path and line? number
      let match = line?.match(/\(([^)]+)\)/);
      if (!match) {
        match = line?.match(/at\s+(.+)/);
      }

      if (match && match[1]) {
        const fullPath = match[1].trim();

        // Check if it contains line and column info
        const pathParts = fullPath.split(":");
        if (pathParts.length >= 2) {
          const lineNumber = pathParts[pathParts.length - 2];
          const filePath = pathParts.slice(0, -2).join(":");

          // Extract relative path
          let relativePath = filePath;

          // Handle different path separators (Unix/Windows)
          const appsIndex = Math.max(
            filePath.lastIndexOf("/apps/"),
            filePath.lastIndexOf("\\apps\\")
          );
          const packagesIndex = Math.max(
            filePath.lastIndexOf("/packages/"),
            filePath.lastIndexOf("\\packages\\")
          );

          if (appsIndex !== -1) {
            relativePath = filePath.substring(appsIndex + 1);
          } else if (packagesIndex !== -1) {
            relativePath = filePath.substring(packagesIndex + 1);
          } else {
            relativePath = path.basename(filePath);
          }

          return `[${relativePath}:${lineNumber}] `;
        }
      }
      break;
    }
  }

  return "";
}

// Enhanced logger with caller info
export const logger = {
  info: (message: any, ...meta: any[]) => {
    const caller = getCallerInfo();
    const logMessage = `${caller}${message}`;
    baseLogger.info(logMessage, ...meta);
  },

  warn: (message: any, ...meta: any[]) => {
    const caller = getCallerInfo();
    const logMessage = `${caller}${message}`;
    baseLogger.warn(logMessage, ...meta);
  },

  error: (message: any, ...meta: any[]) => {
    const caller = getCallerInfo();
    const logMessage = `${caller}${message}`;
    baseLogger.error(logMessage, ...meta);
  },

  debug: (message: any, ...meta: any[]) => {
    const caller = getCallerInfo();
    const logMessage = `${caller}${message}`;
    baseLogger.debug(logMessage, ...meta);
  },
};

// Export the raw winston logger if needed
export const rawLogger = baseLogger;

// Default export
export default logger;
