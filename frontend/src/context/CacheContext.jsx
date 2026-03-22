import { createContext, useContext, useRef, useCallback } from 'react'

const CacheContext = createContext(null)

const DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

export function CacheProvider({ children }) {
  const cacheRef = useRef(new Map())

  const get = useCallback((key) => {
    const entry = cacheRef.current.get(key)
    if (!entry) return undefined
    if (Date.now() - entry.ts > (entry.ttl || DEFAULT_TTL)) {
      cacheRef.current.delete(key)
      return undefined
    }
    return entry.data
  }, [])

  const set = useCallback((key, data, ttl = DEFAULT_TTL) => {
    cacheRef.current.set(key, { data, ts: Date.now(), ttl })
  }, [])

  const invalidate = useCallback((key) => {
    if (key) cacheRef.current.delete(key)
    else cacheRef.current.clear()
  }, [])

  return (
    <CacheContext.Provider value={{ get, set, invalidate }}>
      {children}
    </CacheContext.Provider>
  )
}

export function useCache() {
  const ctx = useContext(CacheContext)
  if (!ctx) throw new Error('useCache must be used within CacheProvider')
  return ctx
}
