import Message from "../Models/messageModel.js";
import User from "../Models/userModel.js";
import cloudinary from "../lib/cloudinary.js"; 
import { io,getSocketId } from "../server.js";
import {randomUUID} from "crypto"
import Group from "../Models/GroupModel.js"
import { redis } from "../server.js";

export const getUsersforSidebars = async (req,res) =>{
    try{
        
        const userId = req.user._id;
        const filteredUsers = await User.find({_id:{$ne : userId}}).select('-password');
        const filteredGroups = await Group.find({ members: userId });
        const infoAboutFilteredGroups={};

        for (const group of filteredGroups) {
            const keys = group.members.map(id => `user:${id}`);
            const cachedUsers = await redis.mget(...keys);
        
            for (let i = 0; i < group.members.length; i++) {
                const memberId = group.members[i];
                if (cachedUsers[i]) {
                    const userdata = JSON.parse(cachedUsers[i]);
                    delete userdata.password;
                    infoAboutFilteredGroups[memberId] = userdata;
                } else {
                    const user = await User.findById(memberId).lean();
                    infoAboutFilteredGroups[memberId] = user;
                }
            }
        }
        
        const unseenMessages = {};
        const promises = filteredUsers.map(async (user)=>{
            const messages = await Message.find({senderId: user._id,receiverId:userId,seen:false})
            if(messages.length > 0){
                unseenMessages[user._id] = messages.length;
            }
        })
        
        const groupPromises = filteredGroups.map(async (group)=>{
            const count = await Message.countDocuments({groupId:group._id,senderId:{$ne:userId},seenBy:{$ne : userId}})
            if(count > 0){
                unseenMessages[group._id] = count;
            }
        })
        await Promise.all([...promises,...groupPromises]);
        res.status(200).json({success:true,users : filteredUsers,groups:filteredGroups,unseenMessages:unseenMessages,informAboutGroup:infoAboutFilteredGroups});
    }catch(error){
        console.log(error.message);
        res.json({success:false,messages: error.message})
    }
}

export const getMessages= async (req,res) =>{
    try{
        const {id:selectedUserId} = req.params;
        const myId = req.user._id;

        const messages = await Message.find({
            $or : [
                {senderId:myId,receiverId:selectedUserId},
                {senderId:selectedUserId,receiverId:myId},
            ],
            deletefor: { $ne: myId },
        });
        await Message.updateMany({senderId:selectedUserId,receiverId:myId},{seen:true});
        res.json({success:true,messages})
    }catch(error){
        console.log(error.message);
        res.json({success:false,messages: error.message})
    }
}

export const getGroupMessages = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const myId = req.user._id;
    const group = await Group.findOne({ _id: groupId, members: myId });
    if (!group) {
      return res.status(403).json({ success: false, message: "Not a member of this group" });
    }

    const messages = await Message.find({
      groupId,
      deletefor: { $ne: myId },
    });

    await Message.updateMany(
      { groupId, senderId: { $ne: myId }, seenBy: { $ne: myId } },
      { $addToSet: { seenBy: myId } }
    );

    res.status(200).json({ success: true, messages });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markMessageAsSeen =  async (req,res) =>{
    try{
        const {id}  = req.params;
        const myId = req.user._id;

        const message = await Message.findOneAndUpdate({_id:id,receiverId:myId},{seen:true},{new:true})
        if (!message) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }
        res.json({success:true})
    }catch(error){
        console.log(error.message);
        res.json({success:false,messages: error.message})
    }
}

