export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_KEY)
}

// SUPABASE_URL já termina em /rest/v1; path começa com "/" (ex.: "/tabela?select=*").
export async function supabaseRequest(path: string, init: RequestInit = {}) {
  const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '')
  const key = process.env.SUPABASE_KEY
  if (!baseUrl || !key) throw new Error('Supabase não configurado.')

  return fetch(`${baseUrl}${path}`, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(10_000),
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
}
