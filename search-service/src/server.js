import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import cors from 'cors';
import helmet from 'helmet';
import errorHandler from './middleware/errorHandler.js';
import logger from './utils/logger.js';
import { connectToRabbitMQ, consumeEvent } from './utils/rabbitmq.js';
import searchRoutes from './routes/search-routes.js';
import handlePostCreated from './eventHandlers/search-event-handler.js';
// import Search from './models/Search.js';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => logger.info('✅ Connected to MongoDB'))
  // await Search.syncIndexes();
  // logger.info('🔍 Search indexes synced')
  .catch((e) => {
    logger.error('❌ Mongo connection error', e);
    process.exit(1);
  });

// Redis Connection
const redisClient = new Redis(process.env.REDIS_URL);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Logging Middleware
app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`);
  logger.info(`Request body: ${JSON.stringify(req.body)}`);
  next();
});

// Routes
app.use('/api/search', searchRoutes);

// Error Handler
app.use(errorHandler);

// RabbitMQ Setup
async function startServer() {
  try {
    await connectToRabbitMQ();
    await consumeEvent('post-created', handlePostCreated);
  } catch (error) {
    logger.error(error, 'Failed to start search service');
    process.exit(1);
  }
}

// Start Express Server + RabbitMQ Consumer
app.listen(PORT, () => {
  logger.info(`🚀 Search service running on port ${PORT}`);
  startServer();
});
