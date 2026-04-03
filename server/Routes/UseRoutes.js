import express from "express"
import {checkAuth,login,updateProfile,signup} from "../controllers/UserControllers.js"
import { protectRoute } from "../middleware/Auth.js";

const UserRouter = express.Router();

UserRouter.post('/signup',signup);
UserRouter.post('/login',login);
UserRouter.put('/update-profile',protectRoute,updateProfile);
UserRouter.get('/check',protectRoute,checkAuth)

export default UserRouter;