import { useState } from "react"
import { api } from "./api"

export default function Login({ setToken }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const login = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await api.post("/auth/login", {
        email,
        password
      })

      setToken(res.data.accessToken)
    } catch (err) {
      console.error(err)
      const status = err.response?.status
      const msg = err.response?.data?.error

      if (status === 404) {
        alert("User does not exist")
        setEmail("")
        setPassword("")
      } else if (status === 401 && msg === "Incorrect password") {
        alert("Incorrect password")
        setPassword("")
      } else {
        alert(msg || "Login failed")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={login}>
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
        {loading ? "Logging in..." : "Login"}
      </button>
    </form>
  )
}
