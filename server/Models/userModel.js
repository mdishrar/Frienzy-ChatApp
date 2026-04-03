import mongoose from "mongoose"

const UserModel = new mongoose.Schema({
    fullName : {type : String,required:true,maxlength:10},
    email : {type : String,required:true,unique:true},
    password : {type : String,required:true,minlength:6},
    profilePic : {type : String,default:""},
    bio : {type : String},
},{timeseries:true})

const User = mongoose.model("User",UserModel);
export default User;