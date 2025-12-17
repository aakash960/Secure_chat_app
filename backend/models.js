const mongoose = require("mongoose")

const User = mongoose.model("User", {
  email: String,
  passwordHash: String,
  refreshToken: String
})

const Message = mongoose.model("Message", {
  sender: String,
  receiver: String,
  message: String,
  iv: String,
  time: { type: Date, default: Date.now },
  isGroup: { type: Boolean, default: false },
  deletedFor: [String]
})

const Group = mongoose.model("Group", {
  name: String,
  members: [String] // userId strings
})

module.exports = { User, Message, Group }
