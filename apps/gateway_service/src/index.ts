// src/index.ts
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { PORT, ROUTES } from "./config";
import logger from "./logger";
import { makeProxy } from "./proxy";

dotenv.config();

const app = express();

// Basic middleware
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
    { route: route.name, mount: route.mountPath, target: route.target },
    "Mounting proxy route"
  );
  // mount as prefix so /api/v1/auth/send-otp goes to the auth service
  app.use(route.mountPath, makeProxy(route));
}

// fallback 404
app.use((_req, res) => res.status(404).json({ error: "Not Found" }));

app.listen(PORT, () => {
  logger.info(`wizplay-proxy listening on port ${PORT}`);
});
