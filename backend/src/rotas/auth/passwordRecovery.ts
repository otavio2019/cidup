import { randomBytes } from 'node:crypto'
import { AUTH_COOKIE_NAME, AUTH_TOKEN_TTL_SECONDS, createAuthToken, readAuthPrincipalType, readAuthUserId } from '../../auth.js'
import { notifySafely, sendPasswordResetEmail } from '../../email.js'
import { passwordResetRateLimit } from '../../intermediarios/rateLimits.js'
import { notifyAllResponsibles, notifySafely as notifyNotificationSafely } from '../../notifications.js'
import { hashPassword, hashResetToken, verifyPassword } from '../../utilitarios/passwords.js'
import { handlePrismaError } from '../../utilitarios/prismaErrors.js'
import { digits, isRecord, isValidCpf } from '../../utilitarios/validation.js'
import type { RouteContext } from '../context.js'

// ===== AUTENTICAÇÃO: RECUPERAÇÃO E TROCA DE SENHA =====
// Telas ligadas: frontend/src/pages/auth/ForgotPasswordPage.tsx, ResetPasswordPage.tsx
// e ChangeTemporaryPasswordPage.tsx.

// Devolve a URL base do frontend (sem "/" final), usada nos links dos e-mails.
// Origem: FRONTEND_URL, senão o primeiro item de FRONTEND_ORIGINS.
function frontendUrl() {
  return (process.env.FRONTEND_URL ?? process.env.FRONTEND_ORIGINS ?? 'http://localhost:5173').split(',')[0]!.trim().replace(/\/$/, '')
}

