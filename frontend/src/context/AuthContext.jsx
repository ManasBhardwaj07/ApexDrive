import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const currentUserIdRef = useRef(null)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  // NATIVE FETCH: Immune to Supabase SDK deadlocks
  const fetchProfile = async (userId, token) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      // FIX: Added explicit join for the charities table in the URL select parameter
      const res = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=*,charity:charities(*)`, {
        signal: controller.signal,
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
      clearTimeout(timeoutId)

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      
      if (isMounted.current) {
        setProfile(data[0] || null)
        return true
      }
    } catch (err) {
      console.error('[AuthContext] Profile fetch error:', err.message)
      if (isMounted.current) setProfile(null)
      return false
    }
  }

  useEffect(() => {
    let authListenerSub = null;

    const initAuth = async () => {
      try {
        const { data: { session }, error } = await Promise.race([
          supabase.auth.getSession(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('Session timeout')), 4000))
        ])

        if (error) throw error;

        if (session?.user) {
          if (isMounted.current) setUser(session.user)
          currentUserIdRef.current = session.user.id
          
          // CRITICAL FIX: Await the profile BEFORE dropping the loading screen
          await fetchProfile(session.user.id, session.access_token)
        }
      } catch (err) {
        console.error('[AuthContext] Boot error:', err.message)
      } finally {
        if (isMounted.current) setLoading(false)
      }
    }

    initAuth()

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (session?.user) {
          if (isMounted.current) setUser(session.user)
          currentUserIdRef.current = session.user.id
          await fetchProfile(session.user.id, session.access_token)
        } else {
          if (isMounted.current) {
            setUser(null)
            setProfile(null)
          }
          currentUserIdRef.current = null
        }
      } catch (err) {
        console.error('[AuthContext] State change error:', err.message)
      }
    })
    authListenerSub = authListener.subscription

    return () => {
      if (authListenerSub) authListenerSub.unsubscribe()
    }
  }, [])

  const signUp = async ({ email, password, fullName }) => {
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: fullName } },
    })
    return { data, error }
  }

  const signIn = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  const signOut = async () => {
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Signout timeout')), 2000))
      ])
    } catch (err) {
      console.warn('[AuthContext] Server sign-out failed, forcing local clear')
    } finally {
      for (const key in localStorage) {
        if (key.startsWith('sb-')) localStorage.removeItem(key)
      }
      if (isMounted.current) {
        setUser(null)
        setProfile(null)
        currentUserIdRef.current = null
      }
    }
  }

  const refreshProfile = async () => {
    const userId = currentUserIdRef.current
    if (!userId) return
    
    let token = null;
    try {
       const { data: { session } } = await supabase.auth.getSession()
       token = session?.access_token
    } catch(e) {}
    
    await fetchProfile(userId, token)
  }

  const safeRole = profile?.role ? String(profile.role).trim().toLowerCase() : 'subscriber'

  const value = {
    user, 
    profile, 
    loading,
    isAdmin: safeRole === 'admin',
    isSubscribed: profile?.subscription_status === 'active',
    signUp, 
    signIn, 
    signOut, 
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)