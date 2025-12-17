const express = require("express")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const { User } = require("./models")
const authMiddleware = require("./middleware")

const router = express.Router()

router.post("/register", async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" })
  }

  try {
    const existing = await User.findOne({ email })
    if (existing) {
      return res.status(409).json({ error: "User already exists" })
    }

    const hash = await bcrypt.hash(password, 10)

    await User.create({
      email,
      passwordHash: hash
    })

    res.json({ message: "Registered" })
  } catch (err) {
    console.error("Error during registration:", err)
    res.status(500).json({ error: "Registration failed" })
  }
});


router.post("/login", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email })
    if (!user) {
      return res.status(404).json({ error: "User does not exist" })
    }

    const ok = await bcrypt.compare(req.body.password, user.passwordHash)
    if (!ok) {
      return res.status(401).json({ error: "Incorrect password" })
    }

    const accessToken = jwt.sign(
      { id: user._id, email: user.email },
      process.env.ACCESS_SECRET,
      { expiresIn: "1h" }
    )
    const refreshToken = jwt.sign({ id: user._id }, process.env.REFRESH_SECRET)

    user.refreshToken = refreshToken
    await user.save()

    res.cookie("refreshToken", refreshToken, { httpOnly: true })
    res.json({ accessToken })
  } catch (err) {
    console.error("Error during login:", err)
    res.sendStatus(500)
  }
})

router.post("/refresh", async (req, res) => {
  const token = req.cookies.refreshToken
  if (!token) return res.sendStatus(401)

  try {
    const user = await User.findOne({ refreshToken: token })
    if (!user) return res.sendStatus(403)

    jwt.verify(token, process.env.REFRESH_SECRET)

    const accessToken = jwt.sign(
      { id: user._id, email: user.email },
      process.env.ACCESS_SECRET,
      { expiresIn: "1h" }
    )

    res.json({ accessToken })
  } catch (err) {
    console.error("Error during token refresh:", err)
    res.sendStatus(403)
  }
})

router.post("/logout", async (req, res) => {
  const token = req.cookies.refreshToken

  try {
    if (token) {
      await User.updateOne({ refreshToken: token }, { refreshToken: null })
    }
    res.clearCookie("refreshToken")
    res.send("Logged out")
  } catch (err) {
    console.error("Error during logout:", err)
    res.sendStatus(500)
  }
})

// Get list of users for starting individual chats
router.get("/users", authMiddleware, async (req, res) => {
  try {
    const users = await User.find({}, "_id email")
    res.json(users)
  } catch (err) {
    console.error("Error fetching users:", err)
    res.sendStatus(500)
  }
})

// Get current user profile
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId, "_id email")
    if (!user) {
      return res.sendStatus(404)
    }
    res.json(user)
  } catch (err) {
    console.error("Error fetching current user:", err)
    res.sendStatus(500)
  }
})

// Change password
router.post("/change-password", authMiddleware, async (req, res) => {
  const { oldPassword, newPassword } = req.body
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: "Old and new password are required" })
  }

  try {
    const user = await User.findById(req.userId)
    if (!user) {
      return res.sendStatus(404)
    }

    const ok = await bcrypt.compare(oldPassword, user.passwordHash)
    if (!ok) {
      return res.status(401).json({ error: "Old password is incorrect" })
    }

    const hash = await bcrypt.hash(newPassword, 10)
    user.passwordHash = hash
    await user.save()

    res.json({ message: "Password updated" })
  } catch (err) {
    console.error("Error changing password:", err)
    res.status(500).json({ error: "Failed to change password" })
  }
})

module.exports = router


