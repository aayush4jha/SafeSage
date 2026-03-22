import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SafetyProvider } from './context/SafetyContext'
import { CacheProvider } from './context/CacheContext'
import Sidebar from './components/Sidebar'
import EmergencyNotification from './components/EmergencyNotification'
import GuardianAlert from './components/GuardianAlert'
import BottomNav from './components/BottomNav'
import Dashboard from './pages/Dashboard'
import ReportPage from './pages/ReportPage'
import EmergencyPage from './pages/EmergencyPage'
import ProfilePage from './pages/ProfilePage'
import FamilyDashboard from './pages/FamilyDashboard'
import SafetyMapPage from './pages/SafetyMapPage'
import AuthPage from './pages/AuthPage'

function ProtectedRoutes() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface">
        <div className="text-center">
          <span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span>
          <p className="mt-4 text-sm text-on-surface-variant font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
  }

  return (
    <CacheProvider>
      <SafetyProvider>
        <EmergencyNotification />
        <GuardianAlert />
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex-1 md:ml-64 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/map" element={<SafetyMapPage />} />
                <Route path="/report" element={<ReportPage />} />
                <Route path="/family" element={<FamilyDashboard />} />
                <Route path="/emergency" element={<EmergencyPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </div>
          <BottomNav />
        </div>
      </SafetyProvider>
    </CacheProvider>
  )
}

function AuthRoute() {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return null
  if (isAuthenticated) return <Navigate to="/" replace />
  return <AuthPage />
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/auth" element={<AuthRoute />} />
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
    </AuthProvider>
  )
}
