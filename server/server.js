import express from "express"
import http from "http"
import cors from "cors"
import "dotenv/config"
import { Server } from "socket.io"
import { connectDB } from "./lib/db.js"
import UserRouter from "./Routes/UseRoutes.js"
import messageRoutes from "./Routes/messageRouters.js"

const app = express();

app.use(express.json({ limit: "4mb" }));
app.use(cors({
    methods: ["GET", "POST", "PUT"],
    credentials: true,
    origin: process.env.CLIENT_URL,
}))

const server = http.createServer(app)

export const io = new Server(server, {
    cors: {
        methods: ["GET", "POST", "PUT"],
        credentials: true,
        origin: process.env.CLIENT_URL,
    }
})

export const userSocketMap = {};

io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId;
    console.log("User Connected", userId);

    if (userId) userSocketMap[userId] = socket.id;
    io.emit('getOnlineUsers', Object.keys(userSocketMap));

    // ─── CALLEE joins room after accepting call ───────────────────────────────
    // Triggered from IncomingCall.handleClick
    socket.on('call:join', ({ roomId, userId, callerId }) => {
        if (!roomId || !userId || !callerId) {
            console.error('call:join — missing roomId, userId, or callerId');
            return;
        }

        socket.join(roomId);
        console.log(`Callee ${userId} joined room ${roomId}`);

        // Notify the caller that call was picked up → triggers navigate('/videocall')
        const callerSocketId = userSocketMap[callerId];
        if (callerSocketId) {
            io.to(callerSocketId).emit('notifyingCaller', { callpicked: true });
        } else {
            console.warn(`Caller socket not found for callerId ${callerId}`);
        }
    });

    // ─── CALLER joins room after navigating to VideoCall ─────────────────────
    // Separate event so it doesn't re-trigger notifyingCaller
    socket.on('call:caller-ready', ({ roomId, userId }) => {
        if (!roomId || !userId) {
            console.error('call:caller-ready — missing roomId or userId');
            return;
        }
        socket.join(roomId);
        console.log(`Caller ${userId} joined room ${roomId}`);
    });

    // ─── WebRTC Offer (Caller → Callee) ──────────────────────────────────────
    socket.on('call:offer', ({ to, from, offer }) => {
        if (!to || !from || !offer) {
            console.error('call:offer — missing to, from, or offer');
            return;
        }

        const receiverSocketId = userSocketMap[to];
        console.log(`Offer from ${from} to ${to}`);

        if (receiverSocketId) {
            io.to(receiverSocketId).emit('call:offer', { from, offer });
        } else {
            console.warn(`Offer target socket not found for user ${to}`);
        }
    });

    // ─── WebRTC Answer (Callee → Caller) ─────────────────────────────────────
    socket.on('call:answer', ({ to, from, answer }) => {
        if (!to || !from || !answer) {
            console.error('call:answer — missing to, from, or answer');
            return;
        }

        const toSocketId = userSocketMap[to];
        console.log(`Answer from ${from} to ${to}`);

        if (toSocketId) {
            io.to(toSocketId).emit('call:answer', { from, answer });
        } else {
            console.warn(`Answer target socket not found for user ${to}`);
        }
    });

    // ─── ICE Candidates (Both directions) ────────────────────────────────────
    socket.on('call:ice-candidate', ({ to, candidate }) => {
        if (!to || !candidate) {
            console.error('call:ice-candidate — missing to or candidate');
            return;
        }

        const targetSocketId = userSocketMap[to];
        if (targetSocketId) {
            io.to(targetSocketId).emit('call:ice-candidate', { candidate });
        } else {
            console.warn(`ICE target socket not found for user ${to}`);
        }
    });

    // ─── Call End ─────────────────────────────────────────────────────────────
    socket.on('call:end', ({ roomId, userId, to }) => {
        if (!roomId || !userId || !to) {
            console.error('call:end — missing roomId, userId, or to');
            return;
        }

        // Notify the other peer
        const toSocketId = userSocketMap[to];
        if (toSocketId) {
            io.to(toSocketId).emit('call:ended', { by: userId });
        } else {
            console.warn(`End call target socket not found for user ${to}`);
        }

        socket.leave(roomId);
        console.log(`User ${userId} ended call and left room ${roomId}`);
    });

    // ─── Disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
        console.log('User disconnected', userId);
        delete userSocketMap[userId];
        io.emit('getOnlineUsers', Object.keys(userSocketMap));
    });
})

// API endpoints
app.use('/hello', (req, res) => {
    res.send('<h1>asslamu alaikum</h1>')
})

app.use('/api/auth', UserRouter)
app.use('/api/messages', messageRoutes)

await connectDB();

if (process.env.NODE_ENV == "production") {
    const PORT = process.env.PORT;
    server.listen(PORT, () => {
        console.log(`listening at http://localhost:${PORT}`);
    })
}

export default server;
