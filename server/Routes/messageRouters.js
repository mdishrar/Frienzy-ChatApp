import express from "express"
import { protectRoute } from "../middleware/Auth.js";
import {getUsersforSidebars,getMessages,markMessageAsSeen,sendMessage,CallingRoomId,deleteMessages,
       toGroupedChatting,getGroupMessages,markGroupMessageAsSeen,sendGroupMessage} from "../controllers/MessageControllers.js"
import upload from "../middleware/Multer.js";
const messageRoutes = express.Router();

messageRoutes.get('/users',protectRoute,getUsersforSidebars);
messageRoutes.get('/:id',protectRoute,getMessages)
messageRoutes.put('/mark/:id',protectRoute,markMessageAsSeen)
messageRoutes.post('/send/:id',protectRoute,upload.single("audio"),sendMessage)
messageRoutes.post('/call/start/:callType/:id',protectRoute,CallingRoomId)
messageRoutes.post('/ondelete',protectRoute,deleteMessages)
messageRoutes.post('/ongrouping',protectRoute,toGroupedChatting)
messageRoutes.get('/group/:id',protectRoute,getGroupMessages)
messageRoutes.put('/group/mark/:id',protectRoute,markGroupMessageAsSeen)
messageRoutes.post('/group/send/:id',protectRoute,upload.single("audio"),sendGroupMessage)

export default messageRoutes;