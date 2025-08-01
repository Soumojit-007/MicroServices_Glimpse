import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import Redis from "ioredis";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import logger from "./utils/logger.js";
import proxy from "express-http-proxy";
import errorHandler from "./middleware/errorhandler.js";
import validateToken from "./middleware/authMiddleware.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const redisClient = new Redis(process.env.REDIS_URL);

// ────────────── Global Middlewares ──────────────
app.use(helmet());
app.use(cors());

// Explicit JSON parser first (for fallback)
app.use(express.json());

// Smart JSON middleware (skip for media uploads)
app.use((req, res, next) => {
  const contentType = req.headers["content-type"] || "";
  const isMediaRoute = req.path.startsWith("/v1/media");

  if (!isMediaRoute && contentType.startsWith("application/json")) {
    express.json()(req, res, next);
  } else {
    next();
  }
});

// ────────────── Rate Limiting ──────────────
const ratelimitOptions = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: "Too many requests!",
    });
  },
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
  }),
});
app.use(ratelimitOptions);

// ────────────── Logger ──────────────
app.use((req, res, next) => {
  logger.info(`➡️  ${req.method} ${req.url}`);
  if (req.body && typeof req.body === "object") {
    logger.info(`📝 Body: ${JSON.stringify(req.body)}`);
  }
  next();
});

// ────────────── Proxy Options ──────────────
const proxyOptions = {
  proxyReqPathResolver: (req) => {
    const newPath = req.originalUrl.replace(/^\/v1/, "/api").trim();
    logger.info(`Proxying to: ${newPath}`);
    return newPath;
  },
  proxyErrorHandler: (err, res) => {
    logger.error(`Proxy Error: ${err.message}`);
    res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });
  },
};

// ────────────── IDENTITY SERVICE ──────────────
app.use(
  "/v1/auth",
  proxy(process.env.IDENTITY_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts) => {
      proxyReqOpts.headers["Content-Type"] = "application/json";
      return proxyReqOpts;
    },
    userResDecorator: (proxyRes, proxyResData) => {
      logger.info(`Response from Identity service: ${proxyRes.statusCode}`);
      return proxyResData;
    },
  })
);

// ────────────── POST SERVICE ──────────────
app.use(
  "/v1/posts",
  validateToken,
  proxy(process.env.POST_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers["Content-Type"] = "application/json";
      proxyReqOpts.headers["x-user-id"] = srcReq.user?.userId || "unknown";
      return proxyReqOpts;
    },
    userResDecorator: (proxyRes, proxyResData) => {
      logger.info(`Response from Post service: ${proxyRes.statusCode}`);
      return proxyResData;
    },
  })
);

// ────────────── MEDIA SERVICE ──────────────
app.use(
  "/v1/media",
  validateToken,
  proxy(process.env.MEDIA_SERVICE_URL, {
    ...proxyOptions,
    parseReqBody: false,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers["x-user-id"] = srcReq.user?.userId || "unknown";
      const contentType = srcReq.headers["content-type"];
      proxyReqOpts.headers["Content-Type"] = contentType?.startsWith("multipart/form-data")
        ? contentType
        : "application/json";
      return proxyReqOpts;
    },
    userResDecorator: (proxyRes, proxyResData) => {
      const status = proxyRes.statusCode;
      status >= 500
        ? logger.error(`Media service error: ${status}`)
        : logger.info(`Media service response: ${status}`);
      return proxyResData;
    },
    onError: (err, req, res) => {
      logger.error("Media service proxy error", err);
      res.status(502).json({ error: "Media service unavailable" });
    },
  })
);

// ────────────── SEARCH SERVICE ──────────────
// app.use(
//   "/v1/search",
//   validateToken,
//   proxy(process.env.SEARCH_SERVICE_URL, {
//     ...proxyOptions,
//     proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
//       proxyReqOpts.headers["Content-Type"] = "application/json";
//       proxyReqOpts.headers["x-user-id"] = srcReq.user?.userId || "unknown";
//       return proxyReqOpts;
//     },
//     userResDecorator: (proxyRes, proxyResData) => {
//       logger.info(`Response from Search service: ${proxyRes.statusCode}`);
//       return proxyResData;
//     },
//   })
// );

// ────────────── Global Error Handler ──────────────
app.use(errorHandler);

// ────────────── Server Boot ──────────────
app.listen(PORT, () => {
  logger.info(`🟢 API Gateway is running on port: ${PORT}`);
  logger.info(`🔐 Identity Service: ${process.env.IDENTITY_SERVICE_URL}`);
  logger.info(`📝 Post Service: ${process.env.POST_SERVICE_URL}`);
  logger.info(`📸 Media Service: ${process.env.MEDIA_SERVICE_URL}`);
  // logger.info(`🔍 Search Service: ${process.env.SEARCH_SERVICE_URL}`);
  logger.info(`📦 Redis: ${process.env.REDIS_URL}`);
});
