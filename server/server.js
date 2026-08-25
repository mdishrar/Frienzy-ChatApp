import express from "express"
import http from "http"
import cors from "cors"
import "dotenv/config"
import { Server } from "socket.io"
import { connectDB } from "./lib/db.js"
import UserRouter from "./Routes/UseRoutes.js"
import messageRoutes from "./Routes/messageRouters.js"
import Redis from "ioredis"
import { createAdapter } from "@socket.io/redis-adapter";
import Group from "./Models/GroupModel.js"
process.env.UV_THREADPOOL_SIZE = 128;

const app = express();
app.use(express.json({ limit: "4mb" }));

app.use((req, res, next) => {
    const cookieHeader = req.headers.cookie || "";
    req.cookies = Object.fromEntries(
        cookieHeader.split(";").filter(Boolean).map((cookie) => {
            const [name, ...valueParts] = cookie.trim().split("=");
            return [name, decodeURIComponent(valueParts.join("="))];
        })
    );
    next();
});

const rawUrls = [
    ...(process.env.CLIENT_URL ? process.env.CLIENT_URL.split(",") : []),
    ...(process.env.VITE_CLIENT_URL ? process.env.VITE_CLIENT_URL.split(",") : []),
    "http://localhost:5173",
    "http://127.0.0.1:5173",
];

const allowedOrigins = new Set(
    rawUrls
        .filter(Boolean)
        .map((url) => {
            let formatted = url.trim();
            if (!formatted.startsWith("http://") && !formatted.startsWith("https://")) {
                formatted = `https://${formatted}`;
            }
            return formatted.replace(/\/$/, "");
        })
);

app.use(cors({
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        const cleanOrigin = origin.replace(/\/$/, "");

        if (allowedOrigins.has(cleanOrigin)) {
            return callback(null, true);
        }

        console.error(`Blocked CORS request from origin: ${origin}`);
        return callback(null, false); // Returning false cleanly rejects CORS without throwing unhandled server errors
    },
}))

const server = http.createServer(app)

export const io = new Server(server, {
    cors: {
        methods: ["GET", "POST", "PUT"],
        credentials: true,
        origin: process.env.CLIENT_URL.split(","),
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);

            const cleanOrigin = origin.replace(/\/$/, "");

            if (allowedOrigins.has(cleanOrigin)) {
                return callback(null, true);
            }

            console.error(`Blocked CORS request from origin: ${origin}`);
            return callback(null, false); 
        },
    }
})

export const redis = new Redis(process.env.REDIS_URL,{lazyConnect:true});
app.get('/redis', async (req,res)=>{
    const reply = await redis.ping();
    console.log(reply);
    res.json({redis : reply});
})
redis.on('error', (err) => console.error('Redis (main) error:', err));

const subClient = redis.duplicate({lazyConnect:true});
redis.on('error', (err) => console.error('Redis (subclient) error:', err));

const userIdKey = (userId) => `user:${userId}:socket`;
const ONLINE_USERS_SET = "online_users";
const PRESENCE_TTL = 60 * 5; 
export const getSocketId = async (userId) => redis.get(userIdKey(userId));

io.adapter(createAdapter(redis,subClient));

io.on('connection', async (socket) => {
    const userId = socket.handshake.query.userId;
    console.log("User Connected", userId);

    if (!userId) return;

    await redis.set(userIdKey(userId),socket.id,"EX",PRESENCE_TTL);
    await redis.sadd(ONLINE_USERS_SET,userId)

    const onlineUsers = await redis.smembers(ONLINE_USERS_SET)
    io.emit('getOnlineUsers', onlineUsers);
    
    try {
        const userGroups = await Group.find({ members: userId }, { _id: 1 });
        userGroups.forEach((g) => socket.join(g._id.toString()));
        console.log(`User ${userId} joined ${userGroups.length} group room(s)`);
    } catch (err) {
        console.error('Failed to join group rooms:', err.message);
    }

    socket.on('call:join', async ({ roomId, userId, callerId }) => {
        if (!roomId || !userId || !callerId) {
            console.error('call:join — missing roomId, userId, or callerId');
            return;
        }

        socket.join(roomId);
        console.log(`Callee ${userId} joined room ${roomId}`);

        const callerSocketId = await getSocketId(callerId);
        if (callerSocketId) {
            io.to(callerSocketId).emit('notifyingCaller', { callpicked: true });
        } else {
            console.warn(`Caller socket not found for callerId ${callerId}`);
        }
    });

    socket.on('call:caller-ready', async ({ roomId, userId }) => {
        if (!roomId || !userId) {
            console.error('call:caller-ready — missing roomId or userId');
            return;
        }
        socket.join(roomId);
        console.log(`Caller ${userId} joined room ${roomId}`);
    });

    socket.on('call:offer', async({ to, from, offer }) => {
        if (!to || !from || !offer) {
            console.error('call:offer — missing to, from, or offer');
            return;
        }

        const receiverSocketId = await getSocketId(to);
        console.log(`Offer from ${from} to ${to}`);

        if (receiverSocketId) {
            io.to(receiverSocketId).emit('call:offer', { from, offer });
        } else {
            console.warn(`Offer target socket not found for user ${to}`);
        }
    });

    socket.on('call:answer', async({ to, from, answer }) => {
        if (!to || !from || !answer) {
            console.error('call:answer — missing to, from, or answer');
            return;
        }

        const toSocketId = await getSocketId(to);
        console.log(`Answer from ${from} to ${to}`);

        if (toSocketId) {
            io.to(toSocketId).emit('call:answer', { from, answer });
        } else {
            console.warn(`Answer target socket not found for user ${to}`);
        }
    });

    socket.on('call:ice-candidate', async ({ to, candidate }) => {
        if (!to || !candidate) {
            console.error('call:ice-candidate — missing to or candidate');
            return;
        }

        const targetSocketId = await getSocketId(to);
        if (targetSocketId) {
            io.to(targetSocketId).emit('call:ice-candidate', { candidate });
        } else {
            console.warn(`ICE target socket not found for user ${to}`);
        }
    });

    socket.on('call:end', async ({ roomId, userId, to }) => {
        if (!roomId || !userId || !to) {
            console.error('call:end — missing roomId, userId, or to');
            return;
        }

        const toSocketId = await getSocketId(to);
        if (toSocketId) {
            io.to(toSocketId).emit('call:ended', { by: userId });
        } else {
            console.warn(`End call target socket not found for user ${to}`);
        }

        socket.leave(roomId);
        console.log(`User ${userId} ended call and left room ${roomId}`);
    });
    
    socket.on('disconnect', async () => {
        console.log('User disconnected', userId);
        await redis.del(userIdKey(userId))
        await redis.srem(ONLINE_USERS_SET,userId)
        const updatedOnlineUsers = await redis.smembers(ONLINE_USERS_SET);
        io.emit('getOnlineUsers', updatedOnlineUsers);
    });
})

app.use('/hello', (req, res) => {
    res.send('<h1>hello world</h1>')
})

app.use('/api/auth', UserRouter)
app.use('/api/messages', messageRoutes)

await connectDB();

if (process.env.NODE_ENV != "production") {
    const PORT = process.env.PORT;
    server.listen(PORT, () => {
        console.log(`listening at http://127.0.0.1:${PORT}`);
    })
}

export default server;
