import logger from "../utils/logger.js";
import jwt from "jsonwebtoken";

const validateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];

  // 1. Check if Authorization header exists and is properly formatted
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.warn("Malformed or missing Authorization header!");
    return res.status(401).json({
      message: "Authentication required",
      success: false,
    });
  }

  const token = authHeader.split(" ")[1];

  // Optional: Log the token for debugging (comment this out in production)
  logger.info("Token received:", token);

  // 2. Check if JWT_SECRET is actually set
  if (!process.env.JWT_SECRET) {
    logger.error("JWT_SECRET is not defined in environment!");
    return res.status(500).json({
      message: "Server configuration error",
      success: false,
    });
  }

  // 3. Verify token
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === "TokenExpiredError") {
        logger.warn("Expired token!", { token });
        return res.status(401).json({
          message: "Token expired",
          success: false,
        });
      }

      logger.warn("Invalid token!", { error: err.message, token });
      return res.status(403).json({
        message: "Invalid Token",
        success: false,
      });
    }

    // 4. Attach user data to the request
    req.user = user;
    next();
  });
};

export default validateToken;
