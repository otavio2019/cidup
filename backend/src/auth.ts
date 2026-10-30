import { jwtVerify, SignJWT } from 'jose'
import type { NextFunction, Request, Response } from 'express'

/** Contrato de sessão compartilhado entre o login, o middleware e o logout. */
export const AUTH_COOKIE_NAME = 'cidup_session'
export const AUTH_TOKEN_TTL_SECONDS = 15 * 60
const AUTH_ISSUER = 'cidup-api'
const AUTH_AUDIENCE = 'cidup-web'
export type AuthPrincipalType = 'CITIZEN' | 'RESPONSIBLE'

declare global {
  namespace Express {
    interface Request {
      authUserId?: number
      authPrincipalType?: AuthPrincipalType
    }
  }
}

// Valida o tamanho mínimo do segredo e o converte para o formato usado pelo JWT.
function secretKey(secret: string) {
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('AUTH_TOKEN_SECRET deve conter pelo menos 32 bytes.')
  }
  return new TextEncoder().encode(secret)
}

// Cria um token assinado com identidade, emissor, público e prazo de expiração definidos.
export async function createAuthToken(userId: number, secret: string, principalType: AuthPrincipalType = 'CITIZEN') {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('É necessário informar um ID de usuário válido para criar o token de autenticação.')
  }

  return new SignJWT({ principalType })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(AUTH_ISSUER)
    .setAudience(AUTH_AUDIENCE)
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${AUTH_TOKEN_TTL_SECONDS}s`)
    .sign(secretKey(secret))
}

// Gera o middleware que valida o cookie e associa o usuário autenticado à requisição.
export function requireAuthentication(secret: string) {
  const key = secretKey(secret)

  return async (request: Request, response: Response, next: NextFunction) => {
    const token = request.cookies?.[AUTH_COOKIE_NAME]
    if (typeof token !== 'string' || !token) {
      response.status(401).json({ error: 'Autenticação necessária.' })
      return
    }

    try {
      const { payload } = await jwtVerify(token, key, {
        algorithms: ['HS256'],
        issuer: AUTH_ISSUER,
        audience: AUTH_AUDIENCE,
      })
      const userId = Number(payload.sub)
      if (!Number.isSafeInteger(userId) || userId <= 0) {
        response.status(401).json({ error: 'Credencial inválida ou expirada.' })
        return
      }
      request.authUserId = userId
      request.authPrincipalType = payload.principalType === 'RESPONSIBLE' ? 'RESPONSIBLE' : 'CITIZEN'
      next()
    } catch {
      response.status(401).json({ error: 'Credencial inválida ou expirada.' })
    }
  }
}

// Recupera somente IDs positivos e seguros previamente definidos pelo middleware.
export function readAuthUserId(request: Request) {
  const userId = request.authUserId
  return Number.isSafeInteger(userId) && userId && userId > 0 ? userId : null
}

export function readAuthPrincipalType(request: Request): AuthPrincipalType {
  return request.authPrincipalType ?? 'CITIZEN'
}
