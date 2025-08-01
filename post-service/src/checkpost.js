import mongoose from 'mongoose';
import dotenv from 'dotenv';
import logger from './utils/logger.js';

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => logger.info("✅ Connected to MongoDB"))
  .catch(err => logger.error("❌ DB Connection Error", err));

// Define schema and model
const postSchema = new mongoose.Schema({}, { strict: false });
const Post = mongoose.model('Post', postSchema, 'posts');

// IIFE to fetch post
(async () => {
  try {
    const post = await Post.findById("688762ce28b25cc87a4c53de");

    if (post) {
      logger.info("✅ Post found!", post);
    } else {
      logger.info("⚠️ Post not found!");
    }
  } catch (error) {
    logger.error("❌ Error fetching post", error);
  } finally {
    mongoose.disconnect();
  }
})();