export function registerPasswordRecoveryRoutes({ app, database, authenticate, secret, production }: RouteContext) {
  // O QUE FAZ: pede recuperação de senha por CPF (cria pedido) ou e-mail (envia link).
  // QUEM USA: ForgotPasswordPage.tsx. MIDDLEWARE: passwordResetRateLimit.
  // CHAMA: isValidCpf, notifySafely + sendPasswordResetEmail (src/email.ts), hashResetToken.
  // PRISMA: usuario, password_recovery_request (CPF), password_reset_token (e-mail).
  // Resposta sempre genérica: não revela se a conta existe.
  app.post('/api/auth/forgot-password', passwordResetRateLimit, async (request, response) => {
    const body = isRecord(request.body) ? request.body : {}
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const genericResponse = { message: 'Se os dados informados estiverem cadastrados, enviaremos as instruções de recuperação por e-mail.' }
    // Caminho A: pedido por CPF -> fila de atendimento manual do responsável
    // (listada em GET /api/admin/password-recovery-requests).
    if ('cpf' in body) {
      const cpf = digits(body.cpf)
      try {
        if (isValidCpf(cpf)) {
          const user = await database.usuario.findUnique({
            where: { cpf },
            select: { id_usuario: true },
          })
          if (user) {
            await database.password_recovery_request.upsert({
              where: { id_usuario: user.id_usuario },
              create: { id_usuario: user.id_usuario },
              update: {
                status: 'PENDING',
                requested_at: new Date(),
                resolved_at: null,
                id_responsavel: null,
              },
            })
            void notifyNotificationSafely(() => notifyAllResponsibles(database, {
              title: 'Nova recuperação de senha',
              message: 'Um cidadão solicitou ajuda para recuperar o acesso à conta.',
              type: 'PASSWORD_RECOVERY',
            }))
          }
        }
        response.status(202).json({
          message: 'Se os dados corresponderem a uma conta, a solicitação será encaminhada ao responsável.',
        })
      } catch (error) {
        handlePrismaError(error, response, 'create-password-recovery-request')
      }
      return
    }

    // Caminho B: pedido por e-mail -> gera token de 30 min e envia o link.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
      response.json(genericResponse)
      return
    }
    try {
      const user = await database.usuario.findUnique({ where: { email }, select: { id_usuario: true, email: true } })
      if (user) {
        // Apaga tokens antigos: só o link mais recente vale.
        await database.password_reset_token.deleteMany({ where: { id_usuario: user.id_usuario } })
        const rawToken = randomBytes(32).toString('hex')
        await database.password_reset_token.create({
          data: {
            token_hash: hashResetToken(rawToken),
            id_usuario: user.id_usuario,
            expires_at: new Date(Date.now() + 30 * 60 * 1000),
          },
        })
        const resetUrl = `${frontendUrl()}/recuperar-senha/nova?token=${encodeURIComponent(rawToken)}`
        await notifySafely(() => sendPasswordResetEmail(user.email, resetUrl))
      }
      response.json(genericResponse)
    } catch (error) {
      handlePrismaError(error, response, 'forgot-password')
    }
  })

  // O QUE FAZ: troca a senha usando o token enviado por e-mail (uso único).
  // QUEM USA: ResetPasswordPage.tsx. MIDDLEWARE: passwordResetRateLimit.
  // CHAMA: hashResetToken, hashPassword. PRISMA: password_reset_token, usuario (transação).
  app.post('/api/auth/reset-password', passwordResetRateLimit, async (request, response) => {
    const body = isRecord(request.body) ? request.body : {}
    const token = typeof body.token === 'string' ? body.token.trim() : ''
    const password = body.password
    if (!/^[a-f0-9]{64}$/i.test(token) || typeof password !== 'string' || password.length < 6 || password.length > 1024) {
      response.status(400).json({ error: 'O link de recuperação é inválido ou a senha não atende aos requisitos.' })
      return
    }
    try {
      const resetToken = await database.password_reset_token.findUnique({ where: { token_hash: hashResetToken(token) } })
      if (!resetToken || resetToken.used_at || resetToken.expires_at <= new Date()) {
        response.status(400).json({ error: 'O link de recuperação é inválido ou expirou.' })
        return
      }
      // "Reivindica" o token e troca a senha na mesma transação.
      // Assim, dois cliques simultâneos não usam o mesmo link duas vezes.
      const result = await database.$transaction(async (transaction) => {
        const claimed = await transaction.password_reset_token.updateMany({
          where: { id: resetToken.id, used_at: null, expires_at: { gt: new Date() } },
          data: { used_at: new Date() },
        })
        if (claimed.count !== 1) return false
        await transaction.usuario.update({ where: { id_usuario: resetToken.id_usuario }, data: { senha: await hashPassword(password) } })
        return true
      })
      if (!result) {
        response.status(400).json({ error: 'O link de recuperação é inválido ou expirou.' })
        return
      }
      response.json({ message: 'Senha atualizada com sucesso. Você já pode entrar na sua conta.' })
    } catch (error) {
      handlePrismaError(error, response, 'reset-password')
    }
  })

  // O QUE FAZ: troca a senha temporária definida por um responsável.
  // QUEM USA: ChangeTemporaryPasswordPage.tsx. MIDDLEWARE: authenticate (liberada mesmo
  // com troca de senha pendente). CHAMA: verifyPassword, hashPassword. PRISMA: usuario.
  app.post('/api/auth/change-temporary-password', authenticate, async (request, response) => {
    const userId = readAuthUserId(request)
    const newPassword = isRecord(request.body) ? request.body.newPassword : undefined
    if (!userId || readAuthPrincipalType(request) === 'RESPONSIBLE') {
      response.status(401).json({ error: 'Autenticação de cidadão necessária.' })
      return
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 1024) {
      response.status(400).json({ error: 'A nova senha deve ter entre 6 e 1024 caracteres.' })
      return
    }
    try {
      const user = await database.usuario.findUnique({
        where: { id_usuario: userId },
        select: { must_change_password: true, senha: true },
      })
      if (!user?.must_change_password) {
        response.status(400).json({ error: 'Não há troca de senha temporária pendente.' })
        return
      }
      if (await verifyPassword(newPassword, user.senha)) {
        response.status(400).json({ error: 'A senha definitiva deve ser diferente da senha temporária.' })
        return
      }
      await database.usuario.update({
        where: { id_usuario: userId },
        data: { senha: await hashPassword(newPassword), must_change_password: false },
      })
      // Emite novo cookie de cidadão comum (o anterior era PASSWORD_CHANGE_REQUIRED).
      const token = await createAuthToken(userId, secret, 'CITIZEN')
      response.cookie(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: production,
        sameSite: 'strict',
        maxAge: AUTH_TOKEN_TTL_SECONDS * 1000,
        path: '/',
      })
      response.json({ message: 'Senha atualizada. Você já pode continuar usando sua conta.' })
    } catch (error) {
      handlePrismaError(error, response, 'change-temporary-password')
    }
  })
}
