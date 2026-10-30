/** Integração REST opcional; o banco principal continua sendo PostgreSQL via Prisma. */
// Indica se as duas configurações necessárias para acessar o Supabase estão presentes.
export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_KEY)
}

// SUPABASE_URL já termina em /rest/v1; path começa com "/" (ex.: "/tabela?select=*").
// Encaminha a chamada autenticada ao Supabase e aplica um limite de tempo padrão.
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
