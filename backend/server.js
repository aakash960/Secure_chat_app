require("dotenv").config()
require("./db")

const express = require("express")
const http = require("http")
const cors = require("cors")
const cookieParser = require("cookie-parser")
const { Server } = require("socket.io")
const jwt = require("jsonwebtoken")
const { encrypt } = require("./encrypt")
const { Message, Group } = require("./models")

const app = express()
const server = http.createServer(app)

const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:3000"
]

const isAllowedOrigin = (origin) => {
  if (!origin) return true
  if (allowedOrigins.includes(origin)) return true
  // Allow Vercel hosted frontends (production and previews)
  if (/^https?:\/\/([a-z0-9-]+\.)*vercel\.app(:\d+)?$/.test(origin)) return true
  // Allow any http origin on port 3000 (local dev)
  return /^http:\/\/[^:]+:3000$/.test(origin)
}

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true)
      } else {
        callback(new Error("Not allowed by CORS"))
      }
    },
    credentials: true
  }
})

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true)
    } else {
      callback(new Error("Not allowed by CORS"))
    }
  },
  credentials: true
}))
app.use(express.json())
app.use(cookieParser())

app.use("/auth", require("./auth"))
app.use("/chat", require("./chat"))
app.use("/group", require("./group"))

// Track online users so we can route private messages
const onlineUsers = new Map() // userId -> Set of socket ids

io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token
  if (!token) {
    return next(new Error("Unauthorized"))
  }

  try {
    const payload = jwt.verify(token, process.env.ACCESS_SECRET)
    socket.userId = payload.id
    next()
  } catch (err) {
    console.error("Socket auth error:", err)
    next(new Error("Unauthorized"))
  }
})

io.on("connection", socket => {
  const userId = socket.userId
  if (userId) {
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set())
    }
    onlineUsers.get(userId).add(socket.id)
  }

  socket.on("send", async data => {
    try {
      const senderId = socket.userId
      const { receiver, groupId, message } = data
      if (!senderId || !message) return

      // Helper to emit to a specific user
      const sendToUser = (uid, event, eventData) => {
        const sockets = onlineUsers.get(uid)
        if (!sockets) return
        for (const sid of sockets) {
          io.to(sid).emit(event, eventData)
        }
      }

      if (groupId) {
        // Group message
        const group = await Group.findById(groupId)
        if (!group) return
        if (!group.members.includes(String(senderId))) return

        const enc = encrypt(message)
        await Message.create({
          sender: senderId,
          receiver: groupId,
          message: enc.encrypted,
          iv: enc.iv,
          isGroup: true
        })

        const payload = {
          sender: senderId,
          receiver: groupId,
          message,
          isGroup: true
        }

        // Send to all group members
        for (const memberId of group.members) {
          sendToUser(memberId, "receive", payload)
        }
      } else if (receiver) {
        // Direct message
        const receiverId = receiver

        const enc = encrypt(message)
        await Message.create({
          sender: senderId,
          receiver: receiverId,
          message: enc.encrypted,
          iv: enc.iv,
          isGroup: false
        })

        const payload = {
          sender: senderId,
          receiver: receiverId,
          message,
          isGroup: false
        }

        // Send to sender and receiver only (private chat)
        sendToUser(senderId, "receive", payload)
        if (receiverId !== senderId) {
          sendToUser(receiverId, "receive", payload)
        }
      }
    } catch (err) {
      console.error("Error handling send:", err)
    }
  })

  socket.on("disconnect", () => {
    if (!userId) return
    const sockets = onlineUsers.get(userId)
    if (!sockets) return
    sockets.delete(socket.id)
    if (sockets.size === 0) {
      onlineUsers.delete(userId)
    }
  })
})

const PORT = process.env.PORT || 5000
server.listen(PORT, () => console.log(`Server running on port ${PORT}`))
