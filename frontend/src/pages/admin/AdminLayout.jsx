import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard, Users, Trophy, CreditCard, Heart,
  LogOut, ChevronRight, Menu, X
} from 'lucide-react'
import { useState } from 'react'

const NAV = [
  { to: '/admin',          icon: LayoutDashboard, label: 'Dashboard',  exact: true },
  { to: '/admin/users',    icon: Users,            label: 'Users' },
  { to: '/admin/draws',    icon: Trophy,           label: 'Draws' },
  { to: '/admin/payouts',  icon: CreditCard,       label: 'Payouts' },
  { to: '/admin/charities',icon: Heart,            label: 'Charities' },
]

export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (to, exact) =>
    exact ? location.pathname === to : location.pathname.startsWith(to)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const Sidebar = ({ mobile }) => (
    <div className={`flex flex-col h-full ${mobile ? '' : 'w-64'}`}>
      {/* Logo */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-500 to-gold-600 flex items-center justify-center">
            <span className="text-forest-950 font-display font-600 text-sm">DH</span>
          </div>
          <div>
            <p className="font-display text-sm text-cream-100">Digital Heroes</p>
            <p className="text-xs text-cream-100/30 font-body">Admin Panel</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {NAV.map(({ to, icon: Icon, label, exact }) => (
          <Link
            key={to}
            to={to}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-body font-500 transition-all ${
              isActive(to, exact)
                ? 'bg-gold-500/10 text-gold-400 border border-gold-500/15'
                : 'text-cream-100/50 hover:text-cream-100 hover:bg-white/5'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {isActive(to, exact) && <ChevronRight className="w-4 h-4 ml-auto" />}
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-white/5">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-forest-700 flex items-center justify-center text-gold-400 text-sm font-display">
            {profile?.full_name?.[0] || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-body font-500 text-cream-100 truncate">{profile?.full_name}</p>
            <p className="text-xs text-cream-100/30 font-body truncate">{profile?.email}</p>
          </div>
        </div>
        <button onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-cream-100/40 hover:text-red-400 hover:bg-red-500/5 font-body transition-all">
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed top-0 left-0 h-screen bg-forest-900/80 backdrop-blur-xl border-r border-white/5 z-40 w-64">
        <Sidebar />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-forest-950/80" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 bg-forest-900 border-r border-white/5 flex flex-col">
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 p-2 text-cream-100/40">
              <X className="w-5 h-5" />
            </button>
            <Sidebar mobile />
          </aside>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 md:ml-64 min-h-screen">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-forest-900/80 border-b border-white/5 sticky top-0 z-30">
          <button onClick={() => setMobileOpen(true)} className="p-2 text-cream-100/60">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-display text-lg text-cream-100">Admin</span>
        </div>

        <div className="p-6 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
