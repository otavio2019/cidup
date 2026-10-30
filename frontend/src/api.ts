/** Cliente HTTP do frontend: mantém o contrato da API e a sessão por cookie. */
// Em produção, usa o proxy da Vercel para manter o cookie de sessão no mesmo domínio.
const API_URL = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000')
// Evita configurar uma API sem HTTPS em produção.
if (import.meta.env.PROD && API_URL && new URL(API_URL).protocol !== 'https:') {
  throw new Error('VITE_API_URL deve usar HTTPS em produção.')
}

// Centraliza chamadas com cookie de sessão, leitura de respostas e tratamento de erros HTTP.
export async function apiRequest<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const data = response.status === 204
    ? {} as T & { error?: string }
    : await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(data.error ?? 'Não foi possível concluir a operação.')
  return data
}

// Estruturas retornadas por /api/complaints, compartilhadas entre o dashboard e as telas de denúncias.
export type Complaint = {
  id: number
  protocol: string
  title: string
  description: string
  address: string
  number: string
  neighborhood: string
  status: string
  createdAt: string
  registeredAt: string
  type: { name: string }
  history: ComplaintHistory[]
}

export type ComplaintHistory = {
  id: number
  description: string
  observation: string
}
