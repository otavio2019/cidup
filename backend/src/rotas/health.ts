import { isSupabaseConfigured, supabaseRequest } from '../biblioteca/supabase.js'
import type { RouteContext } from './context.js'

// ===== ROTAS DE DIAGNÓSTICO =====
// /health (público) e /api/supabase/status (com login).
export function registerHealthRoutes({ app, authenticate }: RouteContext) {
  // Disponibiliza uma verificação simples de disponibilidade sem exigir sessão.
  // QUEM USA: monitoramento/hospedagem (nenhuma tela do frontend).
  // MIDDLEWARE: nenhum. Prisma: nenhum.
  app.get('/health', (_request, response) => {
    response.json({ status: 'ok' })
  })

  // Verifica a configuração e a conectividade do serviço Supabase.
  // QUEM USA: nenhuma tela (diagnóstico).
  // MIDDLEWARE: authenticate. CHAMA: supabaseRequest (src/lib/supabase.ts).
  app.get('/api/supabase/status', authenticate, async (_request, response) => {
    if (!isSupabaseConfigured()) {
      response.status(503).json({ error: 'Supabase não configurado.' })
      return
    }

    try {
      const result = await supabaseRequest('/')
      response.status(result.ok ? 200 : 502).json({ connected: result.ok })
    } catch {
      response.status(502).json({ connected: false })
    }
  })
}
