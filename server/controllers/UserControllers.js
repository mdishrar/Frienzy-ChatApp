import User from "../Models/userModel.js"
import bcrypt from "bcryptjs"
import {generateToken} from "../lib/utils.js"
import cloudinary from "../lib/cloudinary.js"

export const signup = async (req,res) =>{
    try{
        const {fullName,email,password,bio} = req.body;

        if(!fullName || !email || !password || !bio){
            return res.json({success:false,message : "Please fill all the input fields"})
        }

        const user = await User.findOne({email});

        if(user){
            return res.json({success : false,message: 'Account Already exist'})
        }

        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password,salt)
        const newUser = await User.create({fullName,email,password : hashedPassword,bio});

        const token = await generateToken(newUser._id)
        console.log(token);

        return res.json({success:true,userData : newUser,token,message : "Account Created Successfully"})

    }catch(error){
        console.log("backend Signup error ",error);
        res.json({success:false,message:error.message})
    }
}

export const login = async (req,res) =>{
    try{
        const {email,password} = req.body;

        if(!email || !password){
            res.json({success:false,message : "Please fill all the input fields"})
        }

        const userData = await User.findOne({email})
        const hashedPassword = await bcrypt.compare(password,userData.password)

        if(!userData){
            return res.json({success:false,message : "Account does not exist"})
        }
        if(!hashedPassword){
            return res.json({success:false,message : "Password Incorrect"})
        }

        const token = await generateToken(userData._id);

        return res.json({success:true,userData,token,message : "Login successfully"})

        
    }catch(error){
        console.log('backend Login Error' , error);
        res.json({success:false,message : error.message})
    }
}

export const checkAuth = (req,res) =>{
    return res.json({success:true,user:req.user})
}

export const updateProfile = async (req,res) =>{
    try{
        const {fullName,profilePic,bio} = req.body;
        const userId =req.user._id; 
        let updatedUser;

        if(!profilePic){
            await User.findByIdAndUpdate(userId,{fullName,bio},{new:true})
        }
        else{
            const upload = await cloudinary.uploader.upload(profilePic)
            updatedUser = await User.findByIdAndUpdate(userId,{profilePic : upload.secure_url,bio,fullName},{new:true})
        }
        
        console.log(profilePic)
        return res.json({success:true,user:updatedUser})

    }catch(error){
        console.log('backend updateProfile Error' , error);
        res.json({success:false,message : error.message})
    }
}
