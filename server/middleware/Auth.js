import jwt from "jsonwebtoken"
import User from "../Models/userModel.js";
import { redis } from "../server.js";

export const protectRoute = async (req,res,next) =>{
    try{
        const authHeader = req.headers.authorization || req.headers.Authorization;
        const token = req.headers.token || (typeof authHeader === "string" && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null);
        if(!token){
            return res.status(401).json({success:false,message:"Token not found"});
        }
        
        const decode = jwt.verify(token,process.env.JWT_ACCESS_TOKEN)
        let userData = await redis.get(`user:${decode.userId}`);

        if (userData) {
            try {
                userData = JSON.parse(userData);
                userData._id = decode.userId
            } catch {
                userData = null;
            }
        }

        let user = userData;
        if (!user) {
            user = await User.findById(decode.userId).select("-password")
        }

        if (!user) {
            return res.status(404).json({success:false,message:"User not found"});
        }

        if (typeof user === "string") {
            user = JSON.parse(user);
        }

        if (user && typeof user === "object") {
            const sanitizedUser = { ...user };
            delete sanitizedUser.password;
            user = sanitizedUser;
        }
        
        req.user = user;
        next();
    }catch(error){
        console.error("protectRoute error:", error.name, error.message);
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({ success: false, message: "Access token expired", isExpired: true });
        }
        return res.status(401).json({success:false,message:error.message})
    }
}