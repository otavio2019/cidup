const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export async function apiRequest<T>(path: string, options: RequestInit = {}) {
  const userId = localStorage.getItem('cidup-user-id')
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(userId ? { 'x-user-id': userId } : {}),
      ...options.headers,
    },
  })
  const data = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new Error(data.error ?? 'Não foi possível concluir a operação.')
  return data
}

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
  type: { name: string }
}