import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Heart, Search, Star, Globe, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'

// ── CharitiesPage ────────────────────────────────────────────
export function CharitiesPage() {
  const [charities, setCharities] = useState([])
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)

  const isMounted = useRef(true)
  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const r = await api.charities.list()
        if (isMounted.current) setCharities(r.charities || [])
      } catch (err) {
        console.error('[CharitiesPage]', err.message)
        if (isMounted.current) toast.error('Unable to load charities right now.')
      } finally {
        if (isMounted.current) setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = charities.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.description.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="pt-28 pb-16 px-4 sm:px-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="text-center mb-14">
        <p className="text-xs font-body font-500 text-gold-400/60 uppercase tracking-widest mb-3">Our Partners</p>
        <h1 className="font-display text-6xl font-300 text-cream-100 mb-4">
          Choose your <em className="not-italic text-coral-500">cause.</em>
        </h1>
        <p className="text-cream-100/50 font-body max-w-lg mx-auto">
          Every subscription automatically contributes to the charity you choose. 
          You decide how much — minimum 10%.
        </p>
      </motion.div>

      {/* Search */}
      <div className="relative max-w-md mx-auto mb-12">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-cream-100/30" />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          className="input pl-11" placeholder="Search charities…"
        />
      </div>

      {/* Featured */}
      {!search && filtered.some(c => c.is_featured) && (
        <div className="mb-12">
          <p className="text-xs font-body font-500 text-gold-400/60 uppercase tracking-widest mb-6">Featured</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filtered.filter(c => c.is_featured).map((c, i) => (
              <CharityCard key={c.id} charity={c} large />
            ))}
          </div>
        </div>
      )}

      {/* All */}
      <div>
        {!search && filtered.some(c => !c.is_featured) && (
          <p className="text-xs font-body font-500 text-gold-400/60 uppercase tracking-widest mb-6">All Charities</p>
        )}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1,2,3].map(i => <div key={i} className="skeleton h-48 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(search ? filtered : filtered.filter(c => !c.is_featured)).map((c, i) => (
              <CharityCard key={c.id} charity={c} index={i} />
            ))}
          </div>
        )}
        {filtered.length === 0 && !loading && (
          <p className="text-center text-cream-100/30 font-body py-16">No charities found matching "{search}"</p>
        )}
      </div>
    </div>
  )
}

function CharityCard({ charity: c, large, index = 0, user }) {
  return (
    <motion.div
      initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay: index * 0.08 }}
      className={`card-gold hover:border-gold-500/30 transition-all duration-300 flex flex-col justify-between ${large ? 'p-8' : 'p-6'}`}
    >
      <div>
        <div className="flex items-start justify-between mb-4">
          <div className={`rounded-xl bg-coral-500/15 flex items-center justify-center ${large ? 'w-14 h-14' : 'w-10 h-10'}`}>
            <Heart className={`text-coral-500 ${large ? 'w-7 h-7' : 'w-5 h-5'}`} />
          </div>
          <div className="flex items-center gap-2">
            {c.is_featured && <Star className="w-4 h-4 text-gold-400 fill-gold-400" />}
          </div>
        </div>

        <h3 className={`font-display font-400 text-cream-100 mb-2 ${large ? 'text-2xl' : 'text-lg'}`}>{c.name}</h3>
        <p className={`text-cream-100/50 font-body leading-relaxed mb-4 ${large ? 'text-base' : 'text-sm'}`}>
          {large ? c.description : c.short_description}
        </p>

        {c.total_received > 0 && (
          <div className="pt-4 border-t border-white/5">
            <p className="text-xs text-cream-100/30 font-body">Total raised</p>
            <p className="font-display text-2xl font-500 text-gold-400">₹{c.total_received.toLocaleString('en-IN')}</p>
          </div>
        )}
      </div>

      <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
        {c.website ? (
          <a href={c.website} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-cream-100/30 hover:text-gold-400 font-body transition-colors">
            <Globe className="w-3 h-3" /> Visit website <ExternalLink className="w-3 h-3" />
          </a>
        ) : <div />}
        
        <button 
          onClick={async () => {
            try {
              // Architecture Fix: Pass userId if it exists, otherwise it sends as undefined (guest)
              const res = await api.payments.donate({ 
                charityId: c.id, 
                amount: 500,
                userId: user?.id 
              });
              if (res.url) window.location.href = res.url;
            } catch (err) {
              toast.error('Could not start donation. Please try again.');
            }
          }}
          className="btn-secondary text-xs px-3 py-1.5 border-coral-500/30 text-coral-400 hover:bg-coral-500/10"
        >
          Donate ₹500 directly
        </button>
      </div>
    </motion.div>
  )
}

