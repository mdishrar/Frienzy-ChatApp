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
process.on('unhandledRejection', (reason) => {
    console.error('[FATAL-AVOIDED] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('[FATAL-AVOIDED] Uncaught Exception:', err);
});

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

function corsOriginCheck(origin, callback) {
    if (!origin) return callback(null, true);

    const cleanOrigin = origin.replace(/\/$/, "");

    if (allowedOrigins.has(cleanOrigin)) {
        return callback(null, true);
    }

    console.error(`Blocked CORS request from origin: ${origin}`);
    return callback(null, false); 
}

app.use(cors({
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    origin: corsOriginCheck,
}))

const server = http.createServer(app)

const PING_INTERVAL_MS = 20000;
const PING_TIMEOUT_MS = 20000;

export const io = new Server(server, {
    pingInterval: PING_INTERVAL_MS,
    pingTimeout: PING_TIMEOUT_MS,
    cors: {
        methods: ["GET", "POST", "PUT"],
        credentials: true,
        origin: corsOriginCheck,
    }
})

export const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true });
redis.on('error', (err) => console.error('Redis (main) error:', err.message));

const subClient = redis.duplicate({ lazyConnect: true });
subClient.on('error', (err) => console.error('Redis (subclient) error:', err.message));

app.get('/redis', async (req, res) => {
    try {
        const reply = await redis.ping();
        res.json({ redis: reply });
    } catch (err) {
        res.status(503).json({ redis: 'unreachable', error: err.message });
    }
})

app.get('/health', async (req, res) => {
    const status = { mongo: 'unknown', redis: 'unknown' };

    try {
        const mongoose = (await import('mongoose')).default;
        status.mongo = mongoose.connection.readyState === 1 ? 'ok' : 'down';
    } catch {
        status.mongo = 'down';
    }

    try {
        await redis.ping();
        status.redis = 'ok';
    } catch {
        status.redis = 'down';
    }

    const overallOk = status.mongo === 'ok'; 
    res.status(overallOk ? 200 : 503).json(status);
});

const userSocketsKey = (userId) => `user:${userId}:sockets`;
const ONLINE_USERS_SET = "online_users";

const SOCKET_TTL_SECONDS = Math.ceil((PING_INTERVAL_MS + PING_TIMEOUT_MS) / 1000) + 20;

export const getUserSockets = async (userId) => redis.smembers(userSocketsKey(userId));

redis.defineCommand('registerSocket', {
    numberOfKeys: 2,
    lua: `
        local socketsKey = KEYS[1]
        local onlineSet   = KEYS[2]
        local socketId    = ARGV[1]
        local userId      = ARGV[2]
        local ttl         = ARGV[3]

        redis.call('SADD', socketsKey, socketId)
        redis.call('EXPIRE', socketsKey, ttl)
        redis.call('SADD', onlineSet, userId)
        return 1
    `,
});

redis.defineCommand('unregisterSocket', {
    numberOfKeys: 2,
    lua: `
        local socketsKey = KEYS[1]
        local onlineSet   = KEYS[2]
        local socketId    = ARGV[1]
        local userId      = ARGV[2]

        redis.call('SREM', socketsKey, socketId)
        local remaining = redis.call('SCARD', socketsKey)

        if remaining == 0 then
            redis.call('DEL', socketsKey)
            redis.call('SREM', onlineSet, userId)
        end

        return remaining
    `,
});

try {
    io.adapter(createAdapter(redis, subClient));
} catch (err) {
    console.error('[socket.io] Redis adapter setup failed — falling back to single-instance mode:', err.message);
}

function safeHandler(name, fn) {
    return async (...args) => {
        try {
            await fn(...args);
        } catch (err) {
            console.error(`[socket:${name}] error:`, err.message);
        }
    };
}

