import { Navigate, Route, Routes } from 'react-router-dom'
import { isSupabaseConfigured } from './lib/supabase'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import Layout from './components/Layout'
import { PageLoader } from './components/ui'
import Login from './pages/Login'
import SetupNeeded from './pages/SetupNeeded'
import Dashboard from './pages/student/Dashboard'
import Classes from './pages/student/Classes'
import MyBookings from './pages/student/MyBookings'
import Shop from './pages/student/Shop'
import Checkout from './pages/student/Checkout'
import Profile from './pages/student/Profile'
import AdminHome from './pages/admin/AdminHome'

function ProtectedRoutes() {
  const { session, loading, isAdmin, profile } = useAuth()
  if (loading) return <div className="min-h-[100dvh] bg-cream"><PageLoader /></div>
  if (!session) return <Navigate to="/login" replace />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="clases" element={<Classes />} />
        <Route path="reservas" element={<MyBookings />} />
        <Route path="tienda" element={<Shop />} />
        <Route path="tienda/:packId" element={<Checkout />} />
        <Route path="perfil" element={<Profile />} />
        <Route path="admin/*" element={isAdmin ? <AdminHome /> : profile ? <Navigate to="/" replace /> : <PageLoader />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function LoginRoute() {
  const { session, loading } = useAuth()
  if (loading) return <div className="min-h-[100dvh] bg-cream"><PageLoader /></div>
  if (session) return <Navigate to="/" replace />
  return <Login />
}

export default function App() {
  if (!isSupabaseConfigured) return <SetupNeeded />
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </AuthProvider>
    </ToastProvider>
  )
}
