import Media from "../models/Media.js";
import logger from "../utils/logger.js";
import {deleteMediaFromCloudinary} from '../utils/cloudinary.js'
// const {deleteMediaFromCloudinary} = cloudinaryUtils
export const handlePostDeleted = async (event) => {
  console.log(event, "eventeventevent");

  const { postId, mediaIds } = event;

  try {
    const mediaToDelete = await Media.find({ _id: { $in: mediaIds } });

    for (const media of mediaToDelete) {
      await deleteMediaFromCloudinary(media.publicId); // ✅ Correct function name
      await Media.findByIdAndDelete(media._id); // ✅ Fixed: was `findById`, which doesn't delete
      logger.info(`Deleted media ${media._id} associated with deleted post ${postId}`);
    }

    logger.info(`Processed deletion of media for post id ${postId}`);
  } catch (error) {
    logger.error('Error occurred while deleting media:', error);
  }
};
