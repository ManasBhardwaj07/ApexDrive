import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export function LoginPage() {
  const [form, setForm]     = useState({ email: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const { signIn, user, isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  // ONLY auto-redirect if they visit the page already logged in.
  // The !isSubmitting guard prevents React Router from hijacking active logins.
  useEffect(() => {
    if (user && !loading && !isSubmitting) {
      navigate(isAdmin ? '/admin' : '/dashboard', { replace: true })
    }
  }, [user, loading, isAdmin, isSubmitting, navigate])

  const handle = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true) // Lock the component UI
    
    try {
      const { data: authData, error } = await signIn(form)
      
      if (isMounted.current) {
        if (error) {
          toast.error(error.message || 'Invalid credentials')
          setIsSubmitting(false) // UNLOCK ONLY ON ERROR
        } else {
          toast.success('Welcome back!')
          
          // Fetch the role directly from the DB to bypass state delays
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', authData.user.id)
            .single()

          const userRole = profile?.role ? String(profile.role).trim().toLowerCase() : 'subscriber'

          // Hard redirect. Because we never set isSubmitting to false, 
          // React Router cannot steal the navigation before the page reloads.
          if (userRole === 'admin') {
            window.location.href = '/admin'
          } else {
            window.location.href = '/dashboard'
          }
        }
      }
    } catch (err) {
      if (isMounted.current) {
        toast.error('An unexpected error occurred')
        setIsSubmitting(false) // UNLOCK ONLY ON ERROR
      }
    }
  }

  // Removed the "if (user) return null" fallback that was causing early unmounts
  
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 bg-gradient-radial from-forest-800/20 to-transparent pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-500 to-gold-600 flex items-center justify-center">
              <span className="text-forest-950 font-display font-600">DH</span>
            </div>
          </Link>
          <h1 className="font-display text-4xl font-300 text-cream-100 mb-2">Welcome back</h1>
          <p className="text-cream-100/40 font-body text-sm">Sign in to your account</p>
        </div>

        <div className="card-gold p-8">
          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="label">Email address</label>
              <input
                name="email" type="email" value={form.email} onChange={handle}
                className="input" placeholder="you@example.com" required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  name="password" type={showPw ? 'text' : 'password'} value={form.password} onChange={handle}
                  className="input pr-12" placeholder="••••••••" required
                  autoComplete="current-password"
                />
                <button
                  type="button" onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-cream-100/30 hover:text-cream-100/60 transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full justify-center py-3.5">
              {isSubmitting
                ? <div className="w-4 h-4 border-2 border-forest-950/30 border-t-forest-950 rounded-full animate-spin" />
                : <LogIn className="w-4 h-4" />
              }
              {isSubmitting ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
          <p className="text-center text-sm text-cream-100/40 font-body mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="text-gold-400 hover:text-gold-300 transition-colors">Create one</Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}

export function SignupPage() {
  const [form, setForm]     = useState({ fullName: '', email: '', password: '', confirm: '' })
  const [showPw, setShowPw] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { signUp, user, isAdmin, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user && !loading && !isSubmitting) {
      navigate(isAdmin ? '/admin' : '/dashboard', { replace: true })
    }
  }, [user, loading, isAdmin, isSubmitting, navigate])

  const handle = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm) return toast.error("Passwords don't match")
    if (form.password.length < 8)       return toast.error('Password must be at least 8 characters')

    setIsSubmitting(true)
    try {
      const { error } = await signUp({ email: form.email, password: form.password, fullName: form.fullName })
      if (error) {
        toast.error(error.message || 'Signup failed. Please try again.')
        setIsSubmitting(false)
      } else {
        toast.success('Account created! Please check your email to verify.')
        navigate('/login')
      }
    } catch (err) {
      console.error('[SignupPage] signUp unexpected error:', err)
      toast.error('Unable to create account right now. Please check your connection and try again.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 bg-gradient-radial from-forest-800/20 to-transparent pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-500 to-gold-600 flex items-center justify-center">
              <span className="text-forest-950 font-display font-600">DH</span>
            </div>
          </Link>
          <h1 className="font-display text-4xl font-300 text-cream-100 mb-2">Create account</h1>
          <p className="text-cream-100/40 font-body text-sm">Join the Digital Heroes community</p>
        </div>

        <div className="card-gold p-8">
          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="label">Full name</label>
              <input
                name="fullName" type="text" value={form.fullName} onChange={handle}
                className="input" placeholder="Arjun Sharma" required
                autoComplete="name"
              />
            </div>
            <div>
              <label className="label">Email address</label>
              <input
                name="email" type="email" value={form.email} onChange={handle}
                className="input" placeholder="you@example.com" required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  name="password" type={showPw ? 'text' : 'password'} value={form.password} onChange={handle}
                  className="input pr-12" placeholder="Min. 8 characters" required
                  autoComplete="new-password"
                />
                <button
                  type="button" onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-cream-100/30 hover:text-cream-100/60"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Confirm password</label>
              <input
                name="confirm" type="password" value={form.confirm} onChange={handle}
                className="input" placeholder="••••••••" required
                autoComplete="new-password"
              />
            </div>
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full justify-center py-3.5">
              {isSubmitting && (
                <div className="w-4 h-4 border-2 border-forest-950/30 border-t-forest-950 rounded-full animate-spin" />
              )}
              {isSubmitting ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
          <p className="text-center text-sm text-cream-100/40 font-body mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-gold-400 hover:text-gold-300 transition-colors">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}

export default LoginPage