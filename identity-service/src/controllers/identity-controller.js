// user-registration
import logger from "../utils/logger.js";
import {validateRegistration , validatelogin}  from "../utils/validation.js";
import User from "../models/user.js";
import generateTokens from "../utils/generateToken.js";
import RefreshToken from "../models/RefreshToken.js";

export const registerUser = async (req, res) => {
  logger.info("Registration endpoint hit...");
  try {
    // Validate the schema
    const { error } = validateRegistration(req.body);
    if (error) {
      logger.warn("Validation error: " + error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const { email, password, username } = req.body;

    // Check for existing user
    let existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      logger.warn("User already exists with this email or username");
      return res.status(400).json({
        success: false,
        message: "User already exists with this email or username",
      });
    }

    // Create new user
    const user = new User({ username, email, password });
    await user.save();

    logger.info("User saved successfully: " + user._id);

    const { accessToken, refreshToken } = await generateTokens(user);

    res.status(201).json({
      success: true,
      message: "User created successfully",
      accessToken,
      refreshToken,
    });
  } catch (e) {
    logger.error("Registration error occurred", e);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


//user-login
export const loginUser = async(req,res) =>{
  logger.info("Login endpoint hit")
  try {
    const {error} = validatelogin(req.body)
    if (error) {
      logger.warn("Validation error: " + error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }
    const {email , password} = req.body
    const user = await User.findOne({email})
    if(!user){
      logger.warn('Invalid User')
      return res.status(400).json({
        success : false,
        message : 'Invalid credentials'
      })
    }

    //valid password or not
    const isValidPassword = await user.comparePassword(password)
    if(!isValidPassword){
      logger.warn('Invalid Password')
      return res.status(400).json({
        success : false,
        message : 'Invalid Password'
      })
    }

    const {accessToken , refreshToken} = await generateTokens(user)
    res.json({
      accessToken,
      refreshToken,
      userId : user._id
    })
  }  catch (e) {
    logger.error("Registration error occurred", e);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

//refresh token
export const refreshTokenUser = async (req, res) => {
  logger.info("Refresh token endpoint hit...");
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      logger.warn('Refresh token is missing');
      return res.status(400).json({
        success: false,
        message: "Refresh token missing..."
      });
    }

    const storedToken = await RefreshToken.findOne({ token: refreshToken });

    if (!storedToken) {
      logger.warn('Refresh token not found');
      return res.status(400).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    if (storedToken.expiresAt < new Date()) {
      logger.warn('Refresh token expired');
      return res.status(400).json({
        success: false,
        message: 'Refresh token has expired'
      });
    }

    const user = await User.findById(storedToken.user);
    if (!user) {
      logger.warn('User not found');
      return res.status(400).json({
        success: false,
        message: 'User not found!!!'
      });
    }

    const {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    } = await generateTokens(user);

    // Delete the old refresh token
    await RefreshToken.deleteOne({ _id: storedToken._id });

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      userId: user._id
    });

  } catch (e) {
    logger.error("Refresh token error occurred", e);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


//logoutUser
export const logoutUser = async(req,res) =>{
  logger.info("Logout endpoint hit")
  try {
    const {refreshToken} = req.body
    if(!refreshToken){
      logger.warn('No refresh token provided');
      return res.status(400).json({
        success : false,
        message : "Refresh token missing"
      })
    }
    await RefreshToken.deleteOne({token : refreshToken})
    logger.info('Refresh token deleted for logout')
    res.json({
      success: true,
      message : "Logged out successfully"
    })
  } catch (error) {
    logger.error("Error while logging out" , error);
    res.status(500).json({
      success : false,
      message : "Internal server error"
    })
  }
}