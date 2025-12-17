import { useState } from "react"
import { api } from "./api"

export default function Register({ onRegistered }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const register = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      await api.post("/auth/register", {
        email,
        password
      })
      alert("Registered successfully, you can now log in.")
      if (onRegistered) onRegistered()
    } catch (err) {
      console.error("Registration error:", err)
      const status = err.response?.status
      const msg = err.response?.data?.error

      if (status === 409) {
        alert("User already existed")
      } else {
        alert(
          msg ||
          `Registration failed (status ${status || "network error"})`
        )
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={register}>
      <div>
        <label>
          Email:
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
      </div>
      <div>
        <label>
          Password:
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
      </div>
      <button type="submit" disabled={loading}>
        {loading ? "Registering..." : "Register"}
      </button>
    </form>
  )
}


