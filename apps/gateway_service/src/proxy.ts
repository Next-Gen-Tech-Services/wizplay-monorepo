// src/proxy.ts
import type { RequestHandler } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import type { ProxyRoute } from "./config";
import logger from "./logger";

/**
 * Create a proxy middleware for a route.
 * We cast to `any` when calling createProxyMiddleware to avoid TypeScript mismatch
 * between versioned Option types — runtime supports the callbacks.
 */
export function makeProxy(route: ProxyRoute): RequestHandler {
  const opts = {
    target: route.target,
    changeOrigin: route.changeOrigin ?? true,
    xfwd: true, // adds X-Forwarded-* headers
    ws: route.ws ?? false,
    secure: route.secure ?? true,
    timeout: route.timeoutMs ?? 30000, // socket timeout (ms)
    proxyTimeout: route.timeoutMs ?? 30000, // upstream response timeout (ms)
    keepAlive: true,
    pathRewrite: route.pathRewrite ?? undefined,
    logLevel: process.env.PROXY_LOG_LEVEL ?? "info",

    onError: (err: any, req: any, res: any) => {
      // more structured logging
      logger.error(
        {
          err: err?.message ?? err,
          route: route.name,
          url: req?.originalUrl ?? req?.url,
        },
        "Proxy onError"
      );

      // If client aborted, don't try to send JSON (it will fail)
      if (err && (err.code === "ECONNRESET" || err.code === "EPIPE")) {
        logger.warn({ code: err.code }, "Connection aborted");
      }

      if (!res.headersSent) {
        try {
          res
            .status(502)
            .json({ error: "Bad Gateway - Service temporarily unavailable" });
        } catch (e) {
          // swallow if headers already closed
          logger.warn("Unable to send error response: headers already sent");
        }
      }
    },

    onProxyReq: (proxyReq: any, req: any, res: any) => {
      // debug log for request forwarded
      logger.debug(
        {
          method: req.method,
          url: req.originalUrl ?? req.url,
          route: route.name,
          headers: req.headers,
        },
        "Proxying request"
      );

      // handle client abort: abort outgoing proxy request when client disconnects
      const onClientAbort = () => {
        logger.warn(
          { url: req.originalUrl ?? req.url },
          "Client aborted request; aborting proxy request"
        );
        try {
          proxyReq.abort && proxyReq.abort();
        } catch {}
      };
      req.on("aborted", onClientAbort);

      // set helpful header (optional)
      try {
        const rid = req.headers["x-request-id"] || `rid-${Date.now()}`;
        proxyReq.setHeader("x-request-id", rid);
      } catch {}
    },

    onProxyRes: (proxyRes: any, req: any, res: any) => {
      logger.debug(
        {
          status: proxyRes?.statusCode,
          url: req.originalUrl ?? req.url,
          route: route.name,
        },
        "Proxy received response"
      );

      // detect upstream aborted response
      proxyRes.on("aborted", () => {
        logger.warn(
          { url: req.originalUrl ?? req.url },
          "Upstream aborted response"
        );
      });
    },
  };

  // cast to any to avoid TS mismatches across http-proxy-middleware versions
  return createProxyMiddleware(opts as any);
}
