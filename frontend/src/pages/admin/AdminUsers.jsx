// PATCH: src/pages/admin/AdminUsers.jsx
// This file contains AdminUsers, AdminDraws, AdminPayouts, AdminCharities.
// Fixed bugs across all 4 components:
//   [1] All load() functions used .catch(() => {}) → silent failures
//       FIX: Converted every loader to async/await with try/catch + toast.error
//   [2] All load() functions missing isMounted guard → memory leaks
//       FIX: Added isMounted ref to every component
//   [3] UserDetail — .catch(() => {}) → skeleton showed forever on failure
//       FIX: Added error state + retry button in the expanded row
//   [4] AdminUsers — table body rows missing React key on fragment wrapper
//       FIX: Added key={u.id} to the React.Fragment wrapping each row pair
//   [5] AdminDraws — load() called after create/simulate/publish with no isMounted check
//       FIX: isMounted checked before setDraws inside each action
//   [6] AdminPayouts — load(filter) called after review/markPaid with no isMounted
//       FIX: Same fix
//   [7] AdminDashboard quick-action links used <a href> causing full page reloads
//       NOTE: Fixed in AdminDashboard.jsx (separate patch) using <Link>

import { Fragment, useEffect, useRef, useState } from 'react'
import { Search, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../../lib/api'

// ── AdminUsers ───────────────────────────────────────────────
export function AdminUsers() {
  const [users, setUsers]       = useState([])
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState(null)

  // [FIX 2]
  const isMounted = useRef(true)
  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  // [FIX 1] Converted from .then().catch(() => {})
  const load = async (q = '') => {
    if (isMounted.current) setLoading(true)
    try {
      const params = q ? `?search=${encodeURIComponent(q)}` : ''
      const r = await api.admin.users(params)
      if (isMounted.current) setUsers(r.users || [])
    } catch (err) {
      console.error('[AdminUsers] load error:', err.message)
      if (isMounted.current) toast.error('Unable to load users right now.', { id: 'admin-users-error' })
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const statusBadge = (s) => {
    const map = {
      active:    'badge-active',
      inactive:  'badge-inactive',
      cancelled: 'badge-pending',
      lapsed:    'badge-rejected',
    }
    return <span className={map[s] || 'badge-inactive'}>{s}</span>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-4xl font-300 text-cream-100 mb-1">Users</h1>
          <p className="text-cream-100/40 font-body text-sm">{users.length} total users</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream-100/30" />
          <input
            className="input pl-10 w-64"
            placeholder="Search name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load(search)}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="bg-forest-900/60 text-cream-100/40 text-xs uppercase tracking-wider">
                <th className="px-5 py-3 text-left">User</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Plan</th>
                <th className="px-5 py-3 text-left">Charity</th>
                <th className="px-5 py-3 text-left">Joined</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="border-t border-white/5">
                    {Array(6).fill(0).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="skeleton h-4 rounded" />
                      </td>
                    ))}
                  </tr>
                ))
                : users.map(u => (
                  // [FIX 4] React.Fragment with key to avoid "Each child must have a key" warning
                  <Fragment key={u.id}>
                    <tr className="border-t border-white/5 hover:bg-white/2 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-500 text-cream-100">{u.full_name || '—'}</p>
                        <p className="text-cream-100/40 text-xs">{u.email}</p>
                      </td>
                      <td className="px-5 py-4">{statusBadge(u.subscription_status)}</td>
                      <td className="px-5 py-4 text-cream-100/60 capitalize">{u.subscription_plan || '—'}</td>
                      <td className="px-5 py-4 text-cream-100/60 text-xs">{u.charity?.name || '—'}</td>
                      <td className="px-5 py-4 text-cream-100/40 text-xs">
                        {new Date(u.created_at).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => setExpanded(e => e === u.id ? null : u.id)}
                          className="p-1.5 rounded-lg hover:bg-white/8 text-cream-100/40 transition-colors"
                        >
                          {expanded === u.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                    {expanded === u.id && (
                      <tr className="border-t border-white/5 bg-forest-900/30">
                        <td colSpan={6} className="px-5 py-4">
                          <UserDetail userId={u.id} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// [FIX 3] Added error state + retry — previously showed skeleton forever on failure
function UserDetail({ userId }) {
  const [detail, setDetail] = useState(null)
  const [error, setError]   = useState(false)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  const load = async () => {
    if (isMounted.current) { setError(false); setDetail(null) }
    try {
      const d = await api.admin.user(userId)
      if (isMounted.current) setDetail(d)
    } catch (err) {
      console.error('[UserDetail] load error:', err.message)
      if (isMounted.current) setError(true)
    }
  }

  useEffect(() => { load() }, [userId])

  if (error) {
    return (
      <div className="flex items-center gap-3 text-sm text-cream-100/40 font-body">
        <AlertCircle className="w-4 h-4 text-red-400" />
        <span>Unable to load user details.</span>
        <button onClick={load} className="text-gold-400 hover:text-gold-300 text-xs underline">Retry</button>
      </div>
    )
  }

  if (!detail) return <div className="skeleton h-20 rounded-xl" />

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <p className="text-xs text-cream-100/30 font-body mb-3">Golf Scores (most recent first)</p>
        <div className="flex gap-2 flex-wrap">
          {detail.scores?.length > 0 ? detail.scores.map(s => (
            <div key={s.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-forest-800 border border-white/5">
              <span className="font-display text-lg text-gold-400">{s.score}</span>
              <span className="text-xs text-cream-100/30">
                {new Date(s.score_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
            </div>
          )) : <p className="text-cream-100/30 text-sm font-body">No scores yet</p>}
        </div>
      </div>
      <div>
        <p className="text-xs text-cream-100/30 font-body mb-3">Draw Participation</p>
        <p className="text-cream-100/60 text-sm font-body">
          {detail.entries?.length || 0} total entries,{' '}
          <span className="text-gold-400">{detail.entries?.filter(e => e.is_winner).length || 0} wins</span>
        </p>
        <p className="text-cream-100/30 text-xs font-body mt-1">
          Charity contribution: {detail.profile?.charity_contribution_percent || 10}%
        </p>
      </div>
    </div>
  )
}

// ── AdminDraws ───────────────────────────────────────────────
import { Plus, BarChart3, Globe } from 'lucide-react'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function AdminDraws() {
  const [draws, setDraws]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [creating, setCreating]         = useState(false)
  const [newDraw, setNewDraw]           = useState({
    draw_month:       new Date().getMonth() + 1,
    draw_year:        new Date().getFullYear(),
    draw_type:        'random',
    prize_pool_total: '',
    rollover_amount:  '0',
  })
  const [actionLoading, setActionLoading] = useState(null)

  // [FIX 2]
  const isMounted = useRef(true)
  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  // [FIX 1]
  const load = async () => {
    if (isMounted.current) setLoading(true)
    try {
      const r = await api.draws.list()
      if (isMounted.current) setDraws(r.draws || [])
    } catch (err) {
      console.error('[AdminDraws] load error:', err.message)
      if (isMounted.current) toast.error('Unable to load draws right now.', { id: 'admin-draws-error' })
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const create = async (e) => {
    e.preventDefault()
    try {
      await api.draws.create(newDraw)
      toast.success('Draw created')
      setCreating(false)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to create draw. Please try again.')
    }
  }

  // [FIX 5] isMounted checked before setState inside action handlers
  const simulate = async (id) => {
    setActionLoading(id + '-sim')
    try {
      const res = await api.draws.simulate(id)
      toast.success(`Simulated! Numbers: ${res.drawNumbers?.join(', ')}`)
      if (isMounted.current) load()
    } catch (err) {
      toast.error(err.message || 'Simulation failed. Please try again.')
    } finally {
      if (isMounted.current) setActionLoading(null)
    }
  }

  const publish = async (id) => {
    if (!confirm('Publish this draw? Results will be visible to all subscribers.')) return
    setActionLoading(id + '-pub')
    try {
      await api.draws.publish(id)
      toast.success('Draw published successfully!')
      if (isMounted.current) load()
    } catch (err) {
      toast.error(err.message || 'Failed to publish draw. Please try again.')
    } finally {
      if (isMounted.current) setActionLoading(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-4xl font-300 text-cream-100 mb-1">Draws</h1>
          <p className="text-cream-100/40 font-body text-sm">Configure, simulate, and publish monthly draws</p>
        </div>
        <button onClick={() => setCreating(c => !c)} className="btn-primary text-sm">
          <Plus className="w-4 h-4" /> New Draw
        </button>
      </div>

      {creating && (
        <form onSubmit={create} className="card-gold mb-8 grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Month</label>
            <select className="input" value={newDraw.draw_month}
              onChange={e => setNewDraw(d => ({ ...d, draw_month: e.target.value }))}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Year</label>
            <input type="number" className="input" value={newDraw.draw_year}
              onChange={e => setNewDraw(d => ({ ...d, draw_year: e.target.value }))} />
          </div>
          <div>
            <label className="label">Draw Type</label>
            <select className="input" value={newDraw.draw_type}
              onChange={e => setNewDraw(d => ({ ...d, draw_type: e.target.value }))}>
              <option value="random">Random (lottery-style)</option>
              <option value="algorithmic">Algorithmic (score frequency)</option>
            </select>
          </div>
          <div>
            <label className="label">Prize Pool (₹)</label>
            <input type="number" className="input" value={newDraw.prize_pool_total} required
              onChange={e => setNewDraw(d => ({ ...d, prize_pool_total: e.target.value }))} />
          </div>
          <div>
            <label className="label">Rollover from prev. month (₹)</label>
            <input type="number" className="input" value={newDraw.rollover_amount}
              onChange={e => setNewDraw(d => ({ ...d, rollover_amount: e.target.value }))} />
          </div>
          <div className="flex items-end gap-3">
            <button type="submit" className="btn-primary text-sm">Create</button>
            <button type="button" onClick={() => setCreating(false)} className="btn-ghost text-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {loading
          ? Array(3).fill(0).map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)
          : draws.map(d => (
            <div key={d.id} className="card-gold">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="font-display text-xl font-400 text-cream-100">
                      {MONTHS[(d.draw_month || 1) - 1]} {d.draw_year}
                    </h3>
                    <span className={`badge ${
                      d.status === 'published' || d.status === 'completed' ? 'badge-active' :
                      d.status === 'simulated' ? 'badge-pending' : 'badge-inactive'
                    }`}>{d.status}</span>
                    <span className="text-xs text-cream-100/30 font-body capitalize">{d.draw_type}</span>
                    {d.jackpot_rollover && (
                      <span className="badge bg-coral-500/15 text-coral-400 border border-coral-500/20">
                        Jackpot Rolled Over
                      </span>
                    )}
                  </div>

                  {d.draw_numbers?.length > 0 && (
                    <div className="flex gap-2 mb-2">
                      {d.draw_numbers.map(n => (
                        <span key={n} className="w-9 h-9 rounded-lg bg-gold-500/15 border border-gold-500/25 flex items-center justify-center font-display text-gold-400 font-500">
                          {n}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-cream-100/30 font-body">
                    Pool: ₹{(d.prize_pool_total || 0).toLocaleString('en-IN')} |
                    Jackpot: ₹{(d.jackpot_pool || 0).toLocaleString('en-IN')} |
                    4-Match: ₹{(d.match4_pool || 0).toLocaleString('en-IN')} |
                    3-Match: ₹{(d.match3_pool || 0).toLocaleString('en-IN')}
                  </p>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {['draft', 'simulated'].includes(d.status) && (
                    <button onClick={() => simulate(d.id)} disabled={!!actionLoading} className="btn-secondary text-sm gap-1.5">
                      {actionLoading === d.id + '-sim' ? '…' : <><BarChart3 className="w-4 h-4" /> Simulate</>}
                    </button>
                  )}
                  {['draft', 'simulated'].includes(d.status) && (
                    <button onClick={() => publish(d.id)} disabled={!!actionLoading} className="btn-primary text-sm gap-1.5">
                      {actionLoading === d.id + '-pub' ? '…' : <><Globe className="w-4 h-4" /> Publish</>}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ── AdminPayouts ─────────────────────────────────────────────
import { CheckCircle, XCircle, DollarSign, ImageIcon, X } from 'lucide-react'

export function AdminPayouts() {
  const [payouts, setPayouts]       = useState([])
  const [filter, setFilter]         = useState('')
  const [loading, setLoading]       = useState(true)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [payRef, setPayRef]         = useState({ id: null, ref: '' })

  // [FIX 2]
  const isMounted = useRef(true)
  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  // [FIX 1]
  const load = async (s = '') => {
    if (isMounted.current) setLoading(true)
    try {
      const r = await api.admin.payouts(s)
      if (isMounted.current) setPayouts(r.payouts || [])
    } catch (err) {
      console.error('[AdminPayouts] load error:', err.message)
      if (isMounted.current) toast.error('Unable to load payouts right now.', { id: 'admin-payouts-error' })
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // [FIX 6] isMounted checked before reloading after actions
  const review = async (id, action) => {
    try {
      await api.admin.reviewPayout(id, { action })
      toast.success(`Payout ${action === 'approve' ? 'approved ✓' : 'rejected'}`)
      if (isMounted.current) load(filter)
    } catch (err) {
      toast.error(err.message || 'Failed to review payout. Please try again.')
    }
  }

  const markPaid = async () => {
    if (!payRef.id) return
    try {
      await api.admin.markPaid(payRef.id, { payment_reference: payRef.ref })
      toast.success('Marked as paid!')
      if (isMounted.current) {
        setPayRef({ id: null, ref: '' })
        load(filter)
      }
    } catch (err) {
      toast.error(err.message || 'Failed to mark as paid. Please try again.')
    }
  }

  const STATUSES = ['', 'pending', 'proof_submitted', 'approved', 'rejected', 'paid']
  const isImage  = (url) => url && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url)
  const isPdf    = (url) => url && /\.pdf(\?|$)/i.test(url)

  return (
    <div>
      {/* Image Lightbox */}
      {previewUrl && (
        <div
          className="fixed inset-0 bg-forest-950/95 backdrop-blur-md z-50 flex items-center justify-center p-6"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-cream-100"
            onClick={() => setPreviewUrl(null)}
          >
            <X className="w-5 h-5" />
          </button>
          <div onClick={e => e.stopPropagation()} className="max-w-4xl w-full max-h-[85vh]">
            <img
              src={previewUrl}
              alt="Winner proof screenshot"
              className="w-full h-full object-contain rounded-2xl border border-white/10 shadow-2xl"
            />
            <a href={previewUrl} target="_blank" rel="noopener noreferrer"
              className="mt-4 flex items-center justify-center gap-2 text-sm text-cream-100/40 hover:text-gold-400 font-body">
              Open in new tab →
            </a>
          </div>
        </div>
      )}

      {/* Mark Paid Modal */}
      {payRef.id && (
        <div className="fixed inset-0 bg-forest-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="card-gold p-8 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-2xl font-400 text-cream-100 mb-2">Mark as Paid</h3>
            <p className="text-cream-100/40 font-body text-sm mb-6">
              Enter a payment reference (bank transfer ID, UPI ref, etc.) for your records.
            </p>
            <div className="mb-4">
              <label className="label">Payment Reference (optional)</label>
              <input
                className="input"
                placeholder="e.g. TXN1234567890"
                value={payRef.ref}
                onChange={e => setPayRef(r => ({ ...r, ref: e.target.value }))}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={markPaid} className="btn-primary flex-1 justify-center">
                <DollarSign className="w-4 h-4" /> Confirm Payment
              </button>
              <button onClick={() => setPayRef({ id: null, ref: '' })} className="btn-ghost">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-4xl font-300 text-cream-100 mb-1">Payouts</h1>
          <p className="text-cream-100/40 font-body text-sm">Verify winner proofs and manage prize payments</p>
        </div>
        <select
          className="input w-52"
          value={filter}
          onChange={e => { setFilter(e.target.value); load(e.target.value) }}
        >
          {STATUSES.map(s => (
            <option key={s} value={s}>{s ? s.replace(/_/g, ' ') : 'All statuses'}</option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {loading
          ? Array(3).fill(0).map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)
          : payouts.length === 0
            ? (
              <div className="text-center py-16 text-cream-100/30">
                <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-body">No payouts found</p>
              </div>
            )
            : payouts.map(p => (
              <div key={p.id} className="card-gold">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-body font-500 text-cream-100">{p.user?.full_name || '—'}</p>
                      <span className="text-cream-100/30">·</span>
                      <span className="badge bg-gold-500/15 text-gold-400 border border-gold-500/20">{p.match_type}</span>
                      <span className={`badge ${
                        p.status === 'paid'            ? 'badge-paid' :
                        p.status === 'approved'        ? 'badge-active' :
                        p.status === 'proof_submitted' ? 'badge-pending' :
                        p.status === 'rejected'        ? 'badge-rejected' : 'badge-inactive'
                      }`}>{p.status?.replace(/_/g, ' ')}</span>
                    </div>

                    <p className="text-xs text-cream-100/40 font-body mb-2">{p.user?.email}</p>
                    <p className="font-display text-2xl font-500 text-gold-400">
                      ₹{(p.gross_amount || 0).toLocaleString('en-IN')}
                    </p>

                    {p.draw && (
                      <p className="text-xs text-cream-100/30 font-body mt-1">
                        Draw: {MONTHS[(p.draw.draw_month || 1) - 1]} {p.draw.draw_year}
                        {p.draw.draw_numbers?.length > 0 && <> · Numbers: {p.draw.draw_numbers.join(', ')}</>}
                      </p>
                    )}

                    {/* Proof preview */}
                    {p.proof_url && (
                      <div className="mt-3">
                        {isImage(p.proof_url) ? (
                          <div>
                            <p className="text-xs text-cream-100/30 font-body mb-2">Winner Proof Screenshot</p>
                            <img
                              src={p.proof_url}
                              alt="Winner proof"
                              onClick={() => setPreviewUrl(p.proof_url)}
                              className="w-40 h-28 object-cover rounded-xl border border-white/10 cursor-pointer hover:border-gold-500/40 hover:shadow-lg hover:shadow-gold-500/10 transition-all"
                            />
                            <p className="text-xs text-cream-100/20 font-body mt-1">Click to view full size</p>
                          </div>
                        ) : isPdf(p.proof_url) ? (
                          <div>
                            <p className="text-xs text-cream-100/30 font-body mb-2">Winner Proof (PDF)</p>
                            <a href={p.proof_url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-forest-800 border border-white/8 text-xs text-gold-400 hover:border-gold-500/30 font-body transition-colors w-fit">
                              <ImageIcon className="w-4 h-4" /> Open PDF proof →
                            </a>
                          </div>
                        ) : (
                          <a href={p.proof_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-gold-400/60 hover:text-gold-400 font-body underline">
                            View proof →
                          </a>
                        )}
                      </div>
                    )}

                    {p.admin_notes && (
                      <p className="text-xs text-cream-100/30 font-body mt-2 italic">Note: {p.admin_notes}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {p.status === 'proof_submitted' && (
                      <>
                        <button onClick={() => review(p.id, 'approve')} className="btn-primary text-sm gap-1.5">
                          <CheckCircle className="w-4 h-4" /> Approve
                        </button>
                        <button onClick={() => review(p.id, 'reject')}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-body text-red-400 border border-red-500/20 hover:bg-red-500/8 transition-all">
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                      </>
                    )}
                    {p.status === 'approved' && (
                      <button onClick={() => setPayRef({ id: p.id, ref: '' })} className="btn-primary text-sm gap-1.5">
                        <DollarSign className="w-4 h-4" /> Mark Paid
                      </button>
                    )}
                    {p.status === 'paid' && p.payment_reference && (
                      <p className="text-xs text-emerald-400/60 font-body text-right">Ref: {p.payment_reference}</p>
                    )}
                  </div>
                </div>
              </div>
            ))
        }
      </div>
    </div>
  )
}

// ── AdminCharities ───────────────────────────────────────────
import { Pencil, Trash2, Heart as HeartIcon, Star } from 'lucide-react'

export function AdminCharities() {
  const [charities, setCharities] = useState([])
  const [loading, setLoading]     = useState(true)
  const [editForm, setEditForm]   = useState(null)
  const [form, setForm]           = useState({
    name: '', slug: '', description: '', short_description: '', website: '', is_featured: false,
  })

  // [FIX 2]
  const isMounted = useRef(true)
  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  // [FIX 1]
  const load = async () => {
    if (isMounted.current) setLoading(true)
    try {
      const r = await api.charities.list()
      if (isMounted.current) setCharities(r.charities || [])
    } catch (err) {
      console.error('[AdminCharities] load error:', err.message)
      if (isMounted.current) toast.error('Unable to load charities right now.', { id: 'admin-charities-error' })
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const startEdit = (c) => {
    setEditForm(c.id)
    setForm({ name: c.name, slug: c.slug, description: c.description, short_description: c.short_description || '', website: c.website || '', is_featured: c.is_featured })
  }
  const startNew = () => {
    setEditForm('new')
    setForm({ name: '', slug: '', description: '', short_description: '', website: '', is_featured: false })
  }

  const save = async (e) => {
    e.preventDefault()
    try {
      if (editForm === 'new') {
        await api.charities.create(form)
        toast.success('Charity created!')
      } else {
        await api.charities.update(editForm, form)
        toast.success('Charity updated!')
      }
      setEditForm(null)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to save charity. Please try again.')
    }
  }

  const deactivate = async (id) => {
    if (!confirm('Deactivate this charity? It will be hidden from users.')) return
    try {
      await api.charities.remove(id)
      toast.success('Charity deactivated')
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to deactivate charity. Please try again.')
    }
  }

  const handleNameChange = (val) => {
    setForm(f => ({
      ...f,
      name: val,
      slug: editForm === 'new'
        ? val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        : f.slug,
    }))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-4xl font-300 text-cream-100 mb-1">Charities</h1>
          <p className="text-cream-100/40 font-body text-sm">{charities.length} active charities</p>
        </div>
        <button onClick={startNew} className="btn-primary text-sm">
          <Plus className="w-4 h-4" /> Add Charity
        </button>
      </div>

      {editForm && (
        <form onSubmit={save} className="card-gold mb-8 space-y-4">
          <h3 className="font-display text-xl text-cream-100">
            {editForm === 'new' ? 'New Charity' : 'Edit Charity'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Name</label>
              <input className="input" value={form.name} required onChange={e => handleNameChange(e.target.value)} />
            </div>
            <div>
              <label className="label">Slug (auto-generated, URL-safe)</label>
              <input className="input font-mono text-sm" value={form.slug} required onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Short Description (shown on cards)</label>
            <input className="input" value={form.short_description} onChange={e => setForm(f => ({ ...f, short_description: e.target.value }))} />
          </div>
          <div>
            <label className="label">Full Description</label>
            <textarea rows={3} className="input resize-none" value={form.description} required onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div>
              <label className="label">Website URL</label>
              <input className="input" value={form.website} type="url" onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
            </div>
            <div className="pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_featured} onChange={e => setForm(f => ({ ...f, is_featured: e.target.checked }))} className="accent-gold-500 w-4 h-4" />
                <span className="text-sm font-body text-cream-100/70">Featured on homepage</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary text-sm">{editForm === 'new' ? 'Create Charity' : 'Save Changes'}</button>
            <button type="button" onClick={() => setEditForm(null)} className="btn-ghost text-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {loading
          ? Array(4).fill(0).map((_, i) => <div key={i} className="skeleton h-36 rounded-2xl" />)
          : charities.map(c => (
            <div key={c.id} className="card-gold group">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-coral-500/15 flex items-center justify-center flex-shrink-0">
                    <HeartIcon className="w-4 h-4 text-coral-500" />
                  </div>
                  <div>
                    <p className="font-body font-500 text-cream-100 flex items-center gap-1.5">
                      {c.name}
                      {c.is_featured && <Star className="w-3.5 h-3.5 text-gold-400 fill-gold-400" />}
                    </p>
                    <p className="text-xs text-cream-100/30 font-body font-mono">/{c.slug}</p>
                  </div>
                </div>
                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(c)} className="p-1.5 rounded-lg hover:bg-white/8 text-cream-100/40 hover:text-gold-400 transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => deactivate(c.id)} className="p-1.5 rounded-lg hover:bg-white/8 text-cream-100/40 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-cream-100/50 font-body leading-relaxed">{c.short_description}</p>
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                <span className="text-xs text-cream-100/25 font-body">Total raised</span>
                <span className="font-display text-lg font-500 text-gold-400">
                  ₹{(c.total_received || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  )
}

export default AdminUsers
