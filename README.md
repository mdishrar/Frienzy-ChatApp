# Frienzy - Real-Time Messaging Application
<div align="center">

# Frienzy

**A real-time chat application with voice messages, group chats, and audio/video calling**

Built with the MERN stack (MongoDB, Express, React, Node.js), Socket.IO for real-time messaging and WebRTC for peer-to-peer calls.

![Chat UI placeholder](https://screenshot.png)

[Features](#-features) · [Tech Stack](#-tech-stack) · [Getting Started](#-getting-started) · [API Reference](#-api-reference) · [Contributing](#-contributing)

</div>

---

## Table of Contents

- [About the Project](#-about-the-project)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture Overview](#-architecture-overview)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [Socket.IO Events](#-socketio-events)
- [WebRTC Call Flow](#-webrtc-call-flow)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Code Review Findings](#-code-review-findings)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)
- [Support](#-support)

---

## 📖 About the Project

Frienzy is a full-featured real-time messaging application. Users can sign up, exchange text, image and voice messages instantly, form group chats with multiple admins, and place audio or video calls directly in the browser using WebRTC.

The backend is an Express + Socket.IO server that uses **Redis** for socket presence, session management, and user caching, and **MongoDB** for durable storage. The frontend is a React SPA styled with Tailwind CSS.

> **Note:** This project is in active development. See [Code Review Findings](#-code-review-findings) and [Roadmap](#-roadmap) for known issues and planned improvements.

---

## ✨ Features

### 💬 Real-Time Messaging
- Instant 1:1 message delivery via Socket.IO
- Durable history persisted in MongoDB
- Typing of text, image, and voice messages in one composer

### 🎤 Voice Messages
- Record audio with the `MediaRecorder` API
- **Live waveform visualization** while recording (Web Audio API + Canvas)
- Playback with native audio controls
- Uploads streamed to Cloudinary

### 👥 Group Chats
- Create groups by email with **multiple admins**
- Group avatars, member lists, and online member counts
- Per-member read tracking via `seenBy`
- Socket rooms for group-wide real-time delivery

### 📞 Audio & Video Calls
- Peer-to-peer calls over **WebRTC** (`RTCPeerConnection`)
- Socket.IO signalling relay (offer / answer / ICE candidates)
- Incoming call popup with accept/decline, ringing timeout
- Mute / unmute, video on/off, call duration timer
- Google STUN servers for NAT traversal

### 🟢 Presence & Read Receipts
- Online/offline status via a Redis set (`online_users`)
- `seen` for DMs and `seenBy` for groups
- Unseen message counters in the sidebar

### 🗑️ Message Management
- Long-press (or press-and-hold) to select multiple messages
- Delete for everyone or just for yourself
- Shared media gallery in the right sidebar
- Day dividers and sender clustering in the chat

### 🔐 Authentication
- JWT access + refresh token rotation
- Refresh tokens stored in Redis and rotated on every exchange
- Passwords hashed with bcrypt
- Axios interceptors with silent token refresh and retry

### 🎨 UI/UX
- Responsive three-pane layout (sidebar / chat / details)
- Dark theme with violet gradient accents and glassmorphism
- Framer-motion-friendly animations (custom CSS keyframes)
- Mobile-friendly with back buttons and hidden panes

---

## 🚀 Tech Stack

### Frontend (`client/`)
| Technology | Version | Purpose |
|---|---|---|
| React | 19.2 | UI library |
| Vite | 7.3 | Build tool & dev server |
| Tailwind CSS | 4.1 | Styling (`@tailwindcss/vite`) |
| React Router DOM | 7.13 | Client-side routing |
| Axios | 1.13 | HTTP client with interceptors |
| socket.io-client | 4.8 | Real-time transport |
| react-hot-toast | 2.6 | Notifications |
| lucide-react | 0.577 | Icons |
| ESLint | 9.x | Linting |

### Backend (`server/`)
| Technology | Version | Purpose |
|---|---|---|
| Node.js | 20+ (ESM) | Runtime |
| Express | 5.2 | Web framework |
| Socket.IO | 4.8 | WebSockets |
| @socket.io/redis-adapter | 8.3 | Horizontal scaling of Socket.IO |
| MongoDB / Mongoose | 9.2 | Database / ODM |
| Redis (ioredis) | 5.11 | Presence, sessions, caching |
| jsonwebtoken | 9.0 | Access & refresh tokens |
| bcrypt | 6.0 | Password hashing |
| Cloudinary | 2.9 | Image & audio storage |
| Multer | 2.0 | Multipart audio uploads |
| Jest | 30.4 | Unit tests |
| k6 | – | Load tests (separate runner) |

### Infrastructure
- **Docker Compose** — one-command local Redis
- **Vercel** — deployment configs for both client and server
- **MongoDB Atlas / Redis Cloud** — recommended managed services

---

## 🏗️ Architecture Overview

```
                        ┌────────────────────────────────────────────┐
                        │                 BROWSER                    │
                        │  React SPA (Vite + Tailwind)               │
                        │                                            │
                        │  ┌──────────────────────────────────────┐  │
                        │  │ AuthProvider │ ChatProvider │        │  │
                        │  │  (token,     │ (messages,   │ CallProvider│
                        │  │   socket)    │  users,groups)│ (call state)│
                        │  └──────────────┴──────────────┴────────┘  │
                        └───────┬───────────────────────┬────────────┘
                                │  REST (axios, JWT)    │  WS (Socket.IO)
                                ▼                       ▼
                     ┌─────────────────┐      ┌──────────────────────┐
                     │  Express 5      │      │  Socket.IO server     │
                     │  /api/auth      │◄────►│  - rooms per group    │
                     │  /api/messages  │      │  - call signalling    │
                     └───────┬─────────┘      │  - presence broadcast │
                             │                └───────────┬──────────┘
                             ▼                            │
                     ┌───────────────┐        ┌───────────▼────────────┐
                     │   MongoDB     │        │  Redis (adapter)       │
                     │   users       │        │  - socket↔user map     │
                     │   messages    │        │  - online set          │
                     │   groups      │        │  - refresh tokens      │
                     │   (durable)   │        │  - user cache          │
                     └───────────────┘        └────────────────────────┘
```

**How real-time messaging works**

1. On login/signup the client opens a Socket.IO connection passing `userId` in the query.
2. The server stores the mapping `user:{id} → socketId` in Redis (5-minute TTL) and adds the user to the `online_users` set, then broadcasts the updated list to everyone.
3. When a message is sent, the REST endpoint persists it and emits `newMessage` to the receiver's socket id (or `newGroupMessage` to the group's Socket.IO room).
4. Online presence, read receipts, and unread counters are updated live.

**How calling works** — see [WebRTC Call Flow](#-webrtc-call-flow).

---

## 📁 Project Structure

```
frienzy/
├── client/                        # React frontend (Vite)
│   ├── public/                    # Static assets (favicon, bg image)
│   ├── Context/
│   │   ├── AuthContext.jsx        # Auth context definition
│   │   ├── AuthProvider.jsx       # Auth state, JWT refresh, socket setup
│   │   ├── ChatContext.jsx        # Chat context definition
│   │   ├── ChatProvider.jsx       # Messages, users, groups, group creation
│   │   ├── CallContext.jsx        # Call context definition
│   │   └── CallProvider.jsx       # Incoming/outgoing call state + persistence
│   ├── src/
│   │   ├── assets/                # Icons, logos, demo avatars
│   │   │   └── assets.js          # Asset registry + dummy data
│   │   ├── components/
│   │   │   ├── Sidebar.jsx        # Conversation list, search, online status
│   │   │   ├── ChatArea.jsx       # Message list, composer, voice recording
│   │   │   ├── RightSidebar.jsx   # Profile/group details, shared media
│   │   │   ├── IncomingCall.jsx   # Incoming call overlay
│   │   │   └── OutGoingCall.jsx   # Outgoing (ringing) overlay
│   │   ├── lib/
│   │   │   └── utils.js           # formatMessageTime helper
│   │   ├── pages/
│   │   │   ├── Homepage.jsx       # Main 3-pane layout
│   │   │   ├── Login.jsx          # Login / signup form
│   │   │   ├── ProfilePage.jsx    # Edit profile + avatar
│   │   │   ├── VideoCall.jsx      # WebRTC video call screen
│   │   │   ├── Audiocall.jsx      # WebRTC audio call screen
│   │   │   ├── AddingUserInGroup.jsx  # Create group by email
│   │   │   └── AddingNewUser.jsx  # ⚠️ Stub (not implemented)
│   │   ├── App.jsx                # Routes + route guards
│   │   ├── main.jsx               # Provider composition / entry point
│   │   └── index.css              # Tailwind + custom animations
│   ├── vercel.json                # SPA rewrite for Vercel
│   ├── vite.config.js             # Vite + Tailwind plugin config
│   └── eslint.config.js
│
└── server/                        # Express + Socket.IO backend
    ├── server.js                  # Server entry, Socket.IO events, Redis adapter
    ├── controllers/
    │   ├── UserControllers.js     # signup, login, profile, refresh token
    │   └── MessageControllers.js  # messages, groups, calls, deletion
    ├── Routes/
    │   ├── UseRoutes.js           # /api/auth/*
    │   └── messageRouters.js      # /api/messages/*
    ├── Models/
    │   ├── userModel.js           # User schema
    │   ├── messageModel.js        # Message schema (incl. callDetails)
    │   └── GroupModel.js          # Group schema (members + admins)
    ├── middleware/
    │   ├── Auth.js                # JWT protection (Redis-backed user lookup)
    │   └── Multer.js              # Audio/image upload middleware
    ├── lib/
    │   ├── db.js                  # Mongoose connection
    │   ├── cloudinary.js          # Cloudinary config
    │   └── utils.js               # Access/refresh token generators
    ├── test/
    │   ├── AuthMiddleware.test.js # Jest test for protectRoute
    │   ├── UserControllers.test.js# Jest tests for signup/login
    │   └── LoadTest.test.js       # k6 load test (excluded from Jest)
    ├── jest.config.mjs            # Jest config (ESM, node env)
    ├── docker-compose.yml         # Local Redis service
    ├── vercel.json                # Serverless deployment config
    └── package.json
```

---

## ⚙️ Prerequisites

- **Node.js 20+** (ESM is used throughout)
- **npm** (or yarn/pnpm)
- **Docker** (for local Redis) or a hosted Redis instance
- **MongoDB** (local or Atlas)
- **Cloudinary** account (image + audio storage)
- **A modern browser** — WebRTC requires microphone/camera permissions

---

## 🛠️ Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/mdishrar/frienzy.git
cd frienzy
```

### 2. Start Redis (Docker)

```bash
cd server
docker compose up -d
```

This runs Redis on `localhost:6379` with persistence enabled.

### 3. Set up the backend

```bash
cd server
npm install
cp .env.example .env   # create if it doesn't exist, see below
npm run server         # or: npm start
```

The server logs `listening at http://127.0.0.1:PORT` (default `5000`).

### 4. Set up the frontend

>>>>>>> development
```bash
cd client
npm install
cp .env.example .env
npm run dev            # Vite dev server (default http://localhost:5173)
```

Open `http://localhost:5173`, create an account, and start chatting.

### Quick-start scripts

| Command | Where | Description |
|---|---|---|
| `npm run server` | `server/` | Start backend with nodemon |
| `npm start` | `server/` | Start backend with plain Node |
| `npm run dev` | `client/` | Start Vite dev server |
| `npm run build` | `client/` | Production build |
| `npm run preview` | `client/` | Preview production build |
| `npm run lint` | `client/` | ESLint check |
| `npm test` | `server/` | Run Jest tests |
| `npm run server` | `server/` | Backend dev server |

---

## 🔐 Environment Variables

### Server — `server/.env`

| Variable | Required | Description |
|---|---|---|
| `PORT` | ✅ | Server port (default `5000`) |
| `MONGO_URL` | ✅ | MongoDB connection string |
| `REDIS_URL` | ✅ | Redis connection string (e.g. `redis://localhost:6379`) |
| `JWT_ACCESS_TOKEN` | ✅ | Secret for 10-minute access tokens |
| `JWT_REFRESH_TOKEN` | ✅ | Secret for 7-day refresh tokens |
| `CLIENT_URL` | ✅ | Allowed CORS origin(s), comma-separated |
| `VITE_CLIENT_URL` | – | Additional allowed origin |
| `CLOUDINAY_CLOUD_NAME` | ✅* | Cloudinary cloud name (note the typo in the code) |
| `CLOUDINAY_CLOUD_API_KEY` | ✅* | Cloudinary API key |
| `CLOUDINAY_CLOUD_SECRET_KEY` | ✅* | Cloudinary API secret |
| `NODE_ENV` | – | Set to `production` to skip the dev listener |

\* Only required for image/audio uploads and profile pictures.

> **Note:** The Cloudinary variables are referenced with the misspelling `CLOUDINAY_*` in `server/lib/cloudinary.js`. Keep them exactly as written above. If you use the spelling `CLOUDINARY_*`, uploads will fail with `ECONNREFUSED`/auth errors.

### Client — `client/.env`

| Variable | Required | Description |
|---|---|---|
| `VITE_BACKEND_URL` | ✅ | Backend base URL (e.g. `http://localhost:5000`) |

---

## 📡 API Reference

Base URL: `http://localhost:5000`

### Auth — `/api/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/signup` | – | Create account (`fullName`, `email`, `password`, `bio`) → sets refresh cookie, returns `accessToken` |
| POST | `/login` | – | Log in (`email`, `password`) → sets refresh cookie, returns `accessToken` |
| GET | `/refresh` | – | Exchange refresh cookie for a new access token (rotates the refresh token) |
| GET | `/check` | ✅ | Validate current access token, return the logged-in user |
| PUT | `/update-profile` | ✅ | Update `fullName`, `bio`, and optional base64 `profilePic` |

### Messages — `/api/messages`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/users` | ✅ | Sidebar payload: all users, user's groups, group member cache, unseen counts |
| GET | `/:id` | ✅ | DM history with `:id`, marks incoming messages as seen |
| PUT | `/mark/:id` | ✅ | Mark a DM as seen |
| POST | `/send/:id` | ✅ | Send text/image/audio to user `:id` (multipart `audio` field optional) |
| POST | `/ondelete` | ✅ | Delete selected messages (`messageList`, `selectedUserId`, `forEveryOne`) |
| POST | `/call/start/:callType/:id` | ✅ | Create a call room, notify `:id` (`callType` = `video` or `audio`) |
| GET | `/group/:id` | ✅ | Group message history, adds user to `seenBy` |
| PUT | `/group/mark/:id` | ✅ | Add current user to a group message's `seenBy` |
| POST | `/group/send/:id` | ✅ | Send a message to group `:id` (multipart `audio` optional) |
| POST | `/ongrouping` | ✅ | Create a group (`mailList[]`, `adminEmail[]`, `groupName`, `imageFile`) |

### Misc

| Method | Endpoint | Description |
|---|---|---|
| GET | `/hello` | Health/hello check |
| GET | `/redis` | Redis connectivity check (`{"redis":"PONG"}`) |

---

## 🔌 Socket.IO Events

Connection: `io(backendUrl, { query: { userId } })`

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `call:join` | `{ roomId, userId, callerId }` | Callee accepts the call, joins room, notifies caller |
| `call:caller-ready` | `{ roomId, userId }` | Caller signals readiness to start WebRTC |
| `call:offer` | `{ to, from, offer }` | Relay a WebRTC offer to the callee |
| `call:answer` | `{ to, from, answer }` | Relay a WebRTC answer to the caller |
| `call:ice-candidate` | `{ to, candidate }` | Relay an ICE candidate |
| `call:end` | `{ roomId, userId, to }` | End the call, notify the other peer, leave room |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `getOnlineUsers` | `string[]` | Current online user ids (emitted on connect/disconnect) |
| `newMessage` | `Message` | New DM received |
| `newGroupMessage` | `Message` | New group message received |
| `incomingCall` | `{ callType, roomid, callerInfo, incomingCalltime }` | Notify callee of an incoming call |
| `notifyingCaller` | `{ callpicked: true }` | Tell caller the callee picked up |
| `call:offer` / `call:answer` / `call:ice-candidate` | relayed | WebRTC signalling |
| `call:ended` | `{ by }` | Peer ended the call |

---

## 📞 WebRTC Call Flow

```
Caller                             Server                              Callee
  │     POST /call/start/video/:id  │                                    │
  │────────────────────────────────►│                                    │
  │                                 │   emit 'incomingCall'              │
  │                                 │───────────────────────────────────►│
  │                                 │         accept → emit 'call:join'  │
  │  emit 'notifyingCaller' ◄───────┤◄───────────────────────────────────│
  │  emit 'call:caller-ready' ──────►│                                    │
  │  emit 'call:offer' ─────────────►│────────────────► emit 'call:offer'│
  │  emit 'call:answer' ◄────────────┤◄──────────────── emit 'call:answer'│
  │  ICE candidates relayed both directions (call:ice-candidate)         │
  │  <---------------- P2P media via RTCPeerConnection ----------------->│
  │  emit 'call:end' ───────────────►│────────────────► emit 'call:ended'│
```

- STUN servers used: `stun.l.google.com:19302`, `stun1.l.google.com:19302` (no TURN — may fail on strict NATs).
- The call room is a random UUID; both peers join it so future features (e.g. presence in a room) can rely on it.

---

## 🧪 Testing

### Unit tests (backend, Jest)

```bash
cd server
npm test
```
<<<<<<< HEAD
 
**Run with custom concurrency/duration:**
```bash
k6 run --vus 100 --duration 1m test/LoadTest.test.js
k6 run --vus 1000 --duration 1m test/LoadTest.test.js
```
 
**Thresholds enforced:**
| Metric | Threshold |
|---|---|
| `http_req_duration` | p(95) < 500ms |
| `http_req_failed` | rate < 1% |
 
**Latest results:**
 
| VUs | Requests | p(90) | p(95) | Failed checks | Threshold result |
|---|---|---|---|---|---|
| 100  | 10,738 | 730.75ms | 768.97ms | 35.01% (login response time) | ✗ failed |
| 1000 | 11,602 | 5.89s    | 5.97s    | 49.88% (login response time) | ✗ failed |
 
HTTP-level failures (`http_req_failed`) stayed at 0% in both runs — the server never returned an error status — but response *latency* on `/api/auth/login` degrades sharply under concurrency, and fails the p(95) < 500ms threshold at both load levels.
 
> **Known performance issue:** login throughput barely changes between the 100 VU and 1000 VU runs (~178 req/s in both), while p(95) latency jumps from ~770ms to ~6s. This flat throughput + rising latency pattern points to a **serialized bottleneck on the login path** rather than raw capacity — the most likely suspects are:
> - `bcrypt.compare()` being CPU-bound and blocking Node's single event-loop thread under concurrent requests
> - MongoDB connection pool size being smaller than concurrent request volume, queuing requests
> - No horizontal scaling / clustering (single Node process handling all VUs)
>
> Worth profiling before assuming the app is "load tested" — as-is, login will queue and time out well before you hit 1000 concurrent users in production. Consider `bcrypt`'s async API (already default) combined with a worker thread pool, increasing `maxPoolSize` on the Mongoose connection, and/or running Node in cluster mode behind a load balancer.
 


## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👥 Authors
- mdishrar - GitHub
- Contributors

## 🙏 Acknowledgments
- Icons from [lucide-react](https://lucide.dev)
- UI inspiration from modern chat applications
- Thanks to all contributors and testers

## 📞 Support
=======

Jest is configured for ESM (`--experimental-vm-modules`). Current status: **5 passing / 3 failing** — the controller tests mock `argon2` while the controllers actually use `bcrypt` (see [Code Review Findings](#-code-review-findings)).

### Load tests (k6)

```bash
cd server
k6 run test/LoadTest.test.js
```

Ramps up to 2000 concurrent virtual users hitting `/api/auth/login`, asserting:
- error rate < 1%
- 95th percentile latency < 500ms

> The load test is excluded from the Jest suite via `jest.config.mjs`.

### Linting (frontend)

```bash
cd client
npm run lint
```

Current status: **13 errors / 10 warnings** (mostly `react-hooks/exhaustive-deps`, `no-unused-vars`, and `set-state-in-effect`).

---

## ☁️ Deployment

This project ships with Vercel configuration for both halves.

### Backend (Vercel)

1. Push the `server/` folder as a Vercel project (it includes `vercel.json`).
2. Set all server env vars in the Vercel dashboard.
3. Use a hosted Redis (e.g. Upstash) and MongoDB Atlas; set `REDIS_URL` and `MONGO_URL` accordingly.
4. The Socket.IO adapter relies on the shared Redis for multi-instance scaling.

> **Heads up:** the server uses `origin: "*"` for Socket.IO plus `process.env.NODE_ENV` to decide whether to bind a port. For serverless deployments make sure `NODE_ENV=production` and confirm the Socket.IO transport works on your host's limits.

### Frontend (Vercel / Netlify)
>>>>>>> development

1. `vercel.json` rewrites all routes to `/` (SPA fallback).
2. Set `VITE_BACKEND_URL` to your deployed backend URL **at build time**.
3. Deploy the `client/` directory.

<<<<<<< HEAD
---

Made with ❤️ by [Md Ishrar]
=======
### Alternative hosting

- **Render / Railway / Heroku** for the backend (set the same env vars, `npm start`).
- **Cloudinary** is used as the media CDN — no self-hosted file storage required.
- **MongoDB Atlas** for a managed database; **Upstash Redis** for a managed cache.

---

## 🔍 Code Review Findings

An honest audit of the current codebase — strengths first, then things to fix.

### What's good
- **Thoughtful auth design:** rotating refresh tokens stored in Redis with server-side revocation is a solid pattern; the Axios interceptor retry flow is clean.
- **Redis as a first-class citizen:** socket→user maps, online sets, user caching, and refresh tokens are all Redis-backed, which is the right call for horizontal scaling.
- **Good voice UX:** live waveform, MIME-type fallback, and proper cleanup of streams/audio contexts.
- **Group chats done right:** membership-gated reads, `seenBy` arrays, admin roles, and Socket.IO rooms.
- **Readable UI code:** small components, memoized render plans (`buildRenderPlan`), and thoughtful mobile responsiveness.

### Issues worth fixing

**Backend**
1. **Tests mock the wrong password library.** `test/UserControllers.test.js` mocks `argon2`, but `UserControllers.js` uses `bcrypt`. This breaks 3 tests (and leaves `argon2`/`bcryptjs` as dead dependencies).
2. **Login token bug.** `UserControllers.js:108` generates tokens from `cachedUserId` (which is `null` on a cache miss) instead of `userId`. A cached-login refresh or failed cache read can issue an access token with `userId: null`.
3. **Duplicate CORS origins.** `server.js:32-40` declares `origin` twice — the first (array) is overwritten by the second (callback). The array form is dead code.
4. **`origin: "*"` with `credentials: true`** in the Socket.IO config (`server.js:60`). Browsers reject wildcard + credentials; this should mirror the HTTP CORS allowlist.
5. **`secure: false` cookies** (`UserControllers.js:14`). Fine for local dev, but refresh cookies will be rejected over HTTPS. Make it conditional on `NODE_ENV`.
6. **`subClient` error handler mis-wired.** `server.js:73` registers the error listener on `redis` again, not on `subClient` — so sub-client errors are silent.
7. **No rate limiting** on auth routes → brute-force risk.
8. **`fullName` capped at 10 chars** (`userModel.js:4`) — surprisingly short for a display name.
9. **Un-indexed message queries** — `senderId/receiverId/groupId` lookups will degrade as data grows.

**Frontend**
10. **`AddingNewUser.jsx` is a stub** returning a static div — the sidebar links to it.
11. **Call message rendering mismatch.** `ChatArea.jsx:105` checks `msg.callType`, but the schema stores call info under `callDetails.callType` (`messageModel.js:13`). Call history messages may render as plain text.
12. **`set-state-in-effect` & `exhaustive-deps` errors** in `VideoCall.jsx`/`Audiocall.jsx` (part of the 13 lint errors).
13. **Dead dependencies:** `framer-motion` and `simple-peer` are installed but unused (the app uses native `RTCPeerConnection` + custom CSS animations).
14. **Unused variables / legacy code:** `imagesDummyData`, `userDummyData`, `messagesDummyData` in `assets.js` are no longer consumed.

**Docs/infra**
15. The old README claimed React 18, `npm start` for the client, and frontend tests — none of which match the current repo (React 19, `npm run dev`, no client test suite).
16. The demo `.env` values are absent (`.env.example` files don't exist yet — create them from [Environment Variables](#-environment-variables)).

---

## 🗺️ Roadmap

- [ ] Fix the argon2/bcrypt test mismatch
- [ ] Fix the `cachedUserId` login token bug
- [ ] Clean up duplicate CORS config; scope Socket.IO origins
- [ ] Add secure cookies in production
- [ ] Implement `AddingNewUser` (add user by email) page
- [ ] Render call history messages via `callDetails`
- [ ] Add TURN server for reliable calls behind NAT
- [ ] Add indexes on message `senderId`/`receiverId`/`groupId`
- [ ] Add rate limiting to auth endpoints
- [ ] Add frontend tests (Vitest + Testing Library)
- [ ] Add typing indicators and message reactions
- [ ] Add push notifications / service worker
- [ ] End-to-end encryption for messages

---

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn and grow. Any contributions you make are **greatly appreciated**.

### Getting started

1. **Fork** the repository and clone your fork.
2. Create a feature branch:
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. Make your changes. Follow the existing style:
   - Backend code lives in `server/` (ESM, async/await, try/catch with `res.status(...).json({ success, message })` responses).
   - Frontend code lives in `client/` (React functional components + hooks, Tailwind classes, `Context/` for shared state).
   - Run `npm run lint` (client) and `npm test` (server) before pushing.
4. Commit with a clear message:
   ```bash
   git commit -m 'feat: add amazing feature'
   ```
5. Push and open a Pull Request:
   ```bash
   git push origin feature/amazing-feature
   ```

### Contribution guidelines

- **Bug reports:** open an issue with steps to reproduce, expected vs actual behavior, and browser/OS details.
- **Feature requests:** describe the problem you're solving and a rough proposal.
- **PR checklist:** update the README if behavior changes, keep changes focused, and verify tests/lint pass.
- **Code style:** 2-space indentation, single quotes, no trailing commas, descriptive names.

### Good first issues

See the [Roadmap](#-roadmap) — items like "Fix the argon2/bcrypt test mismatch" or "Add rate limiting" are perfect starting points.

---

## 📄 License

The backend `package.json` declares **ISC**. There is currently **no `LICENSE` file** in the repository, and the frontend is private. Before distributing or reusing this project commercially, add an explicit `LICENSE` file and confirm ownership.

---

## 👥 Authors & Acknowledgments

- **Md Ishrar** — original author
- Contributors and testers who file issues and open PRs

**Built with:** React, Tailwind CSS, Express, Socket.IO, WebRTC, Redis, MongoDB, Cloudinary, and lots of ☕.

---

## 📞 Support

- Open an issue for bugs or feature requests
- Email: muhammadishrar9@gmail.com
- Star the repo if you find it useful

---

<div align="center">

Made with ❤️ by [Md Ishrar](https://github.com/mdishrar)

</div>
>>>>>>> development
