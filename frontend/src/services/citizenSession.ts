import { apiRequest } from './api'

// Antonio - Atividade 10: logout do cidadão extraído de ProfilePage.tsx (original: lógica dentro de handleLogout do perfil) para ser usado pelo perfil e pelo menu ☰ do celular sem duplicar código. Mesmo comportamento: POST /api/auth/logout e, só se der certo, limpa os dados locais. Em caso de falha, lança o erro para quem chamou exibir a mensagem.
export async function logoutCitizen() {
  await apiRequest('/api/auth/logout', { method: 'POST' })
  localStorage.removeItem('cidup-role')
  localStorage.removeItem('cidup-user-id')
  localStorage.removeItem('cidup-complaints')
  localStorage.removeItem('cidup-profile')
  sessionStorage.removeItem('cidup-complaint-draft')
  sessionStorage.removeItem('cidup-complaint-confirmation')
  sessionStorage.removeItem('cidup-active-draft-id')
}
