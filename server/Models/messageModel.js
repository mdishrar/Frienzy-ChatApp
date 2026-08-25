import mongoose from "mongoose";

const MessageModel = new mongoose.Schema({
    receiverId : {type: mongoose.Schema.Types.ObjectId,ref:"User",},
    senderId : {type: mongoose.Schema.Types.ObjectId,ref:"User",required:true},
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", default: null },
    seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    seen : {type : Boolean,default : false},
    deletefor : [{type:mongoose.Schema.Types.ObjectId,ref:"User"}],
    text : {type: String},
    image : {type : String},
    audio : {type : String},
    callDetails: {
      callType:    { type: String, enum: ["video", "audio"] },
      callStatus:  { type: String, enum: ["missed", "declined", "completed"], default: "missed" },
      callDuration: { type: Number, default: 0 }, 
      startedAt:   { type: Date },
    }
},{timestamps : true})

const Message = mongoose.model("Message",MessageModel);

export default Message;