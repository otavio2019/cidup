import { jwtVerify, SignJWT } from 'jose'
import type { NextFunction, Request, Response } from 'express'

export const AUTH_COOKIE_NAME = 'cidup_session'
export const AUTH_TOKEN_TTL_SECONDS = 15 * 60
const AUTH_ISSUER = 'cidup-api'
const AUTH_AUDIENCE = 'cidup-web'

declare global {
  namespace Express {
    interface Request {
      authUserId?: number
    }
  }
}

function secretKey(secret: string) {
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('AUTH_TOKEN_SECRET must contain at least 32 bytes.')
  }
  return new TextEncoder().encode(secret)
}

export async function createAuthToken(userId: number, secret: string) {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('A valid user ID is required to create an authentication token.')
  }

  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(AUTH_ISSUER)
    .setAudience(AUTH_AUDIENCE)
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${AUTH_TOKEN_TTL_SECONDS}s`)
    .sign(secretKey(secret))
}

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
      next()
    } catch {
      response.status(401).json({ error: 'Credencial inválida ou expirada.' })
    }
  }
}

export function readAuthUserId(request: Request) {
  const userId = request.authUserId
  return Number.isSafeInteger(userId) && userId && userId > 0 ? userId : null
}
