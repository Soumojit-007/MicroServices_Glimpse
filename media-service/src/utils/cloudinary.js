import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import logger from './logger.js';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

// Upload media
export const uploadMediaToCloudinary = (file) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: 'auto' },
      (error, result) => {
        if (error) {
          logger.error('Error while uploading media to Cloudinary:', error);
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    uploadStream.end(file.buffer);
  });
};

// Delete media
export const deleteMediaFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    logger.info('Media deleted successfully from the cloud storage:', publicId);
    return result;
  } catch (error) {
    logger.error('Error deleting media from Cloudinary:', error);
    throw error;
  }
};

// export default {uploadMediaToCloudinary , deleteMediaFromCloudinary}