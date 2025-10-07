// src/config.ts
export interface ProxyRoute {
  name: string;
  mountPath: string; // path to mount in proxy server
  target: string; // upstream base url
  changeOrigin?: boolean;
  ws?: boolean;
  pathRewrite?: Record<string, string>;
  timeoutMs?: number;
  secure?: boolean;
}

export const PORT = Number(process.env.PROXY_PORT ?? 8080);

export const ROUTES: ProxyRoute[] = [
  {
    name: "matches",
    mountPath: "/api/v1/matches",
    target: process.env.MATCHES_SERVICE_URL ?? "http://localhost:4003",
    changeOrigin: true,
    ws: false,
    pathRewrite: { "^/api/v1/matches": "/api/v1/matches" },
    timeoutMs: 15000,
  },
  {
    name: "coupons",
    mountPath: "/api/v1/coupons",
    target: process.env.COUPONS_SERVICE_URL ?? "http://localhost:4006",
    changeOrigin: true,
    ws: false,
    pathRewrite: { "^/api/v1/coupons": "/api/v1/coupons" },
    timeoutMs: 15000,
  },
  {
    name: "contests",
    mountPath: "/api/v1/contests",
    target: process.env.CONTEST_SERVICE_URL ?? "http://localhost:4007",
    changeOrigin: true,
    ws: false,
    pathRewrite: { "^/api/v1/contests": "/api/v1/contests" },
    timeoutMs: 15000,
  },
  {
    name: "auth",
    mountPath: "/api/v1/auth",
    target: process.env.AUTH_SERVICE_URL ?? "http://localhost:4002",
    changeOrigin: true,
    ws: false,
    pathRewrite: { "^/api/v1/auth": "/api/v1/auth" },
    timeoutMs: 15000,
  },
  {
    name: "user",
    mountPath: "/api/v1/user",
    target: process.env.USER_SERVICE_URL ?? "http://localhost:4001",
    changeOrigin: true,
    ws: false,
    pathRewrite: { "^/api/v1/user": "/api/v1/user" },
    timeoutMs: 15000,
  },
  {
    name: "wishlist",
    mountPath: "/api/v1/wishlist",
    target: process.env.USER_SERVICE_URL ?? "http://localhost:4001",
    changeOrigin: true,
    ws: false,
    pathRewrite: { "^/api/v1/wishlist": "/api/v1/wishlist" },
    timeoutMs: 15000,
  },
  {
    name: "questions",
    mountPath: "/api/v1/questions",
    target: process.env.CONTEST_SERVICE_URL ?? "http://localhost:4007",
    changeOrigin: true,
    ws: false,
    pathRewrite: { "^/api/v1/questions": "/api/v1/questions" },
    timeoutMs: 15000,
  },

  {
    name: "wallet",
    mountPath: "/api/v1/wallet",
    target: process.env.WALLET_SERVICE_URL ?? "http://localhost:4009",
    changeOrigin: true,
    ws: false,
    pathRewrite: { "^/api/v1/wallet": "/api/v1/wallet" },
    timeoutMs: 15000,
  },
  // {
  //   name: "socket",
  //   mountPath: "/ws",
  //   target: process.env.SOCKET_SERVICE_URL ?? "http://localhost:5000",
  //   changeOrigin: true,
  //   ws: true,
  //   pathRewrite: { "^/ws": "/" },
  //   timeoutMs: 30000,
  // },
];