// ── DrawsPage ────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function DrawsPage() {
  const [draws, setDraws] = useState([])
  const [loading, setLoading] = useState(true)

  const isMounted = useRef(true)
  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const r = await api.draws.public()
        if (isMounted.current) setDraws(r.draws || [])
      } catch (err) {
        console.error('[DrawsPage]', err.message)
        if (isMounted.current) toast.error('Unable to load draws right now.')
      } finally {
        if (isMounted.current) setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="pt-28 pb-16 px-4 sm:px-6 max-w-5xl mx-auto">
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="text-center mb-14">
        <p className="text-xs font-body font-500 text-gold-400/60 uppercase tracking-widest mb-3">Monthly Draws</p>
        <h1 className="font-display text-6xl font-300 text-cream-100 mb-4">
          Draw <em className="not-italic text-gradient-gold">results.</em>
        </h1>
        <p className="text-cream-100/50 font-body">Published monthly. Five numbers. Three ways to win.</p>
      </motion.div>

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="skeleton h-32 rounded-2xl" />)}
        </div>
      ) : draws.length === 0 ? (
        <div className="text-center py-20">
          <p className="font-display text-2xl font-300 text-cream-100/40">No draws published yet</p>
          <p className="text-cream-100/25 font-body text-sm mt-2">Check back after the first monthly draw</p>
        </div>
      ) : (
        <div className="space-y-6">
          {draws.map((d, i) => (
            <motion.div key={d.id}
              initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.08 }}
              className="card-gold p-6 md:p-8"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <p className="text-xs text-cream-100/40 font-body mb-1">
                    {d.draw_type === 'algorithmic' ? 'Algorithmic Draw' : 'Random Draw'}
                  </p>
                  <h2 className="font-display text-3xl font-400 text-cream-100">
                    {MONTHS[(d.draw_month || 1) - 1]} {d.draw_year}
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  {d.jackpot_rollover && (
                    <span className="badge bg-coral-500/15 text-coral-400 border border-coral-500/20">
                      Jackpot Rolled Over
                    </span>
                  )}
                  <span className="badge-active">Published</span>
                </div>
              </div>

              {/* Draw numbers */}
              <div className="flex flex-wrap gap-3 mb-6">
                {d.draw_numbers?.map(n => (
                  <div key={n} className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gold-500 to-gold-600 flex items-center justify-center shadow-lg shadow-gold-500/20">
                    <span className="font-display text-2xl font-600 text-forest-950">{n}</span>
                  </div>
                ))}
              </div>

              {/* Prize pools */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  ['5 Match', d.jackpot_pool, 'Jackpot', true],
                  ['4 Match', d.match4_pool, '35% pool', false],
                  ['3 Match', d.match3_pool, '25% pool', false],
                ].map(([tier, pool, label, special]) => (
                  <div key={tier} className={`p-4 rounded-xl text-center ${special ? 'bg-gold-500/8 border border-gold-500/20' : 'bg-white/3'}`}>
                    <p className="text-xs text-cream-100/40 font-body mb-1">{tier}</p>
                    <p className={`font-display text-xl font-500 ${special ? 'text-gold-400' : 'text-cream-100'}`}>
                      ₹{(pool || 0).toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-cream-100/25 font-body">{label}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

export default CharitiesPage