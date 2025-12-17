const crypto = require("crypto")

if (!process.env.ENCRYPTION_KEY) {
  throw new Error("ENCRYPTION_KEY is not set")
}

const KEY = Buffer.from(process.env.ENCRYPTION_KEY)

if (KEY.length !== 32) {
  throw new Error("ENCRYPTION_KEY must be 32 bytes for aes-256-cbc")
}

exports.encrypt = (text) => {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv("aes-256-cbc", KEY, iv)
  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")
  return { encrypted, iv: iv.toString("hex") }
}

exports.decrypt = (encrypted, iv) => {
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    KEY,
    Buffer.from(iv, "hex")
  )
  let decrypted = decipher.update(encrypted, "hex", "utf8")
  decrypted += decipher.final("utf8")
  return decrypted
}
