import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";
import logger from "./utils/logger.js";
import { RateLimiterRedis } from "rate-limiter-flexible";
import Redis from "ioredis";
import rateLimit from "express-rate-limit";
import RedisStore from 'rate-limit-redis';
import routes from './routes/identity-service.js';
import errorhandler from './middleware/errorHandler.js';

dotenv.config();

// Ensure Mongo URI is provided
if (!process.env.MONGODB_URI) {
  logger.error("❗ MONGODB_URI is missing. Check your .env file.");
  process.exit(1);
}

// ✅ Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => logger.info("✅ Connected to MongoDB"))
  .catch((e) => {
    logger.error("❌ Mongo connection error", e);
    process.exit(1);
  });

const redisClient = new Redis(process.env.REDIS_URL);

const app = express();

// Middleware to clean URLs (remove trailing %0A or whitespace)
app.use((req, res, next) => {
  req.url = req.url.replace(/%0A$/, ''); // Remove trailing %0A
  next();
});

// Other middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Log incoming requests
// Replace your current logging middleware with this:
app.use((req, res, next) => {
  logger.info(`➡️  ${req.method} ${req.url}`);
  if (req.body && typeof req.body === 'object') {  // ← Only this line changed
    logger.info(`📝 Body: ${JSON.stringify(req.body)}`);
  }
  next();
});
// DDoS protection and rate limiting
const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: "middleware",
  points: 10,
  duration: 1,
});

app.use((req, res, next) => {
  rateLimiter
    .consume(req.ip)
    .then(() => next())
    .catch(() => {
      logger.warn(`Rate limit exceeded for IP : ${req.ip}`);
      res.status(429).json({ success: false, message: "Too many requests!!!" });
    });
});

// IP-based rate-limiting
const sensitiveEndpointsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Sensitive endpoint rate limit exceeded for IP : ${req.ip}`);
    res.status(429).json({
      success: false,
      message: "Too many requests on sensitive endpoint!"
    });
  },
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
  })
});

// Apply limiter
app.use('/api/auth/register', sensitiveEndpointsLimiter);

// Routes
app.use('/api/auth', routes);

// Add a GET handler for /api/auth/register to provide better error message
app.get('/api/auth/register', (req, res) => {
  res.status(405).json({
    success: false,
    message: 'Method Not Allowed. Please use POST for registration.'
  });
});

// Error handler
app.use(errorhandler);

// Sample route
app.get("/", (req, res) => {
  res.send("API is running...");
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at', promise, "reason:", reason);
});