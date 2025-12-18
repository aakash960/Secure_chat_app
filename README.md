# Secure Chat App

Project overview
-----------------
This is a simple secure chat application (prototype) built as a learning project. It supports private and group chats, end-to-end message encryption on the server, authentication using JWTs, and real-time messaging via Socket.IO.

Tech stack
----------
- **Backend:** Node.js, Express, Socket.IO, MongoDB (Mongoose)
- **Auth / Security:** bcrypt (password hashing), JSON Web Tokens (JWT)
- **Encryption:** AES-256-CBC for message payload encryption
- **Frontend:** React, socket.io-client, axios

Quick setup (local)
-------------------
1. Clone the repo and open project root.
2. Backend setup:

```bash
cd backend
cp .env.example .env   # fill the values below
npm install
npm start
```

Required env vars (backend `.env`):
- `MONGO_URI` - MongoDB connection string
- `ACCESS_SECRET` - secret for access JWTs
- `REFRESH_SECRET` - secret for refresh JWTs
- `ENCRYPTION_KEY` - 32-byte key (required) for AES-256-CBC
- `FRONTEND_URL` - allowed origin (optional)

3. Frontend setup:

```bash
cd ../frontend
npm install
npm start
```

API documentation (basic)
------------------------
Base routes: `/auth`, `/chat`, `/group`

Auth routes (`/auth`):
- `POST /register` — body: `{ email, password }` — create user
- `POST /login` — body: `{ email, password }` — returns `{ accessToken }` and sets `refreshToken` cookie
- `POST /refresh` — uses httpOnly `refreshToken` cookie to issue a new access token
- `POST /logout` — clears refresh token cookie and server record
- `GET /users` — protected — list users (id, email)
- `GET /me` — protected — current user profile
- `POST /change-password` — protected — `{ oldPassword, newPassword }`

Chat routes (`/chat`):
- `GET /:user` — protected — get private messages between current user and `:user` (server decrypts before return)
- `POST /:user/clear` — protected — mark messages deleted for current user

Group routes (`/group`):
- `POST /` — protected — create group `{ name, memberIds }`
- `GET /` — protected — list groups current user is in
- `POST /:groupId/add-member` — add user to group `{ userId }`
- `POST /:groupId/remove-member` — remove user `{ userId }`
- `POST /:groupId/exit` — current user leaves group
- `GET /:groupId/messages` — protected — get group messages
- `POST /:groupId/clear` — clear group chat for current user
- `DELETE /:groupId` — delete group and its messages

Socket.IO (real-time)
---------------------
- During socket connection the client should pass `{ auth: { token: '<ACCESS_TOKEN>' } }`.
- Client emits `send` with payload `{ receiver?, groupId?, message }`.
- Server emits `receive` with payload `{ sender, receiver, message, isGroup }` to relevant sockets.

Architecture diagram
--------------------

**System Architecture:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                               │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  React Frontend (Browser)                                 │   │
│  │  • Login & Registration                                   │   │
│  │  • Chat UI (Private & Group)                             │   │
│  │  • User Management                                        │   │
│  └────────────────────────────────────────────────────────────┘   │
└─────────────────┬──────────────────┬──────────────────────────────┘
                  │                  │
         HTTP/REST│              WebSocket│
                  │ (JWT Auth)        │ (Socket.IO)
                  │                  │
      ┌───────────▼──────┬──────────▼───────────────┐
      │ COMMUNICATION    │  COMMUNICATION           │
      │ REST Routes      │  Real-time (Socket.IO)   │
      │ (/auth, /chat,   │  • Send & Receive msgs   │
      │  /group)         │  • Online Status         │
      └───────────┬──────┴──────────┬───────────────┘
                  │                │
      ┌───────────▼────────────────▼────────────────┐
      │     BACKEND (Node.js + Express)            │
      │                                            │
      │  ┌─ Authentication Module (JWT + bcrypt) │
      │  ├─ Chat Service (msg encryption)        │
      │  ├─ Group Service                        │
      │  ├─ Socket.IO Event Handler              │
      │  └─ Message Encryption (AES-256-CBC)    │
      └─────────────┬──────────────────────────────┘
                    │
        ┌───────────▼───────────────┐
        │   DATA LAYER              │
        │ ┌──────────────────────┐ │
        │ │  MongoDB             │ │
        │ │  • Users             │ │
        │ │  • Messages (enc)    │ │
        │ │  • Groups            │ │
        │ └──────────────────────┘ │
        └──────────────────────────┘
```

**Detailed Flow:**
1. User opens React app → frontend connects via REST + Socket.IO
2. Login → password hashed with bcrypt, JWT tokens issued
3. Socket authenticated with access token during handshake
4. Chat message sent → encrypted server-side (AES-256-CBC) → stored in MongoDB
5. Real-time delivery via Socket.IO to connected clients
6. Message retrieval → decrypted before response

**Project File Structure:**
```
Secure_chat_app/
├── backend/
│   ├── auth.js          # JWT & password logic
│   ├── chat.js          # Private chat routes
│   ├── group.js         # Group chat routes
│   ├── server.js        # Express + Socket.IO setup
│   ├── models.js        # MongoDB schemas (User, Message, Group)
│   ├── encrypt.js       # AES-256-CBC encryption/decryption
│   ├── middleware.js    # JWT verification middleware
│   ├── db.js            # MongoDB connection
│   ├── package.json
│   └── .env             # Config (secrets, keys, MONGO_URI)
├── frontend/
│   ├── src/
│   │   ├── App.js       # Main React component
│   │   ├── Login.js     # Auth page
│   │   ├── Register.js  # Registration page
│   │   ├── Chat.js      # Chat interface
│   │   ├── api.js       # Axios client
│   │   ├── index.js     # Entry point
│   │   └── ...
│   └── package.json
├── README.md
└── architecture.drawio  # Detailed architecture diagram
```

**Open `architecture.drawio` in [diagrams.net](https://diagrams.net/) for the full interactive diagram.**
-----------------------------------------------
- Encryption: The server uses AES-256-CBC (`encrypt.js`) with a 32-byte `ENCRYPTION_KEY` from `.env` to encrypt message text. Each message uses a random 16-byte IV saved alongside the ciphertext. On read, the server decrypts using the stored IV and key.
- Passwords: Users' passwords are hashed with `bcrypt` before saving.
- Authentication: The app issues two tokens:
	- Access token (JWT) returned by `/auth/login` and used in `Authorization: Bearer <token>` header for protected REST endpoints.
	- Refresh token stored as an `httpOnly` cookie to obtain new access tokens via `/auth/refresh`.
- Socket authentication: The Socket.IO connection is verified by providing the access token in the socket handshake; the server verifies the token before allowing socket operations.

Troubleshooting & tips
----------------------
- Ensure `ENCRYPTION_KEY` is exactly 32 bytes (for AES-256-CBC). You can generate one locally with Node or openssl.
- If sockets fail to connect, check `FRONTEND_URL` in `.env` or use `http://localhost:3000` during local dev.

If you want, I can also add postman examples or a sequence diagram next.

