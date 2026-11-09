import type express from 'express'
import type { PrismaClient } from '@prisma/client'
import { readAuthPrincipalType, readAuthUserId, requireAuthentication } from '../auth.js'
import { handlePrismaError } from '../utils/prismaErrors.js'

// ===== MIDDLEWARES DE AUTENTICAÇÃO E PERMISSÃO =====

// Verifica se a sessão pertence à conta única de responsável autenticada.
export function isResponsibleRequest(request: express.Request) {
  return readAuthPrincipalType(request) === 'RESPONSIBLE'
}

// Middleware "authenticate" = login válido (auth.ts) + senha temporária já trocada.
// Se must_change_password for true, bloqueia com 403 (PASSWORD_CHANGE_REQUIRED),
// exceto em /api/auth/session e /api/auth/change-temporary-password.
// QUEM USA: quase todas as rotas /api (ver "MIDDLEWARE:" em cada rota).
export function createAuthenticate(secret: string, database: PrismaClient): express.RequestHandler {
  const verifyAuthentication = requireAuthentication(secret)
  return (request, response, next) => {
    verifyAuthentication(request, response, (error?: unknown) => {
      if (error) {
        next(error)
        return
      }
      if (readAuthPrincipalType(request) === 'RESPONSIBLE' ||
          request.path === '/api/auth/session' ||
          request.path === '/api/auth/change-temporary-password') {
        next()
        return
      }
      void database.usuario.findUnique({
        where: { id_usuario: readAuthUserId(request) ?? -1 },
        select: { must_change_password: true },
      }).then((user) => {
        if (user?.must_change_password) {
          response.status(403).json({
            error: 'Troque sua senha temporária para continuar.',
            code: 'PASSWORD_CHANGE_REQUIRED',
          })
          return
        }
        next()
      }).catch((error: unknown) => handlePrismaError(error, response, 'require-password-change'))
    })
  }
}

// Restringe operações administrativas a usuários autenticados presentes na lista autorizada.
// Uso: rotas /api/admin/* e ações do painel (ResponsiblePanelPage.tsx).
// Erros: 401 sem sessão | 403 se não for RESPONSIBLE.
export function requireAdministrator(request: express.Request, response: express.Response, next: express.NextFunction) {
  const userId = readAuthUserId(request)
  if (!userId) {
    response.status(401).json({ error: 'Autenticação necessária.' })
    return
  }
  if (!isResponsibleRequest(request)) {
    response.status(403).json({ error: 'Operação restrita a responsáveis autorizados.' })
    return
  }
  next()
}
