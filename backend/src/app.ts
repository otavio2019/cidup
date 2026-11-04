import 'dotenv/config'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'
import { prisma } from './lib/prisma.js'
import { createAuthenticate } from './middlewares/authenticate.js'
import { registerHealthRoutes } from './routes/health.js'
import { registerLoginRoutes } from './routes/auth/login.js'
import { registerPasswordRecoveryRoutes } from './routes/auth/passwordRecovery.js'
import { registerRegisterRoutes } from './routes/auth/register.js'
import { registerSessionRoutes } from './routes/auth/session.js'
import { registerOrganizationRoutes } from './routes/admin/organizations.js'
import { registerPasswordRecoveryRequestRoutes } from './routes/admin/passwordRecoveryRequests.js'
import { registerAiDraftRoutes } from './routes/usuario/aiDraft.js'
import { registerComplaintRoutes } from './routes/usuario/complaints.js'
import { registerHistoryRoutes } from './routes/usuario/history.js'
import { registerProfileRoutes } from './routes/usuario/profile.js'
import type { RouteContext } from './routes/context.js'
import { isRecord } from './utils/validation.js'

/** API HTTP do CidUp: autenticação, usuários, órgãos, denúncias, históricos e integrações opcionais. */
// ===== ORGANIZAÇÃO DO BACKEND (igual às pastas do frontend) =====
// - routes/auth     -> frontend/src/pages/auth     (cadastro, login, sessão, senha)
// - routes/usuario  -> frontend/src/pages/usuario  (perfil, denúncias, histórico, IA)
// - routes/admin    -> frontend/src/pages/admin    (órgãos, pedidos de recuperação)
// - routes/health.ts: diagnóstico (/health, /api/supabase/status)
// - middlewares/: autenticação, permissão de responsável e limites de requisição
// - utils/: validação, senhas, erros do Prisma e regras das denúncias
// - auth.ts (token/cookie), email.ts (e-mails), lib/ (Prisma e Supabase)
// Rotas com dois nomes (/api/users e /api/usuarios etc.) são apelidos da mesma rota.

// ===== CONFIGURAÇÃO DA API E MIDDLEWARES =====
// Monta a API com banco e opções injetáveis, validando as configurações antes de expor rotas.
// QUEM USA: index.ts (servidor) e os testes em backend/tests.
export function createApp(
  database: PrismaClient = prisma,
  options: {
    authTokenSecret?: string
    frontendOrigins?: string
    production?: boolean
  } = {},
) {
  // 1) Lê e valida as configurações (segredo do token, origens permitidas, produção).
  const secret = options.authTokenSecret ?? process.env.AUTH_TOKEN_SECRET
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('Defina AUTH_TOKEN_SECRET com um valor de pelo menos 32 bytes.')
  }
  const frontendOrigins = (options.frontendOrigins ?? process.env.FRONTEND_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  const allowedOrigins = new Set(frontendOrigins)
  const production = options.production ?? process.env.NODE_ENV === 'production'
  const authCookieSameSite = production ? 'none' : 'lax'
  if (production && frontendOrigins.some((origin) => new URL(origin).protocol !== 'https:')) {
    throw new Error('FRONTEND_ORIGINS deve usar HTTPS em produção.')
  }
  const app = express()

  // 2) Configura cabeçalhos, origem permitida, JSON e cookie usados pelas rotas.
  app.disable('x-powered-by')
  // Quantidade de proxies à frente da API (Vercel + Render = 2), usada para obter o IP real do cliente.
  const trustProxyHops = process.env.TRUST_PROXY_HOPS?.trim()
    ? Number(process.env.TRUST_PROXY_HOPS)
    : production ? 2 : false
  if (trustProxyHops !== false && (!Number.isInteger(trustProxyHops) || trustProxyHops < 0)) {
    throw new Error('TRUST_PROXY_HOPS deve ser um número inteiro maior ou igual a zero.')
  }
  app.set('trust proxy', trustProxyHops)
  // REMOVER DEPOIS: diagnóstico temporário do IP usado pelo rate limit do login (sem dados pessoais).
  if (production) {
    app.use('/api/auth/login', (request, _response, next) => {
      if (request.method === 'POST') {
        console.log('[ratelimit-debug]', { ip: request.ip, xForwardedFor: request.get('x-forwarded-for') ?? null })
      }
      next()
    })
  }
  if (production) {
    // Recusa conexões sem TLS quando a API está configurada para produção.
    app.use((request, response, next) => {
      if (!request.secure) {
        response.status(400).json({ error: 'A API exige HTTPS.' })
        return
      }
      next()
    })
  }
  // Permite credenciais somente para origens explicitamente configuradas.
  app.use(cors({
    origin(origin, callback) {
      callback(null, !origin || allowedOrigins.has(origin) ? origin ?? false : false)
    },
    credentials: true,
  }))
  // Define limites e middlewares necessários para interpretar JSON e cookies de sessão.
  app.use(express.json({ limit: '4mb' }))
  app.use(cookieParser())
  // Impede que respostas com dados de API sejam reutilizadas por caches intermediários.
  app.use('/api', (_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store')
    next()
  })
  // Bloqueia chamadas de origens não permitidas, inclusive em rotas sem autenticação.
  app.use('/api', (request, response, next) => {
    const origin = request.get('origin')
    if (origin && !allowedOrigins.has(origin)) {
      response.status(403).json({ error: 'Origem não permitida.' })
      return
    }
    next()
  })

  // 3) Registra as rotas, separadas por área (mesma divisão das páginas do frontend).
  const context: RouteContext = {
    app,
    database,
    authenticate: createAuthenticate(secret, database),
    secret,
    production,
    authCookieSameSite,
  }
  registerHealthRoutes(context)
  // auth
  registerRegisterRoutes(context)
  registerPasswordRecoveryRoutes(context)
  registerLoginRoutes(context)
  registerSessionRoutes(context)
  // admin
  registerPasswordRecoveryRequestRoutes(context)
  registerOrganizationRoutes(context)
  // usuario
  registerProfileRoutes(context)
  registerComplaintRoutes(context)
  registerHistoryRoutes(context)
  registerAiDraftRoutes(context)

  // ===== TRATAMENTO DE ERROS DA API =====
  // Converte erros inesperados e JSON malformado em respostas seguras para o cliente.
  // MIDDLEWARE: último da cadeia; recebe erros de todas as rotas acima.
  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (isRecord(error) && (error.type === 'entity.too.large' || error.name === 'PayloadTooLargeError')) {
      response.status(413).json({ error: 'A requisição é muito grande. A foto deve ter no máximo 2 MB.' })
      return
    }
    if (error instanceof SyntaxError) {
      response.status(400).json({ error: 'Corpo da requisição inválido.' })
      return
    }
    console.error('Erro não tratado ao processar a solicitação.', {
      name: error instanceof Error ? error.name : typeof error,
      code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined,
    })
    response.status(500).json({ error: 'Não foi possível concluir a operação.' })
  })

  return app
}
