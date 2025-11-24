// src/index.ts
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { PORT, ROUTES } from "./config";
import logger from "./logger";
import { makeProxy } from "./proxy";

dotenv.config();

const app = express();


app.use(cors());

// Health and admin endpoints
app.get("/", (_req, res) => res.json({ ok: true, message: "wizplay-proxy" }));
app.get("/health", (_req, res) =>
  res.json({ ok: true, uptime: process.uptime() })
);
app.get("/_routes", (_req, res) =>
  res.json({
    success: true,
    data: ROUTES.map((r) => ({
      name: r.name,
      mountPath: r.mountPath,
      target: r.target,
    })),
  })
);

// Mount proxies from config
for (const route of ROUTES) {
  logger.info(
    { route: route.name, mount: route.mountPath, target: route.target, ws: route.ws },
    "Mounting proxy route"
  );
  const proxyMiddleware = makeProxy(route);
  app.use(route.mountPath, proxyMiddleware);
}

// fallback 404
app.use((_req, res) => res.status(404).json({ error: "Not Found" }));

const server = app.listen(PORT, () => {
  logger.info(`wizplay-proxy listening on port ${PORT}`);
});

// Set server timeout to 3 minutes for AI generation endpoints
server.timeout = 180000; // 3 minutes
server.keepAliveTimeout = 185000; // Slightly longer than timeout
