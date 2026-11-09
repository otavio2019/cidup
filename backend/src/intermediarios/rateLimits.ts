import { rateLimit } from 'express-rate-limit'

// ===== LIMITAÇÃO DE REQUISIÇÕES =====
// Os limites são criados uma vez e compartilhados por todas as instâncias da API.
// Limita tentativas de login com falha para dificultar ataques de força bruta; logins aceitos não contam.
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Aguarde antes de tentar novamente.' },
})
// Limita a criação de contas por IP, com cota separada da do login.
export const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Aguarde antes de tentar novamente.' },
})
// Limita pedidos de recuperação para reduzir abuso do envio de e-mails.
export const passwordResetRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas solicitações. Aguarde antes de tentar novamente.' },
})
// Limita o uso da IA por usuário autenticado para controlar o custo da API externa.
export const aiRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: (request) => `user:${request.authUserId ?? 'anon'}`,
  validate: { keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Você atingiu o limite de uso do assistente de IA. Aguarde antes de tentar novamente.' },
})
