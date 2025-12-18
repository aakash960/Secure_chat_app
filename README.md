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
Frontend <==HTTP/REST==> Backend API (Express)
				 \\                |
					\\--Socket.IO----/  (real-time)
												 |
												 v
											 MongoDB

For a detailed architecture diagram, see [architecture.drawio](./architecture.drawio) (open with draw.io or VS Code extension).

	- Refresh token stored as an `httpOnly` cookie to obtain new access tokens via `/auth/refresh`.
- Socket authentication: The Socket.IO connection is verified by providing the access token in the socket handshake; the server verifies the token before allowing socket operations.

Troubleshooting & tips
----------------------
- Ensure `ENCRYPTION_KEY` is exactly 32 bytes (for AES-256-CBC). You can generate one locally with Node or openssl.
- If sockets fail to connect, check `FRONTEND_URL` in `.env` or use `http://localhost:3000` during local dev.

If you want, I can also add postman examples or a sequence diagram next.

