import type express from 'express'
import type { PrismaClient } from '@prisma/client'

// ===== DADOS COMPARTILHADOS COM AS ROTAS =====
// createApp (app.ts) monta este objeto e o entrega a cada arquivo de rotas.
export type RouteContext = {
  app: express.Express
  // Prisma (usuario, responsavel, orgao, denuncia, historico, password_reset_token, password_recovery_request).
  database: PrismaClient
  // Login válido + senha temporária já trocada (middlewares/authenticate.ts).
  authenticate: express.RequestHandler
  // Segredo usado para assinar o cookie de sessão (auth.ts).
  secret: string
  // true em produção: cookies com Secure.
  production: boolean
  // SameSite do cookie de sessão do responsável e do logout.
  authCookieSameSite: 'none' | 'lax'
}
