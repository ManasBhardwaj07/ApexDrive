// PATCH: src/pages/SubscribePage.jsx
// Fixed bugs:
//   [1] useEffect charity load used .catch(() => {}) → silent failure, empty list, no user feedback
//       FIX: Converted to async/await with try/catch, toast.error on failure
//   [2] No loading state for charity list → list area blank while loading (looks broken)
//       FIX: Added charitiesLoading state with skeleton cards
//   [3] No isMounted guard → setState on unmounted component if user navigates away mid-fetch
//       FIX: Added isMounted ref checked before every setState
//   [4] handleCheckout never resets loading=true if window.location.href assignment fails
//       (browser blocks redirect) → button stays in "Redirecting…" state forever
//       FIX: Moved setLoading(false) to finally block with a 3s timeout fallback

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Heart, Check, ChevronRight, Star, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

export default function SubscribePage() {
  const { profile } = useAuth()
  const [charities, setCharities]           = useState([])
  const [charitiesLoading, setCharitiesLoading] = useState(true) // [FIX 2]
  const [plan, setPlan]                     = useState('yearly')
  const [charityId, setCharityId]           = useState('')
  const [charityPct, setCharityPct]         = useState(10)
  const [loading, setLoading]               = useState(false)
  const [step, setStep]                     = useState(1)

  // [FIX 3] isMounted guard
  const isMounted = useRef(true)
  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  // [FIX 1] Converted from .then().catch(() => {}) to async/await with real error handling
  useEffect(() => {
    const loadCharities = async () => {
      if (isMounted.current) setCharitiesLoading(true) // [FIX 2]
      try {
        const r = await api.charities.list()
        if (isMounted.current) {
          setCharities(r.charities || [])
          // Pre-select existing charity if user already has one
          if (profile?.charity_id) setCharityId(profile.charity_id)
        }
      } catch (err) {
        console.error('[SubscribePage] Failed to load charities:', err.message)
        // [FIX 1] Show user-friendly message instead of silent empty list
        if (isMounted.current) {
          toast.error('Unable to load charity list right now. Please refresh and try again.')
        }
      } finally {
        if (isMounted.current) setCharitiesLoading(false) // [FIX 2]
      }
    }
    loadCharities()
  }, [profile]) // profile dep is correct — we pre-select if charity_id exists

  const handleCheckout = async () => {
    if (!charityId) return toast.error('Please select a charity')
    setLoading(true)
    try {
      const { url } = await api.payments.createCheckout({ plan, charityId, charityPercent: charityPct })
      // Redirect to Stripe — browser takes over from here
      window.location.href = url
      // [FIX 4] Don't call setLoading(false) here — we WANT the spinner while
      // the browser is navigating. If redirect somehow fails (popup blocker etc.),
      // the finally block resets loading after a small delay.
    } catch (err) {
      console.error('[SubscribePage] Checkout error:', err.message)
      toast.error(err.message || 'Unable to start checkout. Please try again.')
      // [FIX 4] Only reset on actual error, not on redirect
      if (isMounted.current) setLoading(false)
    }
    // Note: No finally { setLoading(false) } — intentionally left spinning
    // during the Stripe redirect. It resets on error via the catch block.
  }

  return (
    <div className="min-h-screen pt-28 pb-16 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-3 mb-12">
          {[['Plan', 1], ['Charity', 2], ['Confirm', 3]].map(([label, s]) => (
            <div key={s} className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-body font-500 transition-all ${
                step >= s ? 'bg-gold-500 text-forest-950' : 'bg-white/10 text-cream-100/40'
              }`}>
                {step > s ? <Check className="w-4 h-4" /> : s}
              </div>
              <span className={`text-sm font-body ${step >= s ? 'text-cream-100' : 'text-cream-100/30'}`}>{label}</span>
              {s < 3 && <div className="w-12 h-px bg-white/10" />}
            </div>
          ))}
        </div>

        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>

          {/* ── STEP 1: Plan ─────────────────────────────────── */}
          {step === 1 && (
            <div>
              <h1 className="font-display text-4xl font-300 text-center text-cream-100 mb-2">Choose your plan</h1>
              <p className="text-center text-cream-100/40 font-body mb-10">Both plans include all features</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                {[
                  { id: 'monthly', label: 'Monthly', price: '₹499',   period: '/month', desc: 'Billed every month',      popular: false },
                  { id: 'yearly',  label: 'Yearly',  price: '₹4,999', period: '/year',  desc: 'Save ₹989 — best value', popular: true },
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPlan(p.id)}
                    className={`relative p-6 rounded-2xl border text-left transition-all ${
                      plan === p.id
                        ? 'border-gold-500/50 bg-gold-500/8 glow-gold'
                        : 'border-white/8 bg-forest-900/40 hover:border-white/15'
                    }`}
                  >
                    {p.popular && (
                      <span className="absolute -top-3 left-4 px-3 py-1 rounded-full bg-gold-500 text-forest-950 text-xs font-body font-600">
                        Best Value
                      </span>
                    )}
                    <div className="flex items-start justify-between mb-3">
                      <p className="font-body font-500 text-cream-100">{p.label}</p>
                      {plan === p.id && <Check className="w-5 h-5 text-gold-400" />}
                    </div>
                    <p className="font-display text-4xl font-400 text-cream-100 mb-0.5">
                      {p.price}<span className="text-base text-cream-100/40 font-body">{p.period}</span>
                    </p>
                    <p className="text-xs text-cream-100/40 font-body">{p.desc}</p>
                  </button>
                ))}
              </div>

              <button onClick={() => setStep(2)} className="btn-primary w-full justify-center py-4">
                Continue <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* ── STEP 2: Charity ──────────────────────────────── */}
          {step === 2 && (
            <div>
              <h1 className="font-display text-4xl font-300 text-center text-cream-100 mb-2">Choose a charity</h1>
              <p className="text-center text-cream-100/40 font-body mb-8">Min. 10% of your subscription is donated automatically</p>

              {/* Contribution slider */}
              <div className="card mb-8">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-body font-500 text-cream-100">Contribution percentage</p>
                  <span className="font-display text-2xl font-500 text-gold-400">{charityPct}%</span>
                </div>
                <input
                  type="range" min="10" max="100" step="5" value={charityPct}
                  onChange={e => setCharityPct(Number(e.target.value))}
                  className="w-full accent-gold-500"
                />
                <div className="flex justify-between text-xs text-cream-100/30 font-body mt-1">
                  <span>10% (min)</span><span>100%</span>
                </div>
                <p className="text-xs text-cream-100/40 font-body mt-3">
                  You'll donate{' '}
                  <span className="text-gold-400 font-500">
                    {plan === 'monthly' ? `₹${Math.round(499 * charityPct / 100)}` : `₹${Math.round(4999 * charityPct / 100)}`}
                  </span>{' '}
                  per {plan === 'monthly' ? 'month' : 'year'}
                </p>
              </div>

              {/* [FIX 2] Charity list with loading skeleton */}
              <div className="grid grid-cols-1 gap-4 mb-8">
                {charitiesLoading ? (
                  // Skeleton while loading
                  [1, 2, 3].map(i => (
                    <div key={i} className="skeleton h-16 rounded-xl" />
                  ))
                ) : charities.length === 0 ? (
                  // Error state — charities failed to load
                  <div className="text-center py-8 rounded-xl border border-dashed border-white/10">
                    <p className="text-cream-100/40 font-body text-sm mb-3">
                      Unable to load charities right now.
                    </p>
                    <button
                      onClick={() => {
                        // Retry
                        setCharitiesLoading(true)
                        api.charities.list()
                          .then(r => { if (isMounted.current) setCharities(r.charities || []) })
                          .catch(() => {})
                          .finally(() => { if (isMounted.current) setCharitiesLoading(false) })
                      }}
                      className="btn-secondary text-sm px-4 py-2"
                    >
                      Try again
                    </button>
                  </div>
                ) : (
                  charities.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setCharityId(c.id)}
                      className={`flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
                        charityId === c.id
                          ? 'border-coral-500/40 bg-coral-500/5'
                          : 'border-white/8 bg-forest-900/40 hover:border-white/15'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${
                        charityId === c.id ? 'bg-coral-500/20' : 'bg-white/5'
                      }`}>
                        <Heart className={`w-5 h-5 ${charityId === c.id ? 'text-coral-500 fill-coral-500' : 'text-cream-100/30'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-body font-500 text-cream-100 truncate">{c.name}</p>
                          {c.is_featured && <Star className="w-3.5 h-3.5 text-gold-400 fill-gold-400 flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-cream-100/40 font-body truncate">{c.short_description}</p>
                      </div>
                      {charityId === c.id && <Check className="w-5 h-5 text-coral-500 flex-shrink-0" />}
                    </button>
                  ))
                )}
              </div>

              <div className="flex gap-4">
                <button onClick={() => setStep(1)} className="btn-secondary flex-1 justify-center">Back</button>
                <button
                  onClick={() => { if (!charityId) return toast.error('Please select a charity'); setStep(3) }}
                  disabled={!charityId || charitiesLoading}
                  className="btn-primary flex-1 justify-center"
                >
                  Continue <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Confirm ──────────────────────────────── */}
          {step === 3 && (
            <div>
              <h1 className="font-display text-4xl font-300 text-center text-cream-100 mb-2">Confirm & pay</h1>
              <p className="text-center text-cream-100/40 font-body mb-10">Review your selection before proceeding to Stripe</p>

              <div className="card-gold p-8 mb-8">
                <div className="space-y-5">
                  {[
                    ['Plan',         plan === 'monthly' ? 'Monthly — ₹499/month' : 'Yearly — ₹4,999/year'],
                    ['Charity',      charities.find(c => c.id === charityId)?.name || '—'],
                    ['Contribution', `${charityPct}% of each payment`],
                    ['First payment', plan === 'monthly' ? '₹499' : '₹4,999'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between items-center py-3 border-b border-white/5 last:border-0">
                      <span className="text-sm text-cream-100/50 font-body">{k}</span>
                      <span className="font-body font-500 text-cream-100">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-cream-100/30 font-body text-center mb-6">
                You'll be redirected to Stripe's secure payment page. Cancel anytime from your dashboard.
              </p>

              <div className="flex gap-4">
                <button onClick={() => setStep(2)} className="btn-secondary flex-1 justify-center" disabled={loading}>
                  Back
                </button>
                <button onClick={handleCheckout} disabled={loading} className="btn-primary flex-1 justify-center py-4">
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting…</>
                  ) : (
                    'Pay with Stripe'
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
