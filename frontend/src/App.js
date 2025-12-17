import { useEffect, useState } from "react"
import Login from "./Login"
import Chat from "./Chat"
import Register from "./Register"
import { api } from "./api"

function App() {
  const [token, setTokenState] = useState(null)
  const [showRegister, setShowRegister] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  const setToken = (newToken) => {
    setTokenState(newToken)
    if (newToken) {
      localStorage.setItem("accessToken", newToken)
    } else {
      localStorage.removeItem("accessToken")
    }
  }

  // On first load, try to restore token from localStorage (and validate) or use refresh endpoint
  useEffect(() => {
    const init = async () => {
      const stored = localStorage.getItem("accessToken")
      if (stored) {
        try {
          // Validate stored token by calling a protected endpoint
          await api.get("/auth/users", {
            headers: { Authorization: `Bearer ${stored}` }
          })
          setTokenState(stored)
          setCheckingSession(false)
          return
        } catch {
          // invalid/expired token in storage
          localStorage.removeItem("accessToken")
        }
      }
      try {
        const res = await api.post("/auth/refresh")
        setToken(res.data.accessToken)
      } catch {
        // no valid refresh token, stay logged out
      } finally {
        setCheckingSession(false)
      }
    }
    init()
  }, [])

  // Periodically refresh access token to extend session
  useEffect(() => {
    if (!token) return
    const refresh = async () => {
      try {
        const res = await api.post("/auth/refresh")
        setToken(res.data.accessToken)
      } catch (err) {
        console.error("Failed to refresh token", err)
        setToken(null)
      }
    }

    const checkUser = async () => {
      try {
        await api.get("/auth/me", {
          headers: { Authorization: `Bearer ${token}` }
        })
      } catch (err) {
        if (err.response?.status === 404) {
          const stored = localStorage.getItem("accessToken")
          localStorage.removeItem("accessToken")
          alert("Your account has been removed by the admin.")
          setToken(null)
        }
      }
    }

    const refreshInterval = setInterval(refresh, 45 * 60 * 1000) // every 45 minutes
    const userInterval = setInterval(checkUser, 30000) // every 30 seconds

    return () => {
      clearInterval(refreshInterval)
      clearInterval(userInterval)
    }
  }, [token])

  if (checkingSession) {
    return <div>Loading session...</div>
  }

  if (token) {
    return <Chat token={token} onLogout={() => setToken(null)} />
  }

  return (
    <div>
      {showRegister ? (
        <>
          <h2>Register</h2>
          <Register onRegistered={() => setShowRegister(false)} />
          <p>
            Already have an account?{" "}
            <button onClick={() => setShowRegister(false)}>Login</button>
          </p>
        </>
      ) : (
        <>
          <h2>Login</h2>
          <Login setToken={setToken} />
          <p>
            New here?{" "}
            <button onClick={() => setShowRegister(true)}>Register</button>
          </p>
        </>
      )}
    </div>
  )
}

export default App
