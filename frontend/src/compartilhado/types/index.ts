/**
 * Tipos compartilhados do frontend
 */

export type AuthPrincipalType = 'CITIZEN' | 'RESPONSIBLE' | 'PASSWORD_CHANGE_REQUIRED'

export interface User {
  id: number
  email: string
  name: string
  principalType: AuthPrincipalType
  createdAt: string
  updatedAt: string
}

export interface Complaint {
  id: string
  title: string
  description: string
  status: 'draft' | 'submitted' | 'in_progress' | 'resolved' | 'rejected'
  category: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  location: {
    address: string
    latitude: number
    longitude: number
  }
  photos: string[]
  createdAt: string
  updatedAt: string
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}
