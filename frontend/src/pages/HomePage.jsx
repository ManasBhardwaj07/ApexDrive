import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Heart, Trophy, Target, ChevronRight, TrendingUp, Star, ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../lib/api'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function HomePage() {
  const [charities, setCharities] = useState([])
  const [draws, setDraws] = useState([])

  useEffect(() => {
    api.charities.list().then(r => setCharities(r.charities?.slice(0, 3) || [])).catch(() => {})
    api.draws.public().then(r => setDraws(r.draws?.slice(0, 1) || [])).catch(() => {})
  }, [])

  return (
    <div className="pt-24">
      <HeroSection />
      <ImpactSection charities={charities} />
      <HowItWorksSection />
      <DrawPreviewSection draws={draws} />
      <PricingSection />
      <CTASection />
    </div>
  )
}

/* ── HERO ──────────────────────────────────────────────────── */
function HeroSection() {
  return (
    <section className="relative min-h-[92vh] flex items-center overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 right-0 w-[600px] h-[600px] rounded-full bg-gold-500/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-forest-700/20 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full border border-white/3" />
        {/* Floating score numbers */}
        {[{n:24,x:'5%',y:'25%',d:0},{n:31,x:'90%',y:'15%',d:1},{n:18,x:'88%',y:'70%',d:2},{n:40,x:'3%',y:'72%',d:0.5}].map(({n,x,y,d}) => (
          <motion.div
            key={n}
            className="absolute font-display text-6xl font-300 text-white/3 select-none"
            style={{ left: x, top: y }}
            animate={{ y: [0, -15, 0] }}
            transition={{ duration: 6+d, repeat: Infinity, delay: d, ease: 'easeInOut' }}
          >
            {n}
          </motion.div>
        ))}
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="max-w-3xl">
          {/* Tag */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold-500/10 border border-gold-500/20 mb-8"
          >
            <Heart className="w-3.5 h-3.5 text-coral-500 fill-coral-500" />
            <span className="text-xs font-body font-500 text-gold-400 tracking-wide uppercase">Play with purpose</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
            className="font-display text-6xl sm:text-7xl md:text-8xl font-300 leading-[0.9] mb-6"
          >
            Every score<br />
            <em className="not-italic text-gradient-gold">matters</em><br />
            beyond the game.
          </motion.h1>

          {/* Sub */}
          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.25 }}
            className="text-lg text-cream-100/60 font-body font-300 leading-relaxed mb-10 max-w-xl"
          >
            Subscribe, enter your Stableford scores, and compete in monthly prize draws — 
            while automatically donating to causes that matter.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-wrap gap-4"
          >
            <Link to="/signup" className="btn-primary text-base px-8 py-4 shadow-lg shadow-gold-500/20">
              Start Your Journey <ChevronRight className="w-5 h-5" />
            </Link>
            <Link to="/charities" className="btn-secondary text-base px-8 py-4">
              Explore Charities
            </Link>
          </motion.div>

          {/* Social proof */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.6 }}
            className="flex items-center gap-6 mt-12"
          >
            {[['₹4.2L+', 'Raised for Charity'], ['Monthly', 'Prize Draws'], ['1-45', 'Stableford Range']].map(([val, label]) => (
              <div key={label} className="flex flex-col">
                <span className="font-display text-2xl font-600 text-gold-400">{val}</span>
                <span className="text-xs text-cream-100/40 font-body">{label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}

/* ── IMPACT / CHARITIES ────────────────────────────────────── */
function ImpactSection({ charities }) {
  const { user } = useAuth(); // Ensure you are pulling 'user' from your AuthContext

  return (
    <section className="py-24 bg-gradient-to-b from-transparent to-forest-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="flex flex-col md:flex-row md:items-end justify-between mb-14 gap-4"
        >
          <div>
            <p className="text-xs font-body font-500 text-gold-400/60 uppercase tracking-widest mb-3">Real Impact</p>
            <h2 className="section-title">
              Your subscription <br />
              <em className="not-italic text-coral-500">funds change.</em>
            </h2>
          </div>
          <Link to="/charities" className="btn-secondary self-start md:self-auto">
            All Charities <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {charities.length > 0 ? charities.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="group card-gold hover:border-gold-500/40 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-coral-500/20 to-gold-500/10 flex items-center justify-center">
                    <Heart className="w-6 h-6 text-coral-500" />
                  </div>
                  {c.is_featured && (
                    <span className="flex items-center gap-1 text-xs text-gold-400 font-body">
                      <Star className="w-3 h-3 fill-gold-400" /> Featured
                    </span>
                  )}
                </div>
                <h3 className="font-display text-xl font-400 text-cream-100 mb-2 group-hover:text-gold-300 transition-colors">{c.name}</h3>
                <p className="text-sm text-cream-100/50 font-body leading-relaxed mb-4">{c.short_description}</p>
                {c.total_received > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <span className="text-xs text-cream-100/30 font-body">Total raised</span>
                    <p className="font-display text-xl font-500 text-gold-400">
                      ₹{c.total_received.toLocaleString('en-IN')}
                    </p>
                  </div>
                )}
              </div>

              {/* --- ACTION FOOTER --- */}
              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                <Link to="/charities" className="text-xs text-cream-100/30 hover:text-gold-400 transition-colors uppercase tracking-widest font-mono">
                  Details
                </Link>
                <button 
                  onClick={async (e) => {
                    e.stopPropagation(); // Prevent card-click if you add one later
                    try {
                      // Passes userId if logged in, otherwise undefined for Guest Flow
                      const res = await api.payments.donate({ 
                        charityId: c.id, 
                        amount: 500,
                        userId: user?.id 
                      });
                      if (res.url) window.location.href = res.url;
                    } catch (err) {
                      toast.error('Unable to start donation. Please try again.');
                    }
                  }}
                  className="btn-secondary text-[10px] px-3 py-1.5 border-coral-500/30 text-coral-400 hover:bg-coral-500/10"
                >
                  Donate ₹500
                </button>
              </div>
            </motion.div>
          )) : [1,2,3].map(i => (
            <div key={i} className="card h-48 skeleton" />
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── HOW IT WORKS ──────────────────────────────────────────── */
function HowItWorksSection() {
  const steps = [
    { icon: Target, label: '01', title: 'Subscribe', desc: 'Choose monthly or yearly. A portion automatically goes to your chosen charity.', color: 'text-gold-400' },
    { icon: TrendingUp, label: '02', title: 'Enter Scores', desc: 'Log your latest Stableford scores (1–45). We keep your rolling 5 most recent entries.', color: 'text-coral-500' },
    { icon: Trophy, label: '03', title: 'Win Monthly', desc: 'Your scores enter our monthly draw. Match 3, 4 or all 5 to win your share of the prize pool.', color: 'text-gold-400' },
    { icon: Heart, label: '04', title: 'Create Impact', desc: 'Every subscription cycle, your chosen charity receives your contribution automatically.', color: 'text-coral-500' },
  ]

  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-xs font-body font-500 text-gold-400/60 uppercase tracking-widest mb-3">How It Works</p>
          <h2 className="section-title">Simple. Rewarding. Meaningful.</h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map(({ icon: Icon, label, title, desc, color }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.12 }}
              className="relative card group hover:border-white/10 transition-all"
            >
              <span className="font-display text-6xl font-300 text-white/5 absolute -top-2 -right-1 select-none">{label}</span>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-white/5`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <h3 className="font-display text-xl font-400 text-cream-100 mb-2">{title}</h3>
              <p className="text-sm text-cream-100/50 font-body leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── DRAW PREVIEW ──────────────────────────────────────────── */
function DrawPreviewSection({ draws }) {
  const latest = draws[0]

  return (
    <section className="py-24 bg-gradient-to-b from-forest-900/30 to-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <p className="text-xs font-body font-500 text-gold-400/60 uppercase tracking-widest mb-3">Monthly Prize Draw</p>
            <h2 className="section-title mb-6">
              Match your scores.<br />
              <em className="not-italic text-gradient-gold">Claim your prize.</em>
            </h2>
            <p className="text-cream-100/50 font-body leading-relaxed mb-8">
              Every month, five numbers are drawn from the Stableford range. Match 3, 4 or all 5 of 
              your scores to win a share of the prize pool. The jackpot rolls over until someone claims it.
            </p>

            <div className="grid grid-cols-3 gap-4 mb-8">
              {[['5 Match', '40%', 'Jackpot', true], ['4 Match', '35%', 'Prize Tier', false], ['3 Match', '25%', 'Prize Tier', false]].map(([tier, pct, label, special]) => (
                <div key={tier} className={`p-4 rounded-xl border ${special ? 'border-gold-500/30 bg-gold-500/5' : 'border-white/5 bg-white/2'}`}>
                  <p className={`font-display text-2xl font-500 ${special ? 'text-gold-400' : 'text-cream-100'}`}>{pct}</p>
                  <p className="text-xs text-cream-100/50 font-body mt-1">{tier}</p>
                  {special && <p className="text-xs text-gold-500 font-body font-500 mt-1">Rolls over</p>}
                </div>
              ))}
            </div>

            <Link to="/draws" className="btn-secondary">
              View Past Results <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>

          {/* Draw card */}
          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            {latest ? (
              <div className="card-gold glow-gold p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-xs text-cream-100/40 font-body">Latest Draw</p>
                    <p className="font-display text-2xl font-400 text-cream-100">
                      {MONTHS[latest.draw_month - 1]} {latest.draw_year}
                    </p>
                  </div>
                  <span className="badge-active">Published</span>
                </div>
                <div className="flex gap-3 justify-center mb-6">
                  {latest.draw_numbers.map(n => (
                    <div key={n} className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gold-500 to-gold-600 flex items-center justify-center shadow-lg shadow-gold-500/20">
                      <span className="font-display text-2xl font-600 text-forest-950">{n}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-xl bg-forest-950/50">
                    <p className="font-display text-xl font-500 text-gold-400">₹{(latest.jackpot_pool || 0).toLocaleString('en-IN')}</p>
                    <p className="text-xs text-cream-100/40 font-body mt-0.5">Jackpot</p>
                  </div>
                  <div className="p-3 rounded-xl bg-forest-950/50">
                    <p className="font-display text-xl font-500 text-cream-100">₹{(latest.match4_pool || 0).toLocaleString('en-IN')}</p>
                    <p className="text-xs text-cream-100/40 font-body mt-0.5">4-Match</p>
                  </div>
                  <div className="p-3 rounded-xl bg-forest-950/50">
                    <p className="font-display text-xl font-500 text-cream-100">₹{(latest.match3_pool || 0).toLocaleString('en-IN')}</p>
                    <p className="text-xs text-cream-100/40 font-body mt-0.5">3-Match</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card-gold p-8 text-center">
                <Trophy className="w-16 h-16 text-gold-500/30 mx-auto mb-4" />
                <p className="font-display text-2xl font-400 text-cream-100/60">First draw coming soon</p>
                <p className="text-cream-100/30 font-body text-sm mt-2">Subscribe now to be eligible</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  )
}

/* ── PRICING ───────────────────────────────────────────────── */
function PricingSection() {
  const plans = [
    { id: 'monthly', label: 'Monthly', price: '₹499', period: '/month', note: 'Billed monthly', popular: false },
    { id: 'yearly',  label: 'Yearly',  price: '₹4,999', period: '/year', note: 'Save 2 months — ₹417/mo', popular: true },
  ]

  return (
    <section className="py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <p className="text-xs font-body font-500 text-gold-400/60 uppercase tracking-widest mb-3">Simple Pricing</p>
          <h2 className="section-title mb-4">One subscription. <br /><em className="not-italic text-gradient-gold">Everything included.</em></h2>
          <p className="text-cream-100/50 font-body mb-12">Min. 10% of your subscription goes to your chosen charity, always.</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {plans.map(({ id, label, price, period, note, popular }, i) => (
            <motion.div
              key={id}
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative p-8 rounded-2xl border ${popular
                ? 'bg-gradient-to-br from-gold-500/10 to-gold-500/5 border-gold-500/30 glow-gold'
                : 'bg-forest-900/40 border-white/8'
              }`}
            >
              {popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full bg-gold-500 text-forest-950 text-xs font-body font-600">Most Popular</span>
                </div>
              )}
              <p className="font-body font-500 text-cream-100/60 text-sm mb-1">{label}</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="font-display text-5xl font-400 text-cream-100">{price}</span>
                <span className="text-cream-100/40 font-body text-sm">{period}</span>
              </div>
              <p className="text-xs text-cream-100/30 font-body mb-6">{note}</p>
              <Link to="/signup" className={popular ? 'btn-primary w-full justify-center' : 'btn-secondary w-full justify-center'}>
                Get Started
              </Link>
              <ul className="mt-6 space-y-2 text-left">
                {['Monthly prize draws', 'Rolling 5-score tracking', 'Charity contribution', 'Winner verification system', 'Full dashboard access'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-cream-100/50 font-body">
                    <div className="w-4 h-4 rounded-full bg-gold-500/20 flex items-center justify-center flex-shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-gold-500" />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── FINAL CTA ─────────────────────────────────────────────── */
function CTASection() {
  return (
    <section className="py-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-forest-800 to-forest-900 border border-gold-500/20 p-12 text-center"
        >
          <div className="absolute inset-0 bg-gradient-radial from-gold-500/8 to-transparent" />
          <div className="relative">
            <Heart className="w-10 h-10 text-coral-500 mx-auto mb-6 fill-coral-500" />
            <h2 className="font-display text-5xl md:text-6xl font-300 text-cream-100 mb-4">
              Ready to play<br />with <em className="not-italic text-gradient-gold">purpose?</em>
            </h2>
            <p className="text-cream-100/50 font-body mb-8 max-w-lg mx-auto">
              Join hundreds of golfers who are turning their passion into meaningful impact.
            </p>
            <Link to="/signup" className="btn-primary text-base px-10 py-4 shadow-xl shadow-gold-500/25">
              Join Digital Heroes <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
