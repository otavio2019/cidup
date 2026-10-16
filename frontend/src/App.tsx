import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { apiRequest } from './api'
import ComplaintConfirmationPage from './pages/usuario/ComplaintConfirmationPage'
import ComplaintDetailsPage from './pages/usuario/ComplaintDetailsPage'
import ComplaintLocationPage from './pages/usuario/ComplaintLocationPage'
import ComplaintReviewPage from './pages/usuario/ComplaintReviewPage'
import CreateComplaintPage from './pages/usuario/CreateComplaintPage'
import DashboardPage from './pages/usuario/DashboardPage'
import LoginPage from './pages/auth/LoginPage'
import MyComplaintsPage from './pages/usuario/MyComplaintsPage'
import ProfilePage from './pages/usuario/ProfilePage'
import RegisterPage from './pages/auth/RegisterPage'
import ResponsiblePanelPage from './pages/admin/ResponsiblePanelPage'

type SessionUser = {
  role: 'CITIZEN' | 'RESPONSIBLE'
}

function useSession() {
  const [session, setSession] = useState<{ loading: boolean; user: SessionUser | null }>({
    loading: true,
    user: null,
  })

  useEffect(() => {
    let active = true
    apiRequest<{ user: SessionUser }>('/api/auth/session')
      .then(({ user }) => {
        if (active) setSession({ loading: false, user })
      })
      .catch(() => {
        if (active) setSession({ loading: false, user: null })
      })

    return () => {
      active = false
    }
  }, [])

  return session
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { loading, user } = useSession()

  if (loading) return <main aria-busy="true">Verificando sessão...</main>
  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

export function ResponsibleRoute({ children }: { children: ReactNode }) {
  const { loading, user } = useSession()

  if (loading) return <main aria-busy="true">Verificando sessão...</main>
  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (user.role !== 'RESPONSIBLE') {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cadastro" element={<RegisterPage />} />
      <Route
        path="/responsavel/*"
        element={
          <ResponsibleRoute>
            <ResponsiblePanelPage />
          </ResponsibleRoute>
        }
      />

      <Route
        path="/registrar-denuncia"
        element={
          <ProtectedRoute>
            <CreateComplaintPage />
          </ProtectedRoute>
        }
      />

      {/* Mantemos as duas URLs durante a transição do fluxo da equipe. */}
      <Route
        path="/registrar-denuncia/localizacao"
        element={
          <ProtectedRoute>
            <ComplaintLocationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/denuncia/localizacao"
        element={
          <ProtectedRoute>
            <ComplaintLocationPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/denuncia/confirmacao"
        element={
          <ProtectedRoute>
            <ComplaintConfirmationPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/denuncia/revisar"
        element={
          <ProtectedRoute>
            <ComplaintReviewPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/minhas-denuncias"
        element={
          <ProtectedRoute>
            <MyComplaintsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/perfil"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/denuncias/:protocol"
        element={
          <ProtectedRoute>
            <ComplaintDetailsPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
