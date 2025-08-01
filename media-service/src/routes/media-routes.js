import express from "express";
import multer from 'multer';
import {uploadMedia , getAllMedia} from "../controllers/media-controller.js";
// import getMediaByUser from "../controllers/getMediaByUser.js";
import authenticateRequest from "../middleware/authMiddleware.js";
import logger from '../utils/logger.js';

const router = express.Router();

// Configure multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    fieldNameSize: 100
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'video/mp4'];
    if (!allowedTypes.includes(file.mimetype)) {
      const error = new Error('Invalid file type');
      error.status = 400;
      return cb(error, false);
    }
    cb(null, true);
  }
}).single('file');

// Route: POST /upload
router.post('/upload', authenticateRequest, (req, res, next) => {
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      logger.error(`${req.method} ${req.originalUrl} - Multer error: ${err.message}`);
      return res.status(400).json({
        message: 'Multer error while uploading',
        error: err.message,
        stack: err.stack,
      });
    } else if (err) {
      logger.error(`${req.method} ${req.originalUrl} - Unknown upload error: ${err.message}`);
      return res.status(err.status || 400).json({
        message: 'Unknown error while uploading',
        error: err.message,
        stack: err.stack,
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: 'No file was uploaded',
      });
    }

    if (req.file.size === 0) {
      return res.status(400).json({
        message: 'Uploaded file is empty',
      });
    }

    logger.info(`${req.method} ${req.originalUrl} - File received: ${req.file.originalname} | Type: ${req.file.mimetype} | Size: ${req.file.size} bytes`);

    try {
      next();
    } catch (controllerError) {
      logger.error(`${req.method} ${req.originalUrl} - Error in uploadMedia controller: ${controllerError.message}`);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
}, uploadMedia);

router.get('/get',authenticateRequest , getAllMedia)

export default router;
