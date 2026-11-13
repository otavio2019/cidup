/** Cliente HTTP do frontend: mantém o contrato da API e a sessão por cookie. */
// Em produção, usa o proxy da Vercel para manter o cookie de sessão no mesmo domínio.
const API_URL = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000')
// Evita configurar uma API sem HTTPS em produção.
if (import.meta.env.PROD && API_URL && new URL(API_URL).protocol !== 'https:') {
  throw new Error('VITE_API_URL deve usar HTTPS em produção.')
}

// Erro HTTP com o status e, quando enviado pelo servidor, o tempo de espera do cabeçalho Retry-After.
export class ApiError extends Error {
  status: number
  retryAfterSeconds: number | null

  // Guarda a mensagem HTTP, o status e o tempo de espera informado pelo servidor.
  constructor(message: string, status: number, retryAfterSeconds: number | null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

// Aceita Retry-After em segundos ou como data HTTP; retorna null quando ausente ou inválido.
function readRetryAfter(value: string | null) {
  if (!value) return null
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds))
  const date = Date.parse(value)
  return Number.isNaN(date) ? null : Math.max(0, Math.ceil((date - Date.now()) / 1000))
}

// Monta a mensagem de bloqueio por excesso de tentativas, incluindo o tempo restante quando conhecido.
export function formatRateLimitMessage(error: ApiError) {
  if (error.retryAfterSeconds === null) return error.message
  const minutes = Math.ceil(error.retryAfterSeconds / 60)
  const wait = error.retryAfterSeconds < 60
    ? `${error.retryAfterSeconds} segundo${error.retryAfterSeconds === 1 ? '' : 's'}`
    : `${minutes} minuto${minutes === 1 ? '' : 's'}`
  return `${error.message.replace(/\s*Aguarde antes de tentar novamente\.$/, '')} Aguarde cerca de ${wait} para tentar novamente.`.trim()
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
  if (!response.ok) {
    throw new ApiError(
      data.error ?? 'Não foi possível concluir a operação.',
      response.status,
      response.status === 429 ? readRetryAfter(response.headers.get('Retry-After')) : null,
    )
  }
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
  arquivada?: boolean
  createdAt: string
  registeredAt: string
  type: { name: string }
  history: ComplaintHistory[]
  categories: string[]
  latitude: number
  longitude: number
  photo: string | null
  updatedAt: string
}

export type ComplaintHistory = {
  id: number
  description: string
  observation: string
  responsibleId?: number | null
  createdAt: string
  photo: string
}
