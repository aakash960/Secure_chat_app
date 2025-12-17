const express = require("express")
const { Message } = require("./models")
const { decrypt } = require("./encrypt")
const auth = require("./middleware")

const router = express.Router()

router.get("/:user", auth, async (req, res) => {
  const msgs = await Message.find({
    isGroup: { $ne: true },
    deletedFor: { $ne: String(req.userId) },
    $or: [
      { sender: req.userId, receiver: req.params.user },
      { sender: req.params.user, receiver: req.userId }
    ]
  }).sort({ time: 1 })

  const data = msgs.map(m => ({
    sender: m.sender,
    receiver: m.receiver,
    message: decrypt(m.message, m.iv),
    time: m.time
  }))

  res.json(data)
})

// Clear chat for current user (private chat) - marks messages deleted for this user only
router.post("/:user/clear", auth, async (req, res) => {
  try {
    console.log("Clear private chat for user", req.userId, "with user", req.params.user)
    const result = await Message.updateMany({
      isGroup: { $ne: true },
      $or: [
        { sender: req.userId, receiver: req.params.user },
        { sender: req.params.user, receiver: req.userId }
      ]
    }, { $addToSet: { deletedFor: String(req.userId) } })

    console.log("Cleared chat: matched", result.matchedCount, "modified", result.modifiedCount)
    res.json({ message: "Chat cleared for you", modifiedCount: result.modifiedCount })
  } catch (err) {
    console.error("Error clearing chat:", err)
    res.status(500).json({ error: "Failed to clear chat: " + err.message })
  }
})

module.exports = router
