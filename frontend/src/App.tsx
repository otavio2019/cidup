import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ComplaintConfirmationPage from './assets/pages/ComplaintConfirmationPage'
import ComplaintLocationPage from './assets/pages/ComplaintLocationPage'
import CreateComplaintPage from './assets/pages/CreateComplaintPage'
import DashboardPage from './assets/pages/DashboardPage'
import LoginPage from './assets/pages/LoginPage'
import RegisterPage from './assets/pages/RegisterPage'

// TODO: substituir a proteção local por validação real do token JWT.
function ProtectedRoute({ children }: { children: ReactNode }) {
  const isAuthenticated =
    localStorage.getItem('cidup-authenticated') === 'true'

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
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
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
