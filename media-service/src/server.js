// ✅ Handle synchronous exceptions immediately
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

import dotenv from 'dotenv'
import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import helmet from 'helmet'
import mediaRoutes from './routes/media-routes.js'
import errorHandler from './middleware/errorHandler.js'
import logger from './utils/logger.js'
import { connectToRabbitMQ, consumeEvent } from './utils/rabbitmq.js';
import { handlePostDeleted } from './eventHandlers/media-event-handlers.js';
dotenv.config()

// ✅ Ensure required env var exists
if (!process.env.MONGODB_URI) {
  logger.error("❌ MONGODB_URI is not defined in .env");
  process.exit(1);
}

const app = express()
const PORT = process.env.PORT || 3003
let server = null

// ✅ Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => logger.info("✅ Connected to MongoDB"))
  .catch((e) => {
    logger.error("❌ Mongo connection error", e);
    process.exit(1);
  });

app.use(cors())
app.use(helmet())
app.use(express.json())

app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`);
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    logger.info(`Request body: ${JSON.stringify(req.body)}`);
  }
  next();
});

app.use('/api/media', mediaRoutes)
app.use(errorHandler)

async function startServer() {
  try {
    logger.info('⏳ Attempting to connect to RabbitMQ...')
    await connectToRabbitMQ()
    logger.info('✅ Connected to RabbitMQ')

    await consumeEvent('post.deleted' , handlePostDeleted)
    server = app.listen(PORT, () => {
      logger.info(`🚀 Server running on http://localhost:${PORT}`)
    })

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)

  } catch (error) {
    logger.error('❌ Failed to start server', {
      message: error.message,
      stack: error.stack,
    })
    process.exit(1)
  }
}


async function shutdown() {
  logger.info('🛑 Graceful shutdown initiated...')
  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) return reject(err)
          resolve()
        })
      })
      logger.info('✅ HTTP server closed')
    }

    if (redisClient) {
      await redisClient.quit()
      logger.info('🧹 Redis client disconnected')
    }

    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close()
      logger.info('🧹 MongoDB connection closed')
    }

    process.exit(0)
  } catch (error) {
    logger.error('❌ Error during shutdown', {
      message: error.message,
      stack: error.stack
    })
    process.exit(1)
  }
}

// ✅ Unhandled Promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason)
})

startServer()

app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
});

// ✅ Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at', promise, "reason:", reason);
});
