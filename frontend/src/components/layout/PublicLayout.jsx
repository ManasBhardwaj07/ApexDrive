import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { Menu, X, ChevronRight } from 'lucide-react'

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

function Header() {
  const { user, profile, signOut, isAdmin } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  const navLinks = [
    { to: '/charities', label: 'Charities' },
    { to: '/draws',     label: 'Draw Results' },
  ]

  const isActive = (to) => location.pathname === to

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-forest-900/80 backdrop-blur-xl border border-white/8 px-5 py-3">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-500 to-gold-600 flex items-center justify-center shadow-lg">
              <span className="text-forest-950 font-display font-600 text-sm">DH</span>
            </div>
            <span className="font-display text-lg font-400 text-cream-100 hidden sm:block">
              Digital <span className="text-gold-400">Heroes</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={isActive(to) ? 'nav-link-active' : 'nav-link'}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Auth section */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                {isAdmin && (
                  <Link to="/admin" className="nav-link text-gold-400/80 hover:text-gold-400">
                    Admin
                  </Link>
                )}
                <Link to="/dashboard" className="btn-primary text-sm px-4 py-2">
                  Dashboard
                </Link>
                <button onClick={signOut} className="btn-ghost text-sm">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login"  className="btn-ghost text-sm">Sign in</Link>
                <Link to="/signup" className="btn-primary text-sm px-4 py-2">
                  Join Now <ChevronRight className="w-4 h-4" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 rounded-lg text-cream-100/70 hover:text-cream-100 hover:bg-white/5"
            onClick={() => setMobileOpen(o => !o)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden mx-4 mt-2 rounded-2xl bg-forest-900/95 backdrop-blur-xl border border-white/8 p-4 flex flex-col gap-2"
          >
            {navLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={isActive(to) ? 'nav-link-active' : 'nav-link'}
              >
                {label}
              </Link>
            ))}
            <hr className="border-white/8 my-1" />
            {user ? (
              <>
                <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="btn-primary text-sm justify-center">Dashboard</Link>
                <button onClick={() => { signOut(); setMobileOpen(false) }} className="btn-ghost text-sm">Sign out</button>
              </>
            ) : (
              <>
                <Link to="/login"  onClick={() => setMobileOpen(false)} className="btn-ghost text-sm justify-center">Sign in</Link>
                <Link to="/signup" onClick={() => setMobileOpen(false)} className="btn-primary text-sm justify-center">Join Now</Link>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

function Footer() {
  return (
    <footer className="border-t border-white/5 bg-forest-950 mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-gold-500 to-gold-600 flex items-center justify-center">
                <span className="text-forest-950 font-display font-600 text-xs">DH</span>
              </div>
              <span className="font-display text-lg text-cream-100">Digital Heroes Golf</span>
            </div>
            <p className="text-cream-100/40 text-sm leading-relaxed">
              Play golf. Win rewards. Change lives. A subscription platform where every score matters beyond the fairway.
            </p>
          </div>

          <div>
            <p className="text-xs font-body font-500 text-cream-100/30 uppercase tracking-wider mb-3">Platform</p>
            <div className="flex flex-col gap-2">
              {[['/', 'Home'], ['/charities', 'Charities'], ['/draws', 'Draw Results'], ['/signup', 'Join Now']].map(([to, label]) => (
                <Link key={to} to={to} className="text-sm text-cream-100/50 hover:text-gold-400 transition-colors">{label}</Link>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-body font-500 text-cream-100/30 uppercase tracking-wider mb-3">Legal</p>
            <div className="flex flex-col gap-2">
              {['Terms of Service', 'Privacy Policy', 'Draw Rules', 'Responsible Play'].map(label => (
                <span key={label} className="text-sm text-cream-100/30 cursor-not-allowed">{label}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-cream-100/25">© 2026 Digital Heroes. All rights reserved.</p>
          <p className="text-xs text-cream-100/25">
            Built for the <span className="text-gold-500/60">Digital Heroes</span> Full-Stack Selection Challenge
          </p>
        </div>
      </div>
    </footer>
  )
}
