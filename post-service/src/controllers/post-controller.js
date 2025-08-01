// import { error } from 'winston'
import logger from "../utils/logger.js";
import Post from "../models/Post.js";
import { validateCreatePost } from "../utils/validation.js";
import { publishEvent } from "../utils/rabbitmq.js";



async function invalidatePostCache(req, input) {
  const cacheKey = `post:${input}`;
  const keys = await req.redisClient.keys("post:*");

  if (keys.length > 0) {
    await req.redisClient.del(...keys); // ✅ uses req.redisClient correctly
    console.log(`Deleted ${keys.length} post cache keys`);
  } else {
    await req.redisClient.del(cacheKey);
    console.log(`Deleted individual cache key: ${cacheKey}`);
  }
}

export const createPost = async (req, res) => {
  try {
    const { error, value } = validateCreatePost(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((err) => err.message),
      });
    }

    const { content, mediaIds } = value;

    const newlyCreatedPost = new Post({
      user: req.user.userId,
      content,
      mediaIds: mediaIds || [],
    });

    await newlyCreatedPost.save();
    await publishEvent('post.created', {
      postId : newlyCreatedPost._id.toString(),
      userId : newlyCreatedPost.user.toString(),
      content : newlyCreatedPost.content,
      createdAt : newlyCreatedPost.createdAt
    })
    await invalidatePostCache(req, newlyCreatedPost._id.toString());

    logger.info(
      `Post created successfully: ${JSON.stringify(
        newlyCreatedPost.toObject()
      )}`
    );

    res.status(201).json({
      success: true,
      message: "Post created successfully",
    });
  } catch (error) {
    logger.error(`Error creating post: ${error.message}`, { error });
    res.status(500).json({
      success: false,
      message: "Error creating post",
    });
  }
};


export const getAllPosts = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);
    const startIndex = (page - 1) * limit;

    const cacheKey = `posts:${page}:${limit}`;
    const cachePosts = await req.redisClient.get(cacheKey);
    if (cachePosts) {
      return res.json(JSON.parse(cachePosts));
    }

    const posts = await Post.find({})
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit);
    const totalNoOfPosts = await Post.countDocuments();

    const result = {
      posts,
      currentPage: page,
      totalPages: Math.ceil(totalNoOfPosts / limit),
      totalPosts: totalNoOfPosts,
    };

    await req.redisClient.setex(cacheKey, 300, JSON.stringify(result));
    res.json(result);
  } catch (error) {
    logger.error("Error fetching post", error);
    res.status(500).json({
      success: false,
      message: "Error fetching post",
    });
  }
};

export const getPost = async (req, res) => {
  try {
    const postId = req.params.id;
    const cacheKey = `post:${postId}`;
    const cachedPost = await req.redisClient.get(cacheKey);

    if (cachedPost) {
      return res.json(JSON.parse(cachedPost));
    }

    const singlePostDetailsId = await Post.findById(postId).populate("mediaIds");
    if (!singlePostDetailsId) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    const postData = JSON.stringify(singlePostDetailsId.toObject());
    logger.info(postData); // ✅ log separately
    await req.redisClient.setex(cacheKey, 3600, postData); // ✅ store the correct value

    res.json(singlePostDetailsId);
  } catch (error) {
    logger.error("Error fetching post", error);
    res.status(500).json({
      success: false,
      message: "Error fetching post by ID",
    });
  }
};

export const deletePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user?.userId;
    const isAdmin = req.user?.isAdmin;

    logger.debug(`Attempting to delete post with ID: ${postId}`);
    logger.debug(`Authenticated user ID: ${userId}`);
    logger.debug(`Is user admin: ${isAdmin}`);

    // Optional: log the post beforehand to help with debugging
    const existingPost = await Post.findById(postId);
    if (!existingPost) {
      logger.warn(`Post with ID ${postId} does not exist in the database.`);
      return res.status(404).json({
        message: "Post not found",
        success: false,
      });
    }

    logger.debug(`Post found in DB: ${JSON.stringify(existingPost)}`);
    logger.debug(`Post owner ID: ${existingPost.user}`);

    // Build deletion filter
    const filter = { _id: postId };
    if (!isAdmin) {
      filter.user = userId; // Only restrict by user if not admin
    }

    // Try to delete the post
    const post = await Post.findOneAndDelete(filter);

    if (!post) {
      logger.warn(`Post with ID ${postId} not found or not owned by user ${userId}`);
      return res.status(403).json({
        message: "Not authorized to delete this post",
        success: false,
      });
    }

    // Invalidate cache (if needed)
    //publish post delete method
    
    logger.debug(`Publishing delete event for post ${postId}`);
    await publishEvent('post.deleted' , {
      postId : post._id.toString(),
      userId : req.user.userId,
      mediaIds : post.mediaIds
    })

    try {
      await invalidatePostCache(req, postId);
    } catch (cacheErr) {
      logger.warn(`Cache invalidation failed for post ${postId}`, cacheErr);
    }

    res.json({
      message: "Post deleted successfully",
      success: true,
    });

  } catch (error) {
    logger.error("Error deleting post", error);
    res.status(500).json({
      success: false,
      message: "Error deleting post by ID",
    });
  }
};
