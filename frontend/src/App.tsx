import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardPage from './assets/pages/DashboardPage'
import LoginPage from './assets/pages/LoginPage'
import RegisterPage from './assets/pages/RegisterPage'

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
