// packages/common/src/utils/logger.ts
import fs from "fs";
import path from "path";
import winston from "winston";

const { combine, timestamp, errors, printf, colorize, json } = winston.format;

const isProduction = process.env.NODE_ENV === "production";

// Simple log format for console output
const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} ${level}: ${stack || message}`;
});

const logDir = path.join(process.cwd(), "logs");

// Ensure logs folder exists with error handling
try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
} catch (err) {
  // Log to console if we can't create the logs directory
  console.error(`Failed to create logs directory at ${logDir}:`, err);
}

// Build transports array
const transports: winston.transport[] = [];

// Always add console transport - in production, Docker/Kubernetes captures stdout/stderr
transports.push(
  new winston.transports.Console({
    format: isProduction
      ? combine(timestamp(), errors({ stack: true }), json())
      : combine(colorize(), timestamp(), errors({ stack: true }), logFormat),
  })
);

// Add file transports only if directory exists and is writable
try {
  if (fs.existsSync(logDir)) {
    // File transport format - use JSON in production, simple format in development
    const fileFormat = isProduction
      ? combine(timestamp(), errors({ stack: true }), json())
      : combine(timestamp(), errors({ stack: true }), logFormat);

    const serverLogTransport = new winston.transports.File({
      filename: path.join(logDir, "server.log"),
      format: fileFormat,
    });
    const errorLogTransport = new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
      format: fileFormat,
    });

    // Handle file transport errors
    serverLogTransport.on("error", (err) => {
      console.error("Error writing to server.log:", err);
    });
    errorLogTransport.on("error", (err) => {
      console.error("Error writing to error.log:", err);
    });

    transports.push(serverLogTransport, errorLogTransport);
  }
} catch (err) {
  console.error("Failed to setup file transports:", err);
}

// Base winston logger - each transport defines its own format
const baseLogger = winston.createLogger({
  level: "info",
  format: combine(timestamp(), errors({ stack: true })),
  transports,
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
