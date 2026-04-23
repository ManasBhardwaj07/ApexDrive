// ── AdminDashboard.jsx ───────────────────────────────────────
// PATCH: src/pages/admin/AdminDashboard.jsx
// Fixed bugs:
//   [1] .catch(() => {}) → analytics failure was completely silent.
//       An admin sees an empty grid with zero explanation.
//       FIX: Converted to async/await with try/catch, toast.error + error state
//   [2] No isMounted guard → setState warning on unmount
//       FIX: Added isMounted ref

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, Trophy, Heart, CreditCard, TrendingUp, Clock, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../../lib/api'

export default function AdminDashboard() {
  const [stats, setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(false)    // [FIX 1]

  // [FIX 2]
  const isMounted = useRef(true)
  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  useEffect(() => {
    const load = async () => {
      if (isMounted.current) { setLoading(true); setError(false) }
      try {
        const data = await api.admin.analytics()
        if (isMounted.current) setStats(data)
      } catch (err) {
        console.error('[AdminDashboard] Analytics load failed:', err.message)
        // [FIX 1] Show error state instead of silent empty grid
        if (isMounted.current) {
          setError(true)
          toast.error('Unable to load analytics right now.', { id: 'analytics-error' })
        }
      } finally {
        if (isMounted.current) setLoading(false)
      }
    }
    load()
  }, [])

  const cards = stats ? [
    { icon: Users,      label: 'Total Users',       value: stats.totalUsers,                                           color: 'text-blue-400',    bg: 'bg-blue-500/10' },
    { icon: TrendingUp, label: 'Active Subscribers', value: stats.activeSubscribers,                                   color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { icon: Trophy,     label: 'Total Prize Pool',   value: `₹${(stats.totalPrizePool || 0).toLocaleString('en-IN')}`,    color: 'text-gold-400',    bg: 'bg-gold-500/10' },
    { icon: Heart,      label: 'Charity Raised',     value: `₹${(stats.totalCharityRaised || 0).toLocaleString('en-IN')}`, color: 'text-coral-500',   bg: 'bg-coral-500/10' },
    { icon: CreditCard, label: 'Total Paid Out',     value: `₹${(stats.totalPaidOut || 0).toLocaleString('en-IN')}`,       color: 'text-purple-400',  bg: 'bg-purple-500/10' },
    { icon: Clock,      label: 'Pending Payouts',    value: stats.pendingPayouts,                                      color: 'text-gold-400',    bg: 'bg-gold-500/10' },
  ] : []

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-4xl font-300 text-cream-100 mb-1">Dashboard</h1>
        <p className="text-cream-100/40 font-body text-sm">Platform overview at a glance</p>
      </div>

      {/* [FIX 1] Error state */}
      {error && !loading && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/8 border border-red-500/20 mb-6">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-400 font-body font-500">Unable to load analytics</p>
            <p className="text-xs text-red-400/60 font-body">Check your connection and try again.</p>
          </div>
          <button
            onClick={() => {
              setError(false)
              setLoading(true)
              api.admin.analytics()
                .then(d => { if (isMounted.current) setStats(d) })
                .catch(() => { if (isMounted.current) setError(true) })
                .finally(() => { if (isMounted.current) setLoading(false) })
            }}
            className="btn-ghost text-xs text-red-400 px-3 py-1.5"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading
          ? Array(6).fill(0).map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)
          : cards.map(({ icon: Icon, label, value, color, bg }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="card-gold"
            >
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div>
                  <p className="text-xs text-cream-100/40 font-body mb-1">{label}</p>
                  <p className={`font-display text-3xl font-400 ${color}`}>{value ?? '—'}</p>
                </div>
              </div>
            </motion.div>
          ))
        }
      </div>

      <div className="mt-10">
        <p className="text-xs font-body font-500 text-cream-100/30 uppercase tracking-wider mb-4">Quick Actions</p>
        <div className="flex flex-wrap gap-3">
          {[
            ['/admin/draws',     'Run Draw'],
            ['/admin/payouts',   'Review Payouts'],
            ['/admin/users',     'Manage Users'],
            ['/admin/charities', 'Edit Charities'],
          ].map(([to, label]) => (
            // Use Link instead of <a> to stay within React Router
            <Link key={to} to={to} className="btn-secondary text-sm px-4 py-2">{label}</Link>
          ))}
        </div>
      </div>
    </div>
  )
}
