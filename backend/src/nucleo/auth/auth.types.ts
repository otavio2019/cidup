/**
 * Tipos de Autenticação
 */

export type AuthPrincipalType = 'CITIZEN' | 'RESPONSIBLE' | 'PASSWORD_CHANGE_REQUIRED'

export interface AuthSession {
  userId: number
  principalType: AuthPrincipalType
  issuedAt: Date
  expiresAt: Date
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  name: string
}
