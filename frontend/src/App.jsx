import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

// Public pages
import HomePage     from './pages/HomePage'
import LoginPage    from './pages/LoginPage'
import SignupPage   from './pages/SignupPage'
import CharitiesPage from './pages/CharitiesPage'
import DrawsPage    from './pages/DrawsPage'

// Protected pages
import DashboardPage   from './pages/DashboardPage'
import SubscribePage   from './pages/SubscribePage'

// Admin pages
import AdminLayout      from './pages/admin/AdminLayout'
import AdminDashboard   from './pages/admin/AdminDashboard'
import AdminUsers       from './pages/admin/AdminUsers'
import AdminDraws       from './pages/admin/AdminDraws'
import AdminPayouts     from './pages/admin/AdminPayouts'
import AdminCharities   from './pages/admin/AdminCharities'

// Layout
import PublicLayout from './components/layout/PublicLayout'

// Guards
function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user)   return <Navigate to="/login" replace />
  return children
}

function RequireAdmin({ children }) {
  const { isAdmin, loading, profile } = useAuth()
  if (loading)   return <LoadingScreen />

  // DIAGNOSTIC GUARD: Stop silent redirects and show exactly what the string is
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-forest-950 text-cream-100 p-6 text-center">
        <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-6 text-3xl font-bold">!</div>
        <h2 className="text-3xl font-display mb-4">Admin Access Denied</h2>
        <p className="text-cream-100/60 mb-2">The security guard blocked you because your database role does not match exactly.</p>
        <div className="bg-black/40 border border-white/10 rounded-lg p-6 my-6 font-mono text-left w-full max-w-md shadow-xl">
          <p className="text-white/50 mb-2">Expected: <span className="text-emerald-400 font-bold">"admin"</span></p>
          <p className="text-white/50">Detected: <span className="text-red-400 font-bold">"{profile?.role || 'null'}"</span></p>
        </div>
        <p className="text-sm text-gold-400 max-w-md mx-auto leading-relaxed mb-8">
          If this says "subscriber" or "null", you either edited the wrong email in Supabase, or you haven't saved the Table Editor changes.
        </p>
        <Link to="/dashboard" className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors font-body">
          Return to Dashboard
        </Link>
      </div>
    )
  }
  return children
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-forest-950">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
        <p className="text-cream-100/40 text-sm font-body">Loading…</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route element={<PublicLayout />}>
        <Route path="/"          element={<HomePage />} />
        <Route path="/charities" element={<CharitiesPage />} />
        <Route path="/draws"     element={<DrawsPage />} />
      </Route>

      <Route path="/login"  element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Protected */}
      <Route path="/dashboard" element={
        <RequireAuth><DashboardPage /></RequireAuth>
      } />
      <Route path="/subscribe" element={
        <RequireAuth><SubscribePage /></RequireAuth>
      } />

      {/* Admin */}
      <Route path="/admin" element={
        <RequireAuth><RequireAdmin><AdminLayout /></RequireAdmin></RequireAuth>
      }>
        <Route index                element={<AdminDashboard />} />
        <Route path="users"         element={<AdminUsers />} />
        <Route path="draws"         element={<AdminDraws />} />
        <Route path="payouts"       element={<AdminPayouts />} />
        <Route path="charities"     element={<AdminCharities />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}