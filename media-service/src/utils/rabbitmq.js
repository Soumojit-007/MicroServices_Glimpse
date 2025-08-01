import amqp from "amqplib";
import logger from "./logger.js";
import dotenv from "dotenv";
dotenv.config();
let connection = null;
let channel = null;

const EXCHANGE_NAME = "facebook_events";
export async function connectToRabbitMQ() {
  try {
    logger.info(`Connecting to RabbitMQ at ${process.env.RABBITMQ_URL}`);

    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();

    await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });

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
        logger.warn(
          `⚠️ Failed to close RabbitMQ connection: ${closeErr.message}`
        );
      }
    }

    throw error;
  }
}

export async function publishEvent(routingKey, message) {
  try{
    if (!channel) {
    await connectToRabbitMQ();
  }
  const success = channel.publish(
    EXCHANGE_NAME,
    routingKey,
    Buffer.from(JSON.stringify(message))
  );
  if(!success){
    logger.warn(`Message was not sent to RabbitMQ for routingKey: ${routingKey}`);
  }else{
    logger.info(`Event published : ${routingKey}`);
  }
  }
  catch (err) {
    logger.error(`Failed to publish event: ${routingKey}`, err);
  }
}


export async function consumeEvent(routingKey, callBack) {
  if (!channel) {
    await connectToRabbitMQ();
  }

  // Create a temporary exclusive queue
  const q = await channel.assertQueue("", { exclusive: true });

  // Bind the queue to the exchange with the routing key
  await channel.bindQueue(q.queue, EXCHANGE_NAME, routingKey);

  // Start consuming messages
  channel.consume(q.queue, async (msg) => {
    if (msg !== null) {
      try {
        const content = JSON.parse(msg.content.toString());
        await callBack(content);
        channel.ack(msg);
      } catch (err) {
        logger.error(`Failed to process message on ${routingKey}`, err);
        // Optionally nack the message to discard or send to dead-letter queue
        // channel.nack(msg, false, false); // Uncomment if needed
      }
    }
  });

  logger.info(`Subscribed to event!!! : ${routingKey}`);
}
