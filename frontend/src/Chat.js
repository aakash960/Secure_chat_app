import { useEffect, useRef, useState } from "react"
import { io } from "socket.io-client"
import { api } from "./api"

export default function Chat({ token }) {
  const [msg, setMsg] = useState("")
  const [messages, setMessages] = useState([])
  const [users, setUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [selectedGroupId, setSelectedGroupId] = useState(null)
  const [myId, setMyId] = useState(null)
  const [myEmail, setMyEmail] = useState("")
  const [unread, setUnread] = useState({})
  const [groups, setGroups] = useState([])
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [newGroupMembers, setNewGroupMembers] = useState({})
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [groupMembers, setGroupMembers] = useState([])
  const [showGroupOptions, setShowGroupOptions] = useState(false)
  const socketRef = useRef(null)

  // Decode user id from JWT
  useEffect(() => {
    try {
      const [, payloadBase64] = token.split(".")
      const payloadJson = atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/"))
      const payload = JSON.parse(payloadJson)
      setMyId(payload.id)
      if (payload.email) {
        setMyEmail(payload.email)
      }
    } catch (e) {
      console.error("Failed to decode token", e)
    }
  }, [token])

  // Load user list (and refresh periodically)
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await api.get("/auth/users", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
        setUsers(res.data)
      } catch (err) {
        console.error("Failed to load users", err)
      }
    }
    const loadGroups = async () => {
      try {
        const res = await api.get("/group", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
        setGroups(res.data)
      } catch (err) {
        console.error("Failed to load groups", err)
      }
    }
    loadUsers()
    loadGroups()
    const interval = setInterval(() => {
      loadUsers()
      loadGroups()
    }, 10000)
    return () => clearInterval(interval)
  }, [token])

  // Setup socket connection
  useEffect(() => {
    const SOCKET_URL = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:5000`
    const socket = io(SOCKET_URL, {
      auth: { token }
    })
    socketRef.current = socket

    socket.on("receive", data => {
      if (data.isGroup) {
        const gid = String(data.receiver)
        if (selectedGroupId && String(selectedGroupId) === gid) {
          setMessages(prev => [...prev, data])
        } else {
          setUnread(prev => ({
            ...prev,
            [gid]: (prev[gid] || 0) + 1
          }))
        }
        return
      }

      const otherId =
        data.sender === myId ? data.receiver : data.sender

      // Only show messages for currently selected conversation
      if (
        selectedUserId &&
        (data.sender === selectedUserId || data.receiver === selectedUserId)
      ) {
        setMessages(prev => [...prev, data])
      } else if (otherId) {
        setUnread(prev => ({
          ...prev,
          [otherId]: (prev[otherId] || 0) + 1
        }))
      }
    })

    return () => {
      socket.off("receive")
      socket.disconnect()
      socketRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedUserId, selectedGroupId, myId])

  // Load history when selecting a user
  const selectUser = async (userId) => {
    setSelectedGroupId(null)
    setSelectedUserId(userId)
    setMessages([])
    setUnread(prev => {
      const copy = { ...prev }
      delete copy[userId]
      return copy
    })
    try {
      const res = await api.get(`/chat/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      setMessages(res.data)
    } catch (err) {
      console.error("Failed to load history", err)
    }
  }

  // Load history when selecting a group
  const selectGroup = async (groupId) => {
    setSelectedUserId(null)
    setSelectedGroupId(groupId)
    setMessages([])
    setShowGroupOptions(false)
    try {
      const res = await api.get(`/group/${groupId}/messages`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      setMessages(res.data)
      
      const groupData = groups.find(g => g._id === groupId)
      if (groupData) {
        setGroupMembers(groupData.members || [])
      }
    } catch (err) {
      console.error("Failed to load group history", err)
    }
  }

  const send = () => {
    if (!socketRef.current || !msg.trim()) return

    if (selectedUserId) {
      socketRef.current.emit("send", {
        receiver: selectedUserId,
        message: msg
      })
    } else if (selectedGroupId) {
      socketRef.current.emit("send", {
        groupId: selectedGroupId,
        message: msg
      })
    } else {
      return
    }

    setMsg("")
  }

  const exitGroup = async () => {
    if (!selectedGroupId) return
    try {
      await api.post(`/group/${selectedGroupId}/exit`, {}, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      setGroups(prev => prev.filter(g => g._id !== selectedGroupId))
      setSelectedGroupId(null)
      setMessages([])
      setGroupMembers([])
      alert("Exited group")
    } catch (err) {
      console.error("Failed to exit group", err)
      alert(err.response?.data?.error || "Failed to exit group")
    }
  }

  const removeMemberFromGroup = async (userId) => {
    if (!selectedGroupId) return
    if (!window.confirm("Remove this member from the group?")) return
    
    try {
      const res = await api.post(`/group/${selectedGroupId}/remove-member`, 
        { userId }, 
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )
      setGroupMembers(res.data.members || [])
      setGroups(prev => prev.map(g => g._id === selectedGroupId ? res.data : g))
      alert("Member removed")
    } catch (err) {
      console.error("Failed to remove member", err)
      alert(err.response?.data?.error || "Failed to remove member")
    }
  }

  const deleteGroup = async () => {
    if (!selectedGroupId) return
    if (!window.confirm("Delete this group? This cannot be undone.")) return
    
    try {
      await api.delete(`/group/${selectedGroupId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      setGroups(prev => prev.filter(g => g._id !== selectedGroupId))
      setSelectedGroupId(null)
      setMessages([])
      setGroupMembers([])
      alert("Group deleted")
    } catch (err) {
      console.error("Failed to delete group", err)
      alert(err.response?.data?.error || "Failed to delete group")
    }
  }

  const clearChat = async () => {
    try {
      if (selectedUserId) {
        await api.post(`/chat/${selectedUserId}/clear`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        })
      } else if (selectedGroupId) {
        await api.post(`/group/${selectedGroupId}/clear`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        })
      }
      setMessages([])
      alert("Chat cleared for you")
    } catch (err) {
      console.error("Failed to clear chat", err)
      alert(err.response?.data?.error || "Failed to clear chat")
    }
  }

  const addMemberToGroup = async () => {
    if (!selectedGroupId) return
    
    const email = prompt("Enter the user email to add:")
    if (!email) return
    
    // Find user by email
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase())
    if (!user) {
      alert("User not found")
      return
    }

    if (groupMembers.includes(user._id)) {
      alert("User is already a member of this group")
      return
    }
    
    try {
      const res = await api.post(`/group/${selectedGroupId}/add-member`, 
        { userId: user._id }, 
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )
      setGroupMembers(res.data.members || [])
      setGroups(prev => prev.map(g => g._id === selectedGroupId ? res.data : g))
      alert("Member added to group")
    } catch (err) {
      console.error("Failed to add member", err)
      alert(err.response?.data?.error || "Failed to add member")
    }
  }

  const toggleMemberSelection = (userId) => {
    setNewGroupMembers(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }))
  }

  const createGroup = async (e) => {
    e.preventDefault()
    const memberIds = Object.entries(newGroupMembers)
      .filter(([, selected]) => selected)
      .map(([id]) => id)

    if (!newGroupName.trim()) {
      alert("Group name is required")
      return
    }

    if (memberIds.length === 0) {
      alert("Select at least one member")
      return
    }

    try {
      const res = await api.post("/group", {
        name: newGroupName,
        memberIds
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      setGroups(prev => [...prev, res.data])
      setNewGroupName("")
      setNewGroupMembers({})
      setShowCreateGroup(false)
      alert("Group created")
    } catch (err) {
      console.error("Failed to create group", err)
      const msg = err.response?.data?.error || "Failed to create group"
      alert(msg)
    }
  }

  const logout = async () => {
    try {
      await api.post("/auth/logout")
    } catch (err) {
      console.error("Logout error", err)
    } finally {
      localStorage.removeItem("accessToken")
      window.location.reload()
    }
  }

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <div style={{ width: "260px", borderRight: "1px solid #ccc", padding: "8px" }}>
        <div style={{ marginBottom: "12px" }}>
          <strong>Profile:</strong>
          <div style={{ fontWeight: "bold" }}>
            {myEmail || "User"}
          </div>
          <button onClick={logout} style={{ marginTop: "4px" }}>
            Logout
          </button>
          <div style={{ marginTop: "8px" }}>
            <strong>Change password</strong>
            <div>
              <input
                type="password"
                placeholder="Old password"
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                style={{ width: "100%", marginTop: "4px" }}
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                style={{ width: "100%", marginTop: "4px" }}
              />
            </div>
            <button
              style={{ marginTop: "4px" }}
              onClick={async () => {
                if (!oldPassword || !newPassword) {
                  alert("Please fill both old and new password")
                  return
                }
                try {
                    await api.post("/auth/change-password", {
                      oldPassword,
                      newPassword
                    }, {
                      headers: {
                        Authorization: `Bearer ${token}`
                      }
                    })
                  alert("Password updated")
                  setOldPassword("")
                  setNewPassword("")
                } catch (err) {
                  const status = err.response?.status
                  const msg = err.response?.data?.error
                  if (status === 401 && msg === "Old password is incorrect") {
                    alert("Old password is incorrect")
                    setOldPassword("")
                  } else {
                    alert(msg || "Failed to change password")
                  }
                }
              }}
            >
              Update
            </button>
          </div>
        </div>
        <h3>Chats</h3>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {users
            .filter(u => u._id !== myId)
            .map(user => {
              const hasUnread = unread[user._id] > 0
              return (
                <li key={user._id}>
                  <button
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: user._id === selectedUserId ? "#eee" : "transparent",
                      fontWeight: hasUnread ? "bold" : "normal"
                    }}
                    onClick={() => selectUser(user._id)}
                  >
                    {user.email}
                    {hasUnread ? ` (${unread[user._id]})` : ""}
                  </button>
                </li>
              )
            })}
        </ul>
        <hr />
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h4>Groups</h4>
            <button onClick={() => setShowCreateGroup(s => !s)}>
              {showCreateGroup ? "Cancel" : "New Group"}
            </button>
          </div>
          {showCreateGroup && (
            <form onSubmit={createGroup} style={{ marginTop: "4px" }}>
              <div>
                <input
                  type="text"
                  placeholder="Group name"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  style={{ width: "100%", marginBottom: "4px" }}
                />
              </div>
              <div style={{ maxHeight: "150px", overflowY: "auto", border: "1px solid #ccc", padding: "4px", marginBottom: "4px" }}>
                {users
                  .filter(u => u._id !== myId)
                  .map(user => (
                    <label key={user._id} style={{ display: "block" }}>
                      <input
                        type="checkbox"
                        checked={!!newGroupMembers[user._id]}
                        onChange={() => toggleMemberSelection(user._id)}
                      />
                      {" "}{user.email}
                    </label>
                  ))}
              </div>
              <button type="submit">Create Group</button>
            </form>
          )}
          <ul style={{ listStyle: "none", padding: 0, marginTop: "8px" }}>
            {groups.map(group => (
              <li key={group._id}>
                <button
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: group._id === selectedGroupId ? "#eee" : "transparent"
                  }}
                  onClick={() => selectGroup(group._id)}
                >
                  {group.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px" }}>
        {selectedGroupId && (
          <div style={{ background: "#f9f9f9", padding: "8px", borderRadius: "4px", marginBottom: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <strong>Group Options</strong>
              <button onClick={() => setShowGroupOptions(!showGroupOptions)}>
                {showGroupOptions ? "Hide" : "Show"}
              </button>
            </div>
            {showGroupOptions && (
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                <button onClick={addMemberToGroup} style={{ background: "#4CAF50", color: "white" }}>
                  Add Member
                </button>
                <button onClick={() => setShowGroupOptions(false)} style={{ padding: "4px 8px" }}>
                  View Members
                </button>
                <button onClick={clearChat} style={{ background: "#607D8B", color: "white" }}>
                  Clear Chat (you)
                </button>
                <button onClick={exitGroup} style={{ background: "#FF9800", color: "white" }}>
                  Exit Group
                </button>
                <button onClick={deleteGroup} style={{ background: "#f44336", color: "white" }}>
                  Delete Group
                </button>
              </div>
            )}
            {showGroupOptions && groupMembers.length > 0 && (
              <div style={{ marginTop: "8px", maxHeight: "150px", overflowY: "auto", border: "1px solid #ddd", padding: "4px" }}>
                <strong>Members:</strong>
                <ul style={{ listStyle: "none", padding: "4px 0", margin: 0 }}>
                  {groupMembers.map((memberId, idx) => {
                    const member = users.find(u => u._id === memberId)
                    const displayName = member ? member.email : memberId
                    return (
                      <li key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px", borderBottom: "1px solid #eee" }}>
                        <span>{memberId === myId ? `${displayName} (You)` : displayName}</span>
                        {memberId !== myId && (
                          <button 
                            onClick={() => removeMemberFromGroup(memberId)}
                            style={{ background: "#ff5252", color: "white", padding: "2px 6px", fontSize: "12px" }}
                          >
                            Remove
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
        <div style={{ flex: 1, overflowY: "auto", borderBottom: "1px solid #ccc" }}>
          {selectedUserId && (
            <div style={{ marginBottom: "8px", display: "flex", justifyContent: "flex-end" }}>
              <button onClick={clearChat} style={{ background: "#607D8B", color: "white", padding: "4px 8px" }}>
                Clear Chat (you)
              </button>
            </div>
          )}
          {selectedUserId || selectedGroupId ? (
            messages.map((m, i) => (
              <div
                key={i}
                style={{
                  textAlign: m.sender === myId ? "right" : "left",
                  margin: "4px 0"
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    padding: "4px 8px",
                    borderRadius: "8px",
                    background: m.sender === myId ? "#daf1ff" : "#f1f1f1"
                  }}
                >
                  {m.message}
                </span>
              </div>
            ))
          ) : (
            <p>Select a user or group to start chatting.</p>
          )}
        </div>
        <div style={{ marginTop: "8px" }}>
          <input
            value={msg}
            onChange={e => setMsg(e.target.value)}
            disabled={!selectedUserId && !selectedGroupId}
            placeholder={
              selectedUserId || selectedGroupId
                ? "Type a message..."
                : "Select a user or group to start"
            }
            style={{ width: "80%", marginRight: "8px" }}
          />
          <button
            onClick={send}
            disabled={(!selectedUserId && !selectedGroupId) || !msg.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
