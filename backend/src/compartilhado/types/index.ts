/**
 * Tipos compartilhados da aplicação
 */

export type AuthPrincipalType = 'CITIZEN' | 'RESPONSIBLE' | 'PASSWORD_CHANGE_REQUIRED'

export interface AuthContext {
  userId: number
  principalType: AuthPrincipalType
}

export interface ApiError {
  code: string
  message: string
  statusCode: number
  details?: Record<string, unknown>
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: ApiError
}
