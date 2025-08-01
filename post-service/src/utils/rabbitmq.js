import amqp from "amqplib";
import logger from "./logger.js";
import dotenv from "dotenv";
dotenv.config();

let connection = null;
let channel = null;

const EXCHANGE_NAME = "facebook_events";

export async function connectToRabbitMQ() {
  if (channel) return channel;

  try {
    logger.info(`Connecting to RabbitMQ at ${process.env.RABBITMQ_URL}`);

    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();

    // Durable exchange for persistence across RabbitMQ restarts
    await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });

    // ✅ Handle connection-level errors
    connection.on("error", (err) => {
      logger.error("[RabbitMQ Connection Error]", err);
    });

    connection.on("close", () => {
      logger.warn("[RabbitMQ Connection Closed]");
    });

    // ✅ Handle channel-level errors
    channel.on("error", (err) => {
      logger.error("[RabbitMQ Channel Error]", err);
    });

    channel.on("close", () => {
      logger.warn("[RabbitMQ Channel Closed]");
    });

    logger.info("✅ Connected to RabbitMQ");
    return channel;
  } catch (error) {
    logger.error("❌ Error connecting to RabbitMQ", {
      url: process.env.RABBITMQ_URL,
      code: error.code,
      message: error.message,
      stack: error.stack,
    });

    // Attempt to close half-open connection
    if (connection) {
      try {
        await connection.close();
      } catch (closeErr) {
        logger.warn(`⚠️ Failed to close RabbitMQ connection: ${closeErr.message}`);
      }
    }

    throw error;
  }
}

export async function publishEvent(routingKey, message) {
  try {
    if (!channel) {
      await connectToRabbitMQ();
    }

    const success = channel.publish(
      EXCHANGE_NAME,
      routingKey,
      Buffer.from(JSON.stringify(message))
    );

    if (!success) {
      logger.warn(`Message was not sent to RabbitMQ for routingKey: ${routingKey}`);
    } else {
      logger.info(`Event published : ${routingKey}`);
    }
  } catch (err) {
    logger.error(`Failed to publish event: ${routingKey}`, err);
  }
}
