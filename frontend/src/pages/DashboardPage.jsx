import { useEffect, useState, useRef, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target, Trophy, Heart, TrendingUp, Plus, Pencil, Trash2,
  Upload, Calendar, ChevronRight, AlertCircle, CheckCircle, Clock,
  Settings, X, Loader2, LogOut
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { supabase } from '../lib/supabase'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// --- Animation Variants ---
const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
}

export default function DashboardPage() {
  const { profile, isSubscribed, refreshProfile, signOut } = useAuth()
  const [scores, setScores]                 = useState([])
  const [entries, setEntries]               = useState([])
  const [scoresLoading, setScoresLoading]   = useState(false)   
  const [entriesLoading, setEntriesLoading] = useState(false)   
  const [showSettings, setShowSettings]     = useState(false)
  const [params] = useSearchParams()

  const isMounted = useRef(true)
  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  const loadScores = useCallback(async () => {
    if (isMounted.current) setScoresLoading(true)
    try {
      const result = await api.scores.list()
      if (isMounted.current) setScores(result.scores || [])
    } catch (err) {
      console.error('[Dashboard] loadScores error:', err)
      if (isMounted.current) toast.error('Unable to load your scores right now.', { id: 'scores-error' })
    } finally {
      if (isMounted.current) setScoresLoading(false)
    }
  }, [])

  const loadEntries = useCallback(async () => {
    if (isMounted.current) setEntriesLoading(true)
    try {
      const result = await api.draws.myEntries()
      if (isMounted.current) setEntries(result.entries || [])
    } catch (err) {
      console.error('[Dashboard] loadEntries error:', err)
      if (isMounted.current) toast.error('Unable to load your draw history right now.', { id: 'entries-error' })
    } finally {
      if (isMounted.current) setEntriesLoading(false)
    }
  }, [])

  useEffect(() => {
    const isSuccess = params.get('subscription') === 'success'
    if (!isSuccess) return

    toast.success('Payment received! Activating your subscription…')

    // THE KILL SWITCH: Erase '?subscription=success' from the browser URL instantly
    window.history.replaceState(null, '', window.location.pathname)

    let attempts     = 0
    const MAX        = 8
    const INTERVAL   = 2000 

    const poll = async () => {
      attempts++
      await refreshProfile()
    }

    poll()

    const interval = setInterval(async () => {
      if (!isMounted.current) {
        clearInterval(interval)
        return
      }

      if (attempts >= MAX) {
        clearInterval(interval)
        console.warn('[Dashboard] Subscription poll timed out — webhook may be delayed.')
        toast.error(
          'Subscription activation is taking longer than expected. Please refresh in a moment.',
          { duration: 6000 }
        )
        return
      }

      await poll()
    }, INTERVAL)

    return () => clearInterval(interval)
  }, [params, refreshProfile])
  useEffect(() => {
    if (!isSubscribed) return
    loadScores()
    loadEntries()
  }, [isSubscribed, loadScores, loadEntries])

  if (!profile) return <LoadingDash />

  return (
    <div className="min-h-screen pt-28 pb-20 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        
        {/* --- Header Section --- */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex items-start justify-between mb-12 flex-wrap gap-6"
        >
          <div>
            <p className="text-gold-400/60 font-body text-xs tracking-widest uppercase mb-2">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="font-display text-5xl font-300 text-cream-100 tracking-tight">
              Hello, <em className="not-italic text-gradient-gold font-400">{profile.full_name?.split(' ')[0] || 'Player'}</em>
            </h1>
          </div>
          <div className="flex items-center gap-4 bg-forest-900/30 p-2 rounded-2xl border border-white/5 backdrop-blur-md">
            <button onClick={() => setShowSettings(true)} className="btn-ghost text-sm gap-2 px-4 py-2 hover:bg-white/5 rounded-xl transition-colors">
              <Settings className="w-4 h-4" /> Settings
            </button>
            <div className="w-px h-5 bg-white/10"></div>
            <button 
              onClick={signOut} 
              className="btn-ghost text-sm gap-2 text-red-400/80 hover:text-red-400 hover:bg-red-500/10 px-4 py-2 rounded-xl transition-colors"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
            {!isSubscribed && (
              <Link to="/subscribe" className="btn-primary ml-2 shadow-lg shadow-gold-500/20 hover:shadow-gold-500/40">
                Activate <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </motion.div>

        <motion.div variants={containerVariants} initial="hidden" animate="show">
          <motion.div variants={itemVariants}>
            <SubscriptionStatus profile={profile} />
          </motion.div>

          {/* --- Context Banner --- */}
          {isSubscribed && (
            <motion.div variants={itemVariants} className="mt-6 mb-8">
              <div className="p-5 rounded-2xl bg-gradient-to-r from-forest-800/60 to-gold-500/10 border border-gold-500/20 flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-sm shadow-xl shadow-forest-950/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gold-500/15 flex items-center justify-center border border-gold-500/30 shadow-inner">
                    <Calendar className="w-5 h-5 text-gold-400" />
                  </div>
                  <div>
                    <p className="text-base font-display font-400 text-cream-100 tracking-wide">The next Draw is approaching!</p>
                    <p className="text-sm text-cream-100/50 font-body mt-0.5">Maintain 5 active scores to qualify for the Jackpot pool.</p>
                  </div>
                </div>
                {scores.length < 5 ? (
                  <span className="text-sm font-mono font-500 text-coral-400 bg-coral-500/10 px-4 py-2 rounded-xl border border-coral-500/20 shadow-sm">
                    {5 - scores.length} scores needed
                  </span>
                ) : (
                  <span className="text-sm font-mono font-500 text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20 flex items-center gap-2 shadow-sm">
                    <CheckCircle className="w-4 h-4" /> Fully Qualified
                  </span>
                )}
              </div>
            </motion.div>
          )}

          {params.get('subscription') === 'success' && !isSubscribed && (
            <motion.div variants={itemVariants} className="mt-6 flex items-center gap-3 p-5 rounded-2xl bg-gold-500/10 border border-gold-500/30 shadow-lg shadow-gold-500/5">
              <Loader2 className="w-5 h-5 text-gold-400 animate-spin flex-shrink-0" />
              <p className="text-sm text-gold-400 font-body font-500 tracking-wide">
                Confirming your premium subscription… this usually takes a few seconds.
              </p>
            </motion.div>
          )}

          {!isSubscribed && !params.get('subscription') ? (
            <motion.div variants={itemVariants}>
              <SubscribePrompt />
            </motion.div>
          ) : isSubscribed ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
              <div className="lg:col-span-2 space-y-8">
                <motion.div variants={itemVariants}>
                  <ScoreSection scores={scores} onRefresh={loadScores} loading={scoresLoading} />
                </motion.div>
                <motion.div variants={itemVariants}>
                  <DrawEntriesSection entries={entries} onRefresh={loadEntries} loading={entriesLoading} />
                </motion.div>
              </div>
              <div className="space-y-8">
                <motion.div variants={itemVariants}>
                  <CharityPanel profile={profile} onOpenSettings={() => setShowSettings(true)} />
                </motion.div>
                <motion.div variants={itemVariants}>
                  <WinningsPanel entries={entries} />
                </motion.div>
              </div>
            </div>
          ) : null}
        </motion.div>
      </div>

      <AnimatePresence>
        {showSettings && (
          <SettingsDrawer
            profile={profile}
            onClose={() => setShowSettings(false)}
            onSaved={refreshProfile}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── SETTINGS DRAWER ─────────────────────────────────────── */
function SettingsDrawer({ profile, onClose, onSaved }) {
  const [form, setForm] = useState({
    full_name: profile.full_name || '',
    phone: profile.phone || '',
    charity_contribution_percent: profile.charity_contribution_percent || 10,
  })
  const [saving, setSaving] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.profiles.update(form)
      toast.success('Settings saved!')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err.message || 'Unable to save settings. Please try again.')
    } finally { setSaving(false) }
  }

  const baseAmount  = profile.subscription_plan === 'yearly' ? 4999 : 499
  const donationAmt = Math.round(baseAmount * form.charity_contribution_percent / 100)

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-forest-950/80 backdrop-blur-md z-40"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 h-full w-full max-w-md bg-forest-900 border-l border-white/5 shadow-2xl z-50 overflow-y-auto"
      >
        <div className="p-8">
          <div className="flex items-center justify-between mb-10">
            <h2 className="font-display text-3xl font-300 text-cream-100">Account Settings</h2>
            <button onClick={onClose} className="p-2.5 rounded-xl bg-forest-800 hover:bg-forest-700 text-cream-100/40 transition-colors border border-white/5">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={save} className="space-y-8">
            <div>
              <p className="text-xs font-body font-500 text-gold-400/50 uppercase tracking-widest mb-5">Profile Details</p>
              <div className="space-y-5">
                <div>
                  <label className="label">Full Name</label>
                  <input className="input bg-forest-950/50 border-white/10 focus:border-gold-500/50" value={form.full_name}
                    onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input bg-forest-950/50 border-white/10 focus:border-gold-500/50" value={form.phone} type="tel"
                    placeholder="+91 9876543210"
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-body font-500 text-gold-400/50 uppercase tracking-widest mb-5">Charity Contribution</p>
              <div className="p-6 rounded-2xl bg-forest-800/30 border border-white/5 shadow-inner">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-body font-500 text-cream-100">Your donation percentage</p>
                  <div className="flex items-baseline gap-0.5">
                    <span className="font-display text-4xl font-400 text-coral-500">{form.charity_contribution_percent}</span>
                    <span className="text-coral-500/60 font-body text-base">%</span>
                  </div>
                </div>
                <input
                  type="range" min="10" max="100" step="5"
                  value={form.charity_contribution_percent}
                  onChange={e => setForm(f => ({ ...f, charity_contribution_percent: Number(e.target.value) }))}
                  className="w-full accent-coral-500 mb-2 cursor-pointer"
                />
                <div className="flex justify-between text-xs text-cream-100/30 font-body mb-6">
                  <span>10% (minimum)</span>
                  <span>100%</span>
                </div>
                <div className="p-4 rounded-xl bg-forest-950/60 border border-coral-500/20">
                  <p className="text-xs text-cream-100/50 font-body">
                    Your next donation to <span className="text-coral-400 font-500">{profile.charity?.name || 'your charity'}</span>
                  </p>
                  <p className="font-display text-3xl font-400 text-coral-400 mt-1">
                    ₹{donationAmt.toLocaleString('en-IN')}
                    <span className="text-sm font-body text-cream-100/30 ml-2">
                      per {profile.subscription_plan === 'yearly' ? 'year' : 'month'}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <button type="submit" disabled={saving} className="btn-primary w-full justify-center py-4 text-sm tracking-wide shadow-lg shadow-gold-500/10 hover:shadow-gold-500/20">
              {saving ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving Configuration…</> : 'Save Settings'}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-white/5">
            <p className="text-xs font-body font-500 text-gold-400/50 uppercase tracking-widest mb-5">Billing</p>
            <button
              onClick={async () => {
                try {
                  const { url } = await api.payments.portal()
                  window.location.href = url
                } catch {
                  toast.error('Unable to open billing portal. Please try again.')
                }
              }}
              className="btn-secondary w-full justify-center py-3.5 text-sm bg-forest-800 hover:bg-forest-700 border-white/10"
            >
              Manage Subscription & Payment →
            </button>
          </div>
        </div>
      </motion.div>
    </>
  )
}

/* ── SUBSCRIPTION STATUS ──────────────────────────────────── */
function SubscriptionStatus({ profile }) {
  const map = {
    active:    { cls: 'badge-active',   label: 'Active' },
    inactive:  { cls: 'badge-inactive', label: 'Inactive' },
    cancelled: { cls: 'badge-pending',  label: 'Cancelling at period end' },
    lapsed:    { cls: 'badge-rejected', label: 'Lapsed — payment failed' },
  }
  const s = map[profile.subscription_status] || map.inactive
  return (
    <div className="flex items-center gap-4 p-5 rounded-2xl bg-forest-900/40 border border-white/5 backdrop-blur-sm shadow-sm flex-wrap">
      <span className={s.cls}>{s.label}</span>
      <span className="text-cream-100/80 font-body text-sm capitalize px-2 border-l border-white/10">{profile.subscription_plan || 'No plan'}</span>
      {profile.subscription_end_date && (
        <span className="text-sm text-cream-100/40 font-body border-l border-white/10 pl-4">
          {profile.subscription_status === 'cancelled' ? 'Ends' : 'Renews'}{' '}
          <span className="text-cream-100/70">{new Date(profile.subscription_end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </span>
      )}
    </div>
  )
}

/* ── SUBSCRIBE PROMPT ────────────────────────────────────── */
function SubscribePrompt() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="mt-12 text-center py-20 rounded-[2rem] border border-dashed border-gold-500/30 bg-gradient-to-b from-gold-500/5 to-transparent backdrop-blur-sm"
    >
      <div className="w-20 h-20 rounded-full bg-gold-500/10 flex items-center justify-center mx-auto mb-6 border border-gold-500/20">
        <Trophy className="w-10 h-10 text-gold-400" />
      </div>
      <h2 className="font-display text-4xl font-300 text-cream-100 mb-4 tracking-tight">Subscribe to unlock everything</h2>
      <p className="text-cream-100/50 font-body mb-10 max-w-md mx-auto text-lg leading-relaxed">
        High-fidelity score tracking, algorithmic draws, and seamless charity integration — deployed in one secure subscription.
      </p>
      <Link to="/subscribe" className="btn-primary px-10 py-4 text-base shadow-xl shadow-gold-500/10 hover:shadow-gold-500/30 hover:-translate-y-0.5 transition-all">
        View Subscription Plans <ChevronRight className="w-5 h-5" />
      </Link>
    </motion.div>
  )
}

/* ── SCORE SECTION ───────────────────────────────────────── */
function ScoreSection({ scores, onRefresh, loading }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({ score: '', score_date: '', notes: '' })
  const [editId, setEditId]     = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (editId) {
        await api.scores.update(editId, { score: form.score, notes: form.notes })
        toast.success('Score updated')
      } else {
        await api.scores.add(form)
        toast.success('Score added!')
      }
      onRefresh()
      setShowForm(false)
      setEditId(null)
      setForm({ score: '', score_date: '', notes: '' })
    } catch (err) {
      if (err.code === 'DUPLICATE_DATE') {
        toast.error('You already have a score for that date. Edit or delete it first.')
      } else {
        toast.error(err.message || 'Unable to save score. Please try again.')
      }
    } finally { setSubmitting(false) }
  }

  const startEdit = (s) => {
    setEditId(s.id)
    setForm({ score: s.score, score_date: s.score_date, notes: s.notes || '' })
    setShowForm(true)
  }

  const deleteScore = async (id) => {
    if (!confirm('Delete this score?')) return
    try {
      await api.scores.delete(id)
      toast.success('Score deleted')
      onRefresh()
    } catch (err) {
      toast.error('Unable to delete score. Please try again.')
    }
  }

  return (
    <div className="card bg-forest-900/40 border border-white/5 backdrop-blur-md p-8 hover:shadow-2xl hover:border-gold-500/10 transition-all duration-500 rounded-3xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gold-500/10 border border-gold-500/20">
            <Target className="w-6 h-6 text-gold-400" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-400 text-cream-100 tracking-wide">Performance Tracking</h2>
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 text-cream-100/30 animate-spin mt-1" />
            ) : (
              <span className="text-sm text-cream-100/40 font-body">Stableford Buffer ({scores.length}/5)</span>
            )}
          </div>
        </div>
        <button
          onClick={() => { setShowForm(s => !s); setEditId(null); setForm({ score: '', score_date: '', notes: '' }) }}
          className="btn-ghost text-sm gap-2 px-4 py-2 hover:bg-gold-500/10 hover:text-gold-400 rounded-xl transition-colors border border-transparent hover:border-gold-500/20"
        >
          <Plus className="w-4 h-4" /> Add Score
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form
            key="score-form"
            initial={{ opacity: 0, height: 0, scale: 0.98 }} 
            animate={{ opacity: 1, height: 'auto', scale: 1 }} 
            exit={{ opacity: 0, height: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            onSubmit={submit}
            className="mb-8 p-6 rounded-2xl bg-forest-950/80 border border-gold-500/20 shadow-inner space-y-5 overflow-hidden"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="label text-cream-100/70">Stableford Score (1–45)</label>
                <input
                  type="number" min="1" max="45" value={form.score} required
                  onChange={e => setForm(f => ({ ...f, score: e.target.value }))}
                  className="input bg-forest-900 focus:border-gold-500/50" placeholder="e.g. 28"
                />
              </div>
              <div>
                <label className="label text-cream-100/70">Date Played</label>
                <input
                  type="date" value={form.score_date} required disabled={!!editId}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={e => setForm(f => ({ ...f, score_date: e.target.value }))}
                  className="input bg-forest-900 focus:border-gold-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>
            <div>
              <label className="label text-cream-100/70">Notes (optional)</label>
              <input
                type="text" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="input bg-forest-900 focus:border-gold-500/50" placeholder="Course details, weather conditions…"
              />
            </div>
            {editId && (
              <p className="text-xs text-gold-400/60 font-body flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Date immutability enforced. Delete and recreate to alter timeline.
              </p>
            )}
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={submitting} className="btn-primary text-sm px-6 py-2.5">
                {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {submitting ? 'Executing…' : editId ? 'Commit Changes' : 'Record Score'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditId(null) }} className="btn-ghost text-sm px-4 py-2 rounded-xl">
                Abort
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
      ) : scores.length === 0 ? (
        <div className="text-center py-16 text-cream-100/30 border border-dashed border-white/5 rounded-2xl bg-white/[0.02]">
          <Target className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="font-body text-base">Buffer empty. Awaiting telemetry.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {scores.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, x: -20 }} 
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05, duration: 0.2 }}
                className="flex items-center justify-between p-5 rounded-2xl bg-forest-800/30 border border-white/5 hover:bg-forest-800/50 hover:border-gold-500/20 transition-all group"
              >
                <div className="flex items-center gap-5">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-display text-2xl font-500 shadow-inner ${
                    i === 0
                      ? 'bg-gradient-to-br from-gold-500/20 to-gold-500/5 text-gold-400 border border-gold-500/30'
                      : 'bg-white/5 text-cream-100/70 border border-white/5'
                  }`}>
                    {s.score}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <p className="font-body font-500 text-cream-100 text-base tracking-wide">
                        {new Date(s.score_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      {i === 0 && (
                        <span className="text-[10px] font-mono text-gold-400 bg-gold-500/10 px-2 py-0.5 rounded-full border border-gold-500/20 uppercase tracking-widest">Latest</span>
                      )}
                    </div>
                    {s.notes && <p className="text-sm text-cream-100/40 font-body">{s.notes}</p>}
                  </div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(s)} className="p-2 rounded-xl hover:bg-white/10 text-cream-100/40 hover:text-gold-400 transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteScore(s.id)} className="p-2 rounded-xl hover:bg-white/10 text-cream-100/40 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
      <p className="mt-6 text-xs text-cream-100/30 font-body flex items-center gap-2">
        <AlertCircle className="w-3.5 h-3.5" />
        FIFO execution: Submitting a 6th entry automatically purges the oldest record.
      </p>
    </div>
  )
}

/* ── DRAW ENTRIES ────────────────────────────────────────── */
function DrawEntriesSection({ entries, onRefresh, loading }) {
  const recent              = entries.slice(0, 5)
  const [uploadingId, setUploadingId]         = useState(null)
  const [pendingPayoutId, setPendingPayoutId] = useState(null)
  const fileInputRef        = useRef(null)

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !pendingPayoutId) return

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast.error('Please upload an image (PNG, JPG) or PDF')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5MB')
      return
    }

    setUploadingId(pendingPayoutId)
    try {
      const ext      = file.name.split('.').pop()
      const fileName = `proof_${pendingPayoutId}_${Date.now()}.${ext}`

      const { data, error } = await supabase.storage
        .from('winner-proofs')
        .upload(fileName, file, { contentType: file.type, upsert: true })

      if (error) throw new Error(error.message)

      const { data: { publicUrl } } = supabase.storage
        .from('winner-proofs')
        .getPublicUrl(data.path)

      await api.profiles.uploadProof(pendingPayoutId, { proof_url: publicUrl })
      toast.success('Proof integrated successfully. Awaiting clearance.')
      onRefresh()
    } catch (err) {
      toast.error(err.message || 'Transmission failed. Retry upload.')
    } finally {
      setUploadingId(null)
      setPendingPayoutId(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const triggerUpload = (payoutId) => {
    setPendingPayoutId(payoutId)
    setTimeout(() => fileInputRef.current?.click(), 50)
  }

  return (
    <div className="card bg-forest-900/40 border border-white/5 backdrop-blur-md p-8 hover:shadow-2xl hover:border-gold-500/10 transition-all duration-500 rounded-3xl">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 rounded-xl bg-gold-500/10 border border-gold-500/20">
          <Trophy className="w-6 h-6 text-gold-400" />
        </div>
        <h2 className="font-display text-2xl font-400 text-cream-100 tracking-wide">Draw History</h2>
        {loading && <Loader2 className="w-4 h-4 text-cream-100/30 animate-spin ml-2" />}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
      ) : recent.length === 0 ? (
        <div className="text-center py-16 text-cream-100/30 border border-dashed border-white/5 rounded-2xl bg-white/[0.02]">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="font-body text-base">No active participations found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {recent.map(entry => {
            const draw        = entry.draw
            const payout      = entry.payout
            const isUploading = uploadingId === payout?.id

            return (
              <div key={entry.id} className="p-6 rounded-2xl bg-forest-800/30 border border-white/5 hover:bg-forest-800/50 transition-colors">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <p className="font-body font-500 text-cream-100 text-lg">
                      {MONTHS[(draw?.draw_month || 1) - 1]} {draw?.draw_year}
                    </p>
                    <p className="text-sm text-cream-100/40 font-mono mt-1 tracking-wider">
                      DATA: [{entry.entry_numbers?.join(', ') || '—'}]
                    </p>
                  </div>
                  <div className="text-right">
                    {entry.is_winner ? (
                      <span className="badge bg-gold-500/20 text-gold-400 border border-gold-500/30 shadow-lg shadow-gold-500/10 px-3 py-1">
                        <Trophy className="w-3.5 h-3.5 mr-1" /> Verified Winner
                      </span>
                    ) : (
                      <span className="text-sm font-mono text-cream-100/40 bg-white/5 px-3 py-1 rounded-lg border border-white/5">
                        {entry.match_count}/5 MATCH
                      </span>
                    )}
                  </div>
                </div>

                {draw?.draw_numbers?.length > 0 && (
                  <div className="flex gap-2 mb-5 flex-wrap">
                    {draw.draw_numbers.map(n => {
                      const isMatch = entry.entry_numbers?.includes(n)
                      return (
                        <span
                          key={n}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-mono font-600 shadow-inner transition-colors ${
                            isMatch
                              ? 'bg-gold-500/20 text-gold-400 border border-gold-500/40'
                              : 'bg-forest-950 text-cream-100/30 border border-white/5'
                          }`}
                        >
                          {n}
                        </span>
                      )
                    })}
                  </div>
                )}

                {payout && (
                  <div className="flex items-center justify-between pt-4 border-t border-white/10 flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      {payout.status === 'paid'            && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                      {payout.status === 'approved'        && <CheckCircle className="w-4 h-4 text-blue-400" />}
                      {payout.status === 'pending'         && <Clock className="w-4 h-4 text-gold-400" />}
                      {payout.status === 'proof_submitted' && <Clock className="w-4 h-4 text-blue-400" />}
                      {payout.status === 'rejected'        && <AlertCircle className="w-4 h-4 text-red-400" />}
                      <span className="text-sm text-cream-100/60 font-mono tracking-widest uppercase">
                        STATUS: {payout.status?.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-display text-2xl font-400 text-gold-400">
                        ₹{(payout.gross_amount || 0).toLocaleString('en-IN')}
                      </span>
                      {payout.status === 'pending' && (
                        <button
                          onClick={() => triggerUpload(payout.id)}
                          disabled={isUploading}
                          className="flex items-center gap-2 text-sm bg-forest-950 border border-white/10 px-4 py-2 rounded-xl
                            text-cream-100 hover:text-gold-400 hover:border-gold-500/40 shadow-md transition-all"
                        >
                          {isUploading
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                            : <><Upload className="w-4 h-4" /> Upload Proof</>
                          }
                        </button>
                      )}
                      {payout.status === 'rejected' && (
                        <span className="text-sm text-red-400/80 font-body hover:underline cursor-pointer">Request Audit</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── CHARITY PANEL ───────────────────────────────────────── */
function CharityPanel({ profile, onOpenSettings }) {
  const charity = profile?.charity
  const isActive = profile?.subscription_status === 'active'

  return (
    <div className="card-gold p-8 shadow-2xl shadow-gold-500/10 rounded-3xl relative overflow-hidden group">
      {/* Subtle background glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-coral-500/10 rounded-full blur-3xl group-hover:bg-coral-500/20 transition-all duration-700 pointer-events-none"></div>
      
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-coral-500/10 border border-coral-500/20">
            <Heart className="w-5 h-5 text-coral-500" />
          </div>
          <h3 className="font-display text-2xl font-400 text-cream-100 tracking-wide">Social Impact</h3>
        </div>
        <button onClick={onOpenSettings} className="text-xs font-mono tracking-widest text-cream-100/40 hover:text-gold-400 transition-colors uppercase border-b border-transparent hover:border-gold-400/30">
          Modify %
        </button>
      </div>
      
      {charity ? (
        <div className="relative z-10">
          <p className="text-lg font-display font-400 text-cream-100 mb-2">{charity.name}</p>
          <p className="text-sm text-cream-100/50 font-body mb-6 leading-relaxed line-clamp-2">{charity.short_description}</p>
          
          <div className="flex items-center justify-between p-4 rounded-2xl bg-forest-950/60 border border-white/5 shadow-inner mb-4">
            <span className="text-sm text-cream-100/50 font-body">Allocation</span>
            <span className="font-display text-2xl font-400 text-coral-500">{profile.charity_contribution_percent || 10}%</span>
          </div>
          
          {charity.total_received > 0 && (
            <div className="mt-4 text-center p-4 rounded-2xl bg-white/[0.02] border border-white/[0.03]">
              <p className="text-xs font-mono text-gold-400/50 uppercase tracking-widest mb-1">Global Platform Yield</p>
              <p className="font-display text-3xl font-300 text-gold-400">₹{charity.total_received.toLocaleString('en-IN')}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 relative z-10">
          <Heart className="w-10 h-10 text-coral-500/20 mx-auto mb-4" />
          <p className="text-base text-cream-100/50 font-body mb-6">No active routing for charitable funds.</p>
          {isActive ? (
            <button onClick={onOpenSettings} className="btn-secondary w-full justify-center py-3 border-coral-500/20 text-coral-400 hover:bg-coral-500/10">
              Configure Allocation
            </button>
          ) : (
            <Link to="/subscribe" className="btn-secondary w-full justify-center py-3 border-coral-500/20 text-coral-400 hover:bg-coral-500/10">
              Select Recipient
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

/* ── WINNINGS PANEL ──────────────────────────────────────── */
function WinningsPanel({ entries }) {
  const winners = entries.filter(e => e.is_winner)
  const total   = winners.reduce((s, e) => s + (e.payout?.gross_amount || 0), 0)
  const paid    = winners.filter(e => e.payout?.status === 'paid').reduce((s, e) => s + (e.payout?.gross_amount || 0), 0)
  const pending = winners.filter(e => ['pending','proof_submitted','approved'].includes(e.payout?.status)).reduce((s, e) => s + (e.payout?.gross_amount || 0), 0)
  
  return (
    <div className="card bg-forest-900/40 border border-white/5 backdrop-blur-md p-8 hover:shadow-2xl hover:border-gold-500/10 transition-all duration-500 rounded-3xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
        </div>
        <h3 className="font-display text-2xl font-400 text-cream-100 tracking-wide">Capital Inflow</h3>
      </div>
      
      <div className="space-y-4">
        <div className="p-5 rounded-2xl bg-forest-950/50 border border-white/5 shadow-inner">
          <span className="block text-xs font-mono text-gold-400/50 uppercase tracking-widest mb-2">Total Yield</span>
          <span className="block font-display text-4xl font-300 text-gold-400">₹{total.toLocaleString('en-IN')}</span>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 text-center">
            <span className="block text-xs font-mono text-emerald-400/60 uppercase tracking-widest mb-1">Cleared</span>
            <span className="block font-display text-2xl font-400 text-emerald-400">₹{paid.toLocaleString('en-IN')}</span>
          </div>
          <div className="p-4 rounded-2xl bg-gold-500/5 border border-gold-500/10 text-center">
            <span className="block text-xs font-mono text-gold-400/60 uppercase tracking-widest mb-1">Pending</span>
            <span className="block font-display text-2xl font-400 text-gold-400">₹{pending.toLocaleString('en-IN')}</span>
          </div>
        </div>
        
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between">
          <span className="text-sm font-body text-cream-100/50">Draws Participated</span>
          <span className="font-display text-xl font-400 text-cream-100">{entries.length}</span>
        </div>
      </div>
    </div>
  )
}

function LoadingDash() {
  return (
    <div className="min-h-screen pt-28 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="skeleton h-24 w-1/3 rounded-2xl mb-12" />
        <div className="skeleton h-24 rounded-2xl mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="skeleton h-96 rounded-3xl" />
            <div className="skeleton h-96 rounded-3xl" />
          </div>
          <div className="space-y-8">
            <div className="skeleton h-72 rounded-3xl" />
            <div className="skeleton h-72 rounded-3xl" />
          </div>
        </div>
      </div>
    </div>
  )
}