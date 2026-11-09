/**
 * Validação e tipos das variáveis de ambiente
 */

export const env = {
  // Servidor
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',

  // Autenticação
  AUTH_TOKEN_SECRET: process.env.AUTH_TOKEN_SECRET || 'dev-secret-key-change-in-production',

  // Banco de dados
  DATABASE_URL: process.env.DATABASE_URL || '',

  // Email (Brevo)
  BREVO_API_KEY: process.env.BREVO_API_KEY || '',
  BREVO_API_URL: process.env.BREVO_API_URL || 'https://api.brevo.com/v3',
  SMTP_FROM: process.env.SMTP_FROM || 'CidUp <no-reply@cidup.local>',

  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',

  // Features
  ENABLE_AI: process.env.ENABLE_AI === 'true',
}

// Confere as variáveis obrigatórias e interrompe a inicialização se faltar alguma.
export function validateEnv() {
  const required = ['DATABASE_URL']
  const missing = required.filter((key) => !process.env[key])

  if (missing.length > 0) {
    throw new Error(`Variáveis de ambiente obrigatórias ausentes: ${missing.join(', ')}`)
  }
}
