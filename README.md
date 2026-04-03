Frienzy - Real-Time Messaging Application

A modern, feature-rich real-time chat application built with the MERN stack (MongoDB, Express.js, React.js, Node.js) and Socket.IO.

https://screenshot.png
✨ Features
💬 Real-Time Messaging

    Instant message delivery with Socket.IO

    Typing indicators

    Online/offline status

    Message read receipts

🎤 Voice Messaging

    Record and send voice messages

    Live waveform visualization during recording

    Play/pause functionality for audio messages

    Audio progress tracking

📱 Modern UI/UX

    Responsive design (mobile & desktop)

    Dark theme with gradient accents

    Clean, intuitive interface

    Smooth animations and transitions

🔒 Authentication & Security

    JWT-based authentication

    Password encryption

    Protected routes

    User session management

🖼️ Media Support

    Send images (PNG, JPEG)

    Voice message recording

    Profile picture uploads

    Cloud storage integration

🔔 Notifications

    Real-time message alerts

    Unread message counters

    Online status indicators

🚀 Tech Stack
Frontend

    React 18 - UI library

    Tailwind CSS - Styling framework

    Socket.IO Client - Real-time communication

    React Context API - State management

    React Router - Navigation

    Axios - HTTP client

Backend

    Node.js - Runtime environment

    Express.js - Web framework

    Socket.IO - WebSocket library

    MongoDB - Database

    Mongoose - ODM for MongoDB

    JWT - Authentication tokens

    Cloudinary - Media storage

    bcryptjs - Password hashing

📁 Project Structure
text
```

quickchat/
├── client/                   # React frontend
│   ├── public/
│   └── src/
│   │    ├── assets/          # Images, icons, fonts
│   │    ├── components/      # React components
│   │    │   ├── ChatArea.jsx  # Main chat interface
│   │    │   ├── Sidebar.jsx   # User list sidebar
│   │    │   └── RightSidebar.jsx          # Other components
│   │    |
│   │    ├── lib/             # Utilities and helpers
│   │    └── pages/           # Page components
│   │
│   └──Context/  
│             │
│             │──AuthContext.jsx
│             │──ChatContext.jsx
│             │──AuthProvider.jsx
│             └──ChatProvider.jsx
|
│
├── server/                  # Express backend
│   ├── controllers/         # Route controllers
│   │   └── messageController.js
│   ├── models/              # Mongoose models
│   │   ├── messageModel.js
│   │   └── userModel.js
│   ├── routes/              # API routes
│   ├── middleware/          # Custom middleware
│   ├── lib/                 # Server utilities
│   │   └── cloudinary.js
│   └── server.js           # Server entry point
│
├── .env.example            # Environment variables template
├── package.json            # Dependencies and scripts
└── README.md              # This file
```

🛠️ Installation
Prerequisites

    Node.js (v14 or higher)

    MongoDB (local or Atlas)

    npm or yarn

    Cloudinary account (for media storage)

Backend Setup

    Clone the repository:

bash

git clone https://github.com/mdishrar/quickchat.git
cd quickchat

    Install backend dependencies:

bash

cd server
npm install

    Configure environment variables:

bash

cp .env.example .env

Edit .env with your configuration:
env

PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

    Start the backend server:

bash

npm run dev

Frontend Setup

    Install frontend dependencies:

bash

cd ../client
npm install

    Configure environment variables (optional):

bash

cp .env.example .env.local

    Start the development server:

bash

npm start

🌐 API Endpoints
Authentication

    POST /api/auth/register - Register new user

    POST /api/auth/login - User login

    POST /api/auth/logout - User logout

Messages

    GET /api/messages/users - Get all chat users

    GET /api/messages/:userId - Get messages with specific user

    POST /api/messages/send/:userId - Send message (text, image, or audio)

    PUT /api/messages/mark/:messageId - Mark message as read

Users

    GET /api/users/profile - Get user profile

    PUT /api/users/profile - Update user profile

    POST /api/users/profile-pic - Upload profile picture

🔧 Key Features Implementation
Real-Time Messaging

    Uses Socket.IO for bidirectional communication

    Instant message delivery without page refresh

    Online user tracking

Voice Message Recording

    Utilizes Web Audio API for recording

    MediaRecorder API for audio capture

    Cloudinary for audio file storage

    Canvas API for waveform visualization

State Management

    React Context API for global state

    Local state for component-specific data

    Optimized re-renders with useMemo and useCallback

📱 Responsive Design

    Mobile-first approach

    Breakpoints for tablets and desktops

    Touch-friendly interface

    Adaptive layouts

🔐 Security Features

    JWT token-based authentication

    Password hashing with bcrypt

    Input validation and sanitization

    CORS configuration

    Rate limiting (optional)

🚀 Deployment
Backend (Render/Vercel/Heroku)

    Build the project: npm run build

    Set environment variables

    Deploy with your preferred platform

Frontend (Netlify/Vercel)

    Build: npm run build

    Deploy the build folder

    Set API URL environment variable

Database

    Use MongoDB Atlas for cloud database

    Or deploy self-hosted MongoDB

🧪 Testing

Run backend tests:
bash

cd server
npm test

Run frontend tests:
bash

cd client
npm test

🤝 Contributing

    Fork the repository

    Create a feature branch: git checkout -b feature-name

    Commit changes: git commit -m 'Add feature'

    Push to branch: git push origin feature-name

    Open a Pull Request

📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
👥 Authors

    mdishrar - GitHub

    Contributors

🙏 Acknowledgments

    Icons from Font Awesome

    UI inspiration from modern chat applications

    Thanks to all contributors and testers

📞 Support

For support, email muhammadishrar9@gmail.com or create an issue in the GitHub repository.

Made with ❤️ by [Md Ishrar]
