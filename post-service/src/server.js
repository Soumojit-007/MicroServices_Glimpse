import dotenv from 'dotenv'
import express from 'express'
import mongoose from 'mongoose'
import Redis from 'ioredis'
import cors from 'cors'
import helemt from 'helmet'
import postRoutes from './routes/post-routes.js'
import errorHandler from './middleware/errorHandler.js'
import logger from './utils/logger.js'
import { connectToRabbitMQ } from './utils/rabbitmq.js'
dotenv.config()
let server = null;
const app = express()
const PORT = process.env.PORT || 3002
// ✅ Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => logger.info("✅ Connected to MongoDB"))
  .catch((e) => {
    logger.error("❌ Mongo connection error", e);
    process.exit(1);
  });

const redisClient = new Redis(process.env.REDIS_URL);


app.use(helemt())
app.use(cors())
app.use(express.json())

app.use((req,res,next) =>{
    logger.info(`Recieved ${req.method} request to ${req.url}`)
    logger.info(`Request body , ${req.body}`)
    next()
})

// *** Assignement - implement Ip based rate limiting for sensitive endpoints

//routes -> pass the redisclient as well
app.use('/api/posts' , (req,res,next) =>{
    req.redisClient = redisClient
    next()

},postRoutes)

app.use(errorHandler)

async function startServer() {
  try {
    logger.info('⏳ Attempting to connect to RabbitMQ...')
    await connectToRabbitMQ()
    logger.info('✅ Connected to RabbitMQ')

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

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at', promise, "reason:", reason);
});