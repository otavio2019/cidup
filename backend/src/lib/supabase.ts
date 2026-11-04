// ===== INTEGRAÇÃO OPCIONAL COM O SUPABASE =====
/** Integração REST opcional; o banco principal continua sendo PostgreSQL via Prisma. */
// Indica se as duas configurações necessárias (SUPABASE_URL e SUPABASE_KEY) estão presentes.
// QUEM USA: rota GET /api/supabase/status (backend/src/index.ts).
export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_KEY)
}

// SUPABASE_URL já termina em /rest/v1; path começa com "/" (ex.: "/tabela?select=*").
// Exemplo de uso: supabaseRequest('/') ou supabaseRequest('/tabela?select=*').
// Encaminha a chamada autenticada ao Supabase e aplica um limite de tempo padrão (10 s).
// QUEM USA: rota GET /api/supabase/status (backend/src/index.ts).
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
