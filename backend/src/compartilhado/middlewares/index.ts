/**
 * Middlewares compartilhados
 */

export { createAuthenticate, isResponsibleRequest, requireAdministrator } from '../../intermediarios/authenticate.js'
export { aiRateLimit, loginRateLimit, passwordResetRateLimit, registerRateLimit } from '../../intermediarios/rateLimits.js'