io.on('connection', async (socket) => {
    const userId = socket.handshake.query.userId;
    console.log("User Connected", userId, socket.id);

    if (!userId) {
        socket.disconnect(true);
        return;
    }

    socket.join(`user:${userId}`);

    const socketsKey = userSocketsKey(userId);

    try {
        await redis.registerSocket(socketsKey, ONLINE_USERS_SET, socket.id, userId, SOCKET_TTL_SECONDS);
        const onlineUsers = await redis.smembers(ONLINE_USERS_SET);
        io.emit('getOnlineUsers', onlineUsers);
    } catch (err) {
        console.error('[presence] failed to register socket in Redis:', err.message);
    }
    socket.conn.on('packet', (packet) => {
        if (packet.type === 'pong') {
            redis.expire(socketsKey, SOCKET_TTL_SECONDS).catch((err) =>
                console.error('[presence] TTL refresh failed:', err.message)
            );
        }
    });

    try {
        const userGroups = await Group.find({ members: userId }, { _id: 1 });
        userGroups.forEach((g) => socket.join(g._id.toString()));
        console.log(`User ${userId} joined ${userGroups.length} group room(s)`);
    } catch (err) {
        console.error('Failed to join group rooms:', err.message);
    }


    socket.on('call:join', safeHandler('call:join', async ({ roomId, userId: calleeId, callerId }) => {
        if (!roomId || !calleeId || !callerId) {
            console.error('call:join — missing roomId, userId, or callerId');
            return;
        }
        socket.join(roomId);
        console.log(`Callee ${calleeId} joined room ${roomId}`);
        io.to(`user:${callerId}`).emit('notifyingCaller', { callpicked: true });
    }));

    socket.on('call:caller-ready', safeHandler('call:caller-ready', async ({ roomId, userId: callerId }) => {
        if (!roomId || !callerId) {
            console.error('call:caller-ready — missing roomId or userId');
            return;
        }
        socket.join(roomId);
        console.log(`Caller ${callerId} joined room ${roomId}`);
    }));

    socket.on('call:offer', safeHandler('call:offer', async ({ to, from, offer }) => {
        if (!to || !from || !offer) {
            console.error('call:offer — missing to, from, or offer');
            return;
        }
        console.log(`Offer from ${from} to ${to}`);
        io.to(`user:${to}`).emit('call:offer', { from, offer });
    }));

    socket.on('call:answer', safeHandler('call:answer', async ({ to, from, answer }) => {
        if (!to || !from || !answer) {
            console.error('call:answer — missing to, from, or answer');
            return;
        }
        console.log(`Answer from ${from} to ${to}`);
        io.to(`user:${to}`).emit('call:answer', { from, answer });
    }));

    socket.on('call:ice-candidate', safeHandler('call:ice-candidate', async ({ to, candidate }) => {
        if (!to || !candidate) {
            console.error('call:ice-candidate — missing to or candidate');
            return;
        }
        io.to(`user:${to}`).emit('call:ice-candidate', { candidate });
    }));

    socket.on('call:end', safeHandler('call:end', async ({ roomId, userId: enderId, to }) => {
        if (!roomId || !enderId || !to) {
            console.error('call:end — missing roomId, userId, or to');
            return;
        }
        io.to(`user:${to}`).emit('call:ended', { by: enderId });
        socket.leave(roomId);
        console.log(`User ${enderId} ended call and left room ${roomId}`);
    }));

    socket.on('disconnect', safeHandler('disconnect', async () => {
        console.log('User disconnected', userId, socket.id);

        const remaining = await redis.unregisterSocket(socketsKey, ONLINE_USERS_SET, socket.id, userId);

        if (remaining === 0) {
            const updatedOnlineUsers = await redis.smembers(ONLINE_USERS_SET);
            io.emit('getOnlineUsers', updatedOnlineUsers);
        }
    }));
})

async function clearStalePresenceOnBoot() {
    try {
        await redis.del(ONLINE_USERS_SET);

        const stream = redis.scanStream({ match: "user:*:sockets", count: 100 });
        const staleKeys = [];
        for await (const keys of stream) staleKeys.push(...keys);
        if (staleKeys.length) await redis.del(...staleKeys);

        console.log(`[presence] boot cleanup: cleared ONLINE_USERS_SET + ${staleKeys.length} stale socket set(s)`);
    } catch (err) {
        console.error('[presence] boot cleanup failed — continuing without it:', err.message);
    }
}

async function reconcilePresence() {
    try {
        const userIds = await redis.smembers(ONLINE_USERS_SET);
        for (const uid of userIds) {
            const key = userSocketsKey(uid);
            const exists = await redis.exists(key);
            if (!exists || (await redis.scard(key)) === 0) {
                await redis.srem(ONLINE_USERS_SET, uid);
            }
        }
    } catch (err) {
        console.error('[presence] reconciliation sweep failed:', err.message);
    }
}

app.use('/hello', (req, res) => {
    res.send('<h1>hello world</h1>')
})

app.use('/api/auth', UserRouter)
app.use('/api/messages', messageRoutes)

await connectDB();
await clearStalePresenceOnBoot();

setInterval(reconcilePresence, 30000);

if (process.env.NODE_ENV != "production") {
    const PORT = process.env.PORT;
    server.listen(PORT, () => {
        console.log(`listening at http://127.0.0.1:${PORT}`);
    })
}

export default server;