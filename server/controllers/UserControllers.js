import User from "../Models/userModel.js"
import bcrypt from "bcrypt"
import { generateAccessToken, generateRefreshToken } from "../lib/utils.js"
import cloudinary from "../lib/cloudinary.js"
import { redis } from "../server.js"
import jwt from "jsonwebtoken";


const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

const refreshKey = (userId) => `refresh:${userId}`;
const userCacheKey = (userId) => `user:${userId}`;
const emailCacheKey = (email) => `email:${email}`;
const isProduction = process.env.NODE_ENV === "production";

const baseCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  path: "/",
  ...(isProduction ? { partitioned: true } : {}),
};

const cookieOptions = {
  ...baseCookieOptions,
  maxAge: REFRESH_TTL_SECONDS * 1000,
};

const sanitizeUser = (userDoc) => {
  const user = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
  delete user.password;
  return user;
};

const cacheUser = async (user) => {
  try {
    await redis.pipeline()
      .set(userCacheKey(user._id), JSON.stringify({
        email: user.email,
        fullName: user.fullName,
        bio: user.bio,
        password: user.password,
        profilePic: user.profilePic,
      }), "EX", REFRESH_TTL_SECONDS)
      .set(emailCacheKey(user.email), user._id.toString(), "EX", REFRESH_TTL_SECONDS)
      .exec();
  } catch (err) {
    console.error("[cache] failed to cache user (non-fatal):", err.message);
  }
};

const invalidateUserCache = async (userId) => {
  try {
    await redis.del(userCacheKey(userId));
  } catch (err) {
    console.error("[cache] failed to invalidate user cache (non-fatal):", err.message);
  }
};

export const signup = async (req, res) => {
  try {
    const { fullName, email, password, bio } = req.body;

    if (!fullName || !email || !password || !bio) {
      return res.status(400).json({ success: false, message: "Please fill all the input fields" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: "Account already exists" });
    }
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password,salt);
    const newUser = await User.create({ fullName, email, password: hashedPassword, bio });

    if(!newUser){ return res.status(500).json({success:false,message: "undefined input"})}

    const [accessToken, refreshToken] = await Promise.all([
      generateAccessToken(newUser._id),
      generateRefreshToken(newUser._id)
    ]);

    await redis.set(refreshKey(newUser._id), refreshToken, "EX", REFRESH_TTL_SECONDS);
    await cacheUser(newUser);

    res.cookie("refreshToken", refreshToken, cookieOptions);

    return res.status(201).json({
      success: true,
      userData: sanitizeUser(newUser),
      accessToken,
      message: "Account Created Successfully"
    });
  } catch (error) {
    console.log("backend Signup error ", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Please fill all the input fields" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const cachedUserId = await redis.get(emailCacheKey(normalizedEmail));

    let userData = null;

    if (cachedUserId) {
      const cachedUser = await redis.get(userCacheKey(cachedUserId));
      if (cachedUser) {
        try {
          userData = JSON.parse(cachedUser);
          userData._id = cachedUserId;
        } catch {
          userData = null;
        }
      }
    }

    if (!userData) {
      userData = await User.findOne({ email: normalizedEmail }).lean();

      // Cache miss but user exists in Mongo — warm the cache for next time.
      if (userData) {
        await cacheUser(userData);
      }
    }

    if (!userData) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const userId = userData._id?.toString?.() ?? userData._id;
    const passwordOk = await bcrypt.compare(password,userData.password);

    if (!passwordOk) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }
    const [accessToken, refreshToken] = await Promise.all([
      generateAccessToken(userId),
      generateRefreshToken(userId)
    ]);

    await redis.set(refreshKey(userId), refreshToken, "EX", REFRESH_TTL_SECONDS);

    res.cookie("refreshToken", refreshToken, cookieOptions);

    return res.status(200).json({
      success: true,
      userData: sanitizeUser(userData),
      accessToken,
      message: "Logged in successfully"
    });
  } catch (error) {
    console.log("backend Login Error", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const checkAuth = (req, res) => {
  return res.status(200).json({ success: true, user: req.user });
};

export const refreshTokenExchange = async (req, res) => {
  try {
    const oldToken = req.cookies.refreshToken;
    if (!oldToken) {
      return res.status(401).json({ success: false, message: "No refresh token provided" });
    }

    let payload;
    try {
      payload = jwt.verify(oldToken, process.env.JWT_REFRESH_TOKEN);
    } catch (error) {
      console.log(error)
      return res.status(403).json({ success: false, message: "Invalid or expired refresh token" });
    }
 
    const storedToken = await redis.get(refreshKey(payload.userId));

    if (storedToken !== oldToken) {
      await redis.del(refreshKey(payload.userId));
      res.clearCookie("refreshToken", baseCookieOptions);
      return res.status(403).json({ success: false, message: "Session revoked, please log in again" });
    }

    const newRefreshToken = await generateRefreshToken(payload.userId);
    const newAccessToken = await generateAccessToken(payload.userId);

    await redis.set(refreshKey(payload.userId), newRefreshToken, "EX", REFRESH_TTL_SECONDS);

    res.cookie("refreshToken", newRefreshToken, cookieOptions);
    return res.status(200).json({ success: true, accessToken: newAccessToken,tokenExpired:false });
    
  } catch (error) {
    console.log("backend refreshTokenExchange Error", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { fullName, profilePic, bio } = req.body;
    const userId = req.user._id;
    let updatedUser;

    if (!profilePic) {
      updatedUser = await User.findByIdAndUpdate(userId, { fullName, bio }, { new: true });
    } else {
      const upload = await cloudinary.uploader.upload(profilePic);
      updatedUser = await User.findByIdAndUpdate(
        userId,
        { profilePic: upload.secure_url, bio, fullName },
        { new: true }
      );
    }

    await invalidateUserCache(userId);

    return res.json({ success: true, user: sanitizeUser(updatedUser) });
  } catch (error) {
    console.log("backend updateProfile Error", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const logout = async (req,res) =>{
  try{
    const userId = req.user._id;
    await redis.del(refreshKey(userId))
    res.clearCookie("refreshToken", baseCookieOptions);
    return res.status(200).json({success : true})
  }catch(error){
    console.log(error);
    res.status(401).json({success:false,message:error.message})
  }
}