export const markGroupMessageAsSeen = async (req, res) => {
  try {
    const { id } = req.params;
    const myId = req.user._id;

    const message = await Message.findOneAndUpdate(
      { _id: id, groupId: { $ne: null }, seenBy: { $ne: myId } },
      { $addToSet: { seenBy: myId } },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    res.status(200).json({ success: true, message });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const CallingRoomId = async (req,res) =>{
   try{
        const {id:selectedUserId,callType : callType} = req.params;
        const myId = req.user._id;
        const roomid = randomUUID();

        const CallerSocketId =  await getSocketId(myId);

        if(CallerSocketId){
            const CallerSocket = io.sockets.sockets.get(CallerSocketId);
            if(CallerSocket) {
                CallerSocket.join(roomid);
                console.log(`Caller ${CallerSocketId} and ${myId} is joined the room ${roomid} for ${callType}`)
            }
        }

        const caller =  await User.findById(myId)

        const receiverSocketId = await getSocketId(selectedUserId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("incomingCall", {
            callType,
            roomid,        
            callerInfo : {
                callerId :   caller._id,
                fullName : caller.fullName,
                profilePic : caller.profilePic,
             },
            incomingCalltime : 30000,
            });
        }

        res.json({ success: true,roomid})
   }catch(error){
    console.log(error.message);
    res.json({success:false,messages: error.message})
   }
}

export const deleteMessages = async (req,res) =>{
    try{
        const { messageList,selectedUserId,forEveryOne } = req.body;
        const myId = req.user._id;

        if (!Array.isArray(messageList) || messageList.length === 0) {
            return res.status(400).json({ error: "messageList must be a non-empty array" });
        }

        if (!await User.findById(selectedUserId)) {
            return res.status(400).json({ error: "Invalid selectedUserId" });
        }

        let result;
        if(forEveryOne){
            result = await Message.deleteMany({
                _id: { $in: messageList },
                senderId: myId,       
                receiverId: selectedUserId,
            });
        }
        else {
            result = await Message.updateMany({
                _id: { $in: messageList },
                $or: [
                { senderId: myId, receiverId: selectedUserId },
                { senderId: selectedUserId, receiverId: myId },
                ],
            },{ $addToSet: { deletefor: myId } }
            );
        }

        const matched = forEveryOne ? result.deletedCount : result.matchedCount;

        if (matched < messageList.length) {
        console.warn(
            `User ${myId} requested ${messageList.length} deletions, only ${result.matchedCount} matched`
        );
        }

        const updatedmessageList = await Message.find({
            $or : [
                {senderId:myId,receiverId:selectedUserId},
                {senderId:selectedUserId,receiverId:myId},
            ],
            deletefor: { $ne: myId },
        })

        return res.json({
            success : true,
            message: "Messages deleted successfully",
            updatedMessageList: updatedmessageList,
        });
    }catch(error){
        console.log("deleted messages ",error)
        return res.status(500).json({ error: "Something went wrong while deleting messages" });
  
    }
}

export const sendMessage = async (req,res)=>{
    try{
        const {text,image} = req.body;
        const receiverId = req.params.id;
        const senderId = req.user._id;
        let imageURL;
        let audioURL;

        console.log('[DEBUG] Received request - req.file:', req.file ? { fieldname: req.file.fieldname, size: req.file.size, mimetype: req.file.mimetype } : 'undefined');
        console.log('[DEBUG] req.body:', { text: !!text, image: !!image });

        if(image){
            const uploadResponse = await cloudinary.uploader.upload(image)
            imageURL = uploadResponse.secure_url;
        }

        if(req.file && req.file.buffer) {
            try {
                console.log('[DEBUG] Uploading audio to Cloudinary...', { size: req.file.buffer.length, mimetype: req.file.mimetype });
                const audioUpload = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream(
                    { 
                    resource_type: "auto", 
                    folder: "chat_audios"
                    },
                    (error, result) => {
                    if (error) {
                        console.error('Cloudinary audio upload error:', error);
                        return reject(error);
                    }
                    console.log('Audio uploaded successfully:', result.secure_url);
                    resolve(result);
                    }
                ).end(req.file.buffer);
                });
                 audioURL = audioUpload.secure_url;
            } catch (audioError) {
                console.error('Audio upload failed:', audioError);
                return res.status(500).json({ success:false, message: "Audio upload failed" });
            }
        }

        const newMessage = await Message.create({
            senderId,
            receiverId,
            text,
            image:imageURL,
            audio : audioURL,
            
        })
        const recieverSocketId = await getSocketId(receiverId)
        if(recieverSocketId){
            io.to(recieverSocketId).emit('newMessage',newMessage)
        }
        res.json({success:true,newMessage});
    }catch(error){
        console.log(error.message);
        res.json({success:false,messages: error.message})
    }
}

export const toGroupedChatting = async (req,res) =>{
    try{
    
        const {mailList:emailList,adminEmail:adminEmailList,groupName:groupName,imageFile:groupAvatar} = req.body;
        let imageURL;
    
        if (!adminEmailList || !Array.isArray(adminEmailList) || adminEmailList.length === 0) {
            return res.status(400).json({success:false,message:"No Admin List found by server"});
        }

        if (!emailList || !Array.isArray(emailList) || emailList.length === 0) {
            return res.status(400).json({ success: false, message: "No member emails provided" });
        }

        const [memberUsers, adminUsers] = await Promise.all([
            User.find({ email: { $in: emailList } }, { _id: 1 }),
            User.find({ email: { $in: adminEmailList } }, { _id: 1 })
        ]);

        const memberIds = memberUsers.map((u) => u._id);
        const adminIds = adminUsers.map((u) => u._id);

        if (adminIds.length === 0) {
            return res.status(400).json({ success: false, message: "No valid admin users found" });
        }

        adminIds.forEach((adminId) => {
            if (!memberIds.some((id) => id.equals(adminId))) {
                memberIds.push(adminId);
            }
        });

        if(groupAvatar){
            const uploadResponse = await cloudinary.uploader.upload(groupAvatar)
            imageURL = uploadResponse.secure_url;
        }

        const newGroup = await Group.create({
            name: groupName || "New Group",
            avatar: imageURL || "",
            admin: adminIds,
            members: memberIds,
        });

        const room = newGroup._id.toString();
        
        let joinedCount = 0;
        for (const userId of memberIds) {
        const socketId = await getSocketId(userId.toString());
            if (socketId) {
                io.in(socketId).socketsJoin(room);
                joinedCount++;
            }
        }

        return res.status(200).json({
            success: true,
            message: "Group created successfully",
        });

    }catch(error){
        console.log(error)
        res.status(500).json({success: false,message: "Internal server error"});
    }
}

export const sendGroupMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const groupId = req.params.id;
    const senderId = req.user._id;
    let imageURL;
    let audioURL;

    const group = await Group.findOne({ _id: groupId, members: senderId });
    if (!group) {
      return res.status(403).json({ success: false, message: "Not a member of this group" });
    }

    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageURL = uploadResponse.secure_url;
    }

    if (req.file && req.file.buffer) {
      try {
        const audioUpload = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            { resource_type: "auto", folder: "chat_audios" },
            (error, result) => {
              if (error) return reject(error);
              resolve(result);
            }
          ).end(req.file.buffer);
        });
        audioURL = audioUpload.secure_url;
      } catch (audioError) {
        console.error('Audio upload failed:', audioError);
        return res.status(500).json({ success: false, message: "Audio upload failed" });
      }
    }

    if (!text && !imageURL && !audioURL) {
      return res.status(400).json({ success: false, message: "Message cannot be empty" });
    }

    const newMessage = await Message.create({
      senderId,
      groupId,
      text,
      image: imageURL,
      audio: audioURL,
      seenBy: [senderId], // sender has "seen" their own message
    });
    io.to(groupId.toString()).emit('newGroupMessage', newMessage);

    res.status(201).json({ success: true, newMessage });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};