import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { loginUser, registerUser, fetchProfile } from '../services/api'

const AuthContext = createContext(null)

function getCachedUser() {
  try {
    const raw = localStorage.getItem('nightshield_user')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function cacheUser(user) {
  try {
    if (user) localStorage.setItem('nightshield_user', JSON.stringify(user))
    else localStorage.removeItem('nightshield_user')
  } catch {}
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('nightshield_token'))
  // Restore user instantly from cache — no loading spinner on refresh
  const [user, setUser] = useState(() => token ? getCachedUser() : null)
  const [loading, setLoading] = useState(() => !!token && !getCachedUser())
  const [error, setError] = useState(null)

  // Validate token & refresh user profile in background
  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    fetchProfile()
      .then(data => {
        setUser(data)
        cacheUser(data)
        setLoading(false)
      })
      .catch(() => {
        localStorage.removeItem('nightshield_token')
        cacheUser(null)
        setToken(null)
        setUser(null)
        setLoading(false)
      })
  }, [token])

  const login = useCallback(async (email, password) => {
    setError(null)
    try {
      const data = await loginUser({ email, password })
      localStorage.setItem('nightshield_token', data.token)
      cacheUser(data.user)
      setToken(data.token)
      setUser(data.user)
      return data
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Login failed'
      setError(msg)
      throw new Error(msg)
    }
  }, [])

  const register = useCallback(async (name, email, password, phone) => {
    setError(null)
    try {
      const data = await registerUser({ name, email, password, phone })
      localStorage.setItem('nightshield_token', data.token)
      cacheUser(data.user)
      setToken(data.token)
      setUser(data.user)
      return data
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Registration failed'
      setError(msg)
      throw new Error(msg)
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('nightshield_token')
    cacheUser(null)
    sessionStorage.clear()
    setToken(null)
    setUser(null)
  }, [])

  const value = {
    user,
    setUser,
    token,
    loading,
    error,
    setError,
    isAuthenticated: !!user,
    login,
    register,
    logout,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export default AuthContext
