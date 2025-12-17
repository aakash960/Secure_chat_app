const express = require("express")
const { Group, User, Message } = require("./models")
const { decrypt } = require("./encrypt")
const auth = require("./middleware")

const router = express.Router()

// Create a new group with existing users
router.post("/", auth, async (req, res) => {
  const { name, memberIds = [] } = req.body

  if (!name) {
    return res.status(400).json({ error: "Group name is required" })
  }

  // Ensure creator is in the group
  const members = new Set(memberIds.map(String))
  members.add(String(req.userId))

  try {
    const group = await Group.create({
      name,
      members: Array.from(members)
    })

    res.status(201).json(group)
  } catch (err) {
    console.error("Error creating group:", err)
    res.status(500).json({ error: "Failed to create group" })
  }
})

// Get groups current user belongs to
router.get("/", auth, async (req, res) => {
  try {
    const groups = await Group.find({ members: String(req.userId) })
    res.json(groups)
  } catch (err) {
    console.error("Error fetching groups:", err)
    res.status(500).json({ error: "Failed to fetch groups" })
  }
})

// Add a member to a group (any member can add)
router.post("/:groupId/add-member", auth, async (req, res) => {
  const { userId } = req.body
  if (!userId) {
    return res.status(400).json({ error: "userId is required" })
  }

  try {
    const group = await Group.findById(req.params.groupId)
    if (!group) {
      return res.status(404).json({ error: "Group not found" })
    }

    if (!group.members.includes(String(req.userId))) {
      return res.status(403).json({ error: "You are not a member of this group" })
    }

    if (group.members.includes(String(userId))) {
      return res.status(409).json({ error: "User already existed in the group" })
    }

    // Ensure user exists
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: "User does not exist" })
    }

    group.members.push(String(userId))
    await group.save()

    res.json(group)
  } catch (err) {
    console.error("Error adding member:", err)
    res.status(500).json({ error: "Failed to add member" })
  }
})

// Remove a member from a group (any member can remove)
router.post("/:groupId/remove-member", auth, async (req, res) => {
  const { userId } = req.body
  if (!userId) {
    return res.status(400).json({ error: "userId is required" })
  }

  try {
    const group = await Group.findById(req.params.groupId)
    if (!group) {
      return res.status(404).json({ error: "Group not found" })
    }

    if (!group.members.includes(String(req.userId))) {
      return res.status(403).json({ error: "You are not a member of this group" })
    }

    group.members = group.members.filter(m => m !== String(userId))
    await group.save()

    res.json(group)
  } catch (err) {
    console.error("Error removing member:", err)
    res.status(500).json({ error: "Failed to remove member" })
  }
})

// Exit from a group (current user leaves)
router.post("/:groupId/exit", auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId)
    if (!group) {
      return res.status(404).json({ error: "Group not found" })
    }

    group.members = group.members.filter(m => m !== String(req.userId))
    await group.save()

    res.json({ message: "Exited group" })
  } catch (err) {
    console.error("Error exiting group:", err)
    res.status(500).json({ error: "Failed to exit group" })
  }
})

// Get messages for a group
router.get("/:groupId/messages", auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId)
    if (!group) {
      return res.status(404).json({ error: "Group not found" })
    }

    if (!group.members.includes(String(req.userId))) {
      return res.status(403).json({ error: "You are not a member of this group" })
    }

    const msgs = await Message.find({
      receiver: req.params.groupId,
      isGroup: true,
      deletedFor: { $ne: String(req.userId) }
    }).sort({ time: 1 })

    const data = msgs.map(m => ({
      sender: m.sender,
      receiver: m.receiver,
      message: decrypt(m.message, m.iv),
      time: m.time
    }))

    res.json(data)
  } catch (err) {
    console.error("Error fetching group messages:", err)
    res.status(500).json({ error: "Failed to fetch group messages" })
  }
})

// Delete a group (any member can delete)
router.delete("/:groupId", auth, async (req, res) => {
  try {
    console.log("DELETE /group/", req.params.groupId, "by user", req.userId)
    const group = await Group.findById(req.params.groupId)
    if (!group) {
      return res.status(404).json({ error: "Group not found" })
    }

    if (!group.members.includes(String(req.userId))) {
      return res.status(403).json({ error: "You are not a member of this group" })
    }

    // Delete all messages for this group
    const msgResult = await Message.deleteMany({ receiver: req.params.groupId, isGroup: true })
    console.log("Deleted", msgResult.deletedCount, "messages for group", req.params.groupId)

    // Delete the group itself
    const groupResult = await Group.findByIdAndDelete(req.params.groupId)
    console.log("Group deleted:", req.params.groupId)

    res.json({ message: "Group deleted", deletedMessages: msgResult.deletedCount })
  } catch (err) {
    console.error("Error deleting group:", err)
    res.status(500).json({ error: "Failed to delete group: " + err.message })
  }
})

// Clear group chat for current user only (does not remove messages for others)
router.post("/:groupId/clear", auth, async (req, res) => {
  try {
    console.log("Clear group chat for user", req.userId, "in group", req.params.groupId)
    const result = await Message.updateMany(
      { receiver: req.params.groupId, isGroup: true },
      { $addToSet: { deletedFor: String(req.userId) } }
    )
    console.log("Cleared chat for user:", req.userId, "matched:", result.matchedCount, "modified:", result.modifiedCount)
    res.json({ message: "Group chat cleared for you", modifiedCount: result.modifiedCount })
  } catch (err) {
    console.error("Error clearing group chat:", err)
    res.status(500).json({ error: "Failed to clear group chat: " + err.message })
  }
})

module.exports = router


