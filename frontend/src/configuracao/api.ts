/**
 * Configuração do cliente API
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export const apiConfig = {
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
}

export const endpoints = {
  // Auth
  auth: {
    register: '/auth/register',
    login: '/auth/login',
    logout: '/auth/logout',
    passwordReset: '/auth/password-reset',
  },

  // Usuarios
  usuarios: {
    profile: '/usuarios/profile',
    updateProfile: '/usuarios/profile',
  },

  // Denuncias
  denuncias: {
    list: '/denuncias',
    create: '/denuncias',
    // Monta o caminho para consultar uma denúncia específica.
    detail: (id: string) => `/denuncias/${id}`,
    // Monta o caminho para atualizar uma denúncia específica.
    update: (id: string) => `/denuncias/${id}`,
    // Monta o caminho para anexar uma foto à denúncia.
    addPhoto: (id: string) => `/denuncias/${id}/fotos`,
  },

  // Admin
  admin: {
    dashboard: '/admin/dashboard',
    organizations: '/admin/organizacoes',
  },
}
