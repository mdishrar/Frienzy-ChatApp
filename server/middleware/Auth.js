import jwt from "jsonwebtoken"
import User from "../Models/userModel.js";

export const protectRoute = async (req,res,next) =>{
    try{
        const token = req.headers.token;
    
        if(!token){
            return res.status(401).json({success:false,message:"Token not found"});
        }
        

        const decode = jwt.verify(token,process.env.JWT_SECRET)
        const user =  await User.findById(decode.userId).select("-password")

        if(!user){
            return res.status(401).json({success:false,message:"User not found"});
        }

        req.user = user;
        next();
    }catch(error){
        console.log(error);
        return res.status(401).json({success:false,message:error.message})
    }
}