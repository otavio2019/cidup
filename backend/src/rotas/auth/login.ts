import { AUTH_COOKIE_NAME, AUTH_TOKEN_TTL_SECONDS, createAuthToken } from '../../auth.js'
import { loginRateLimit } from '../../intermediarios/rateLimits.js'
import { verifyPassword } from '../../utilitarios/passwords.js'
import { handlePrismaError } from '../../utilitarios/prismaErrors.js'
import { digits, isRecord } from '../../utilitarios/validation.js'
import type { RouteContext } from '../context.js'

// ===== AUTENTICAÇÃO: LOGIN =====
// Tela ligada: frontend/src/pages/auth/LoginPage.tsx.
export function registerLoginRoutes({ app, database, secret, production, authCookieSameSite }: RouteContext) {
  // Autentica as credenciais e devolve os dados públicos junto ao cookie de sessão.
  // QUEM USA: LoginPage.tsx. MIDDLEWARE: loginRateLimit.
  // CHAMA: verifyPassword, createAuthToken (src/auth.ts), handlePrismaError.
  // PRISMA: responsavel (login por e-mail), usuario (e-mail ou CPF).
  app.post('/api/auth/login', loginRateLimit, async (request, response) => {
    const body = isRecord(request.body) ? request.body : {}
    // Aceita e-mail ou CPF no mesmo campo; "email" continua aceito por compatibilidade.
    const rawLogin = typeof body.login === 'string' ? body.login : typeof body.email === 'string' ? body.email : ''
    const identifier = rawLogin.trim()
    const isEmailLogin = identifier.includes('@')
    const email = isEmailLogin ? identifier.toLowerCase() : ''
    const cpf = isEmailLogin ? '' : digits(identifier)
    const password = body.password
    const validIdentifier = isEmailLogin ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) : /^\d{11}$/.test(cpf)
    if (!validIdentifier || typeof password !== 'string' || password.length > 1024) {
      response.status(400).json({ error: 'Informe e-mail ou CPF e a senha.' })
      return
    }

    try {
      // 1) Tenta primeiro como responsável (painel admin).
      //    Responsáveis só têm e-mail; o login por CPF vale apenas para cidadãos.
      const responsible = isEmailLogin ? await database.responsavel.findUnique({
        where: { email },
        include: { orgao: { select: { id_orgao: true, nome: true } } },
      }) : null
      if (responsible) {
        if (!(await verifyPassword(password, responsible.senha))) {
          response.status(401).json({ error: 'E-mail/CPF ou senha inválidos.' })
          return
        }
        const token = await createAuthToken(responsible.id_responsavel, secret, 'RESPONSIBLE')
        response.cookie(AUTH_COOKIE_NAME, token, {
          httpOnly: true,
          secure: production,
          sameSite: authCookieSameSite,
          maxAge: AUTH_TOKEN_TTL_SECONDS * 1000,
          path: '/',
        })
        response.json({
          user: {
            id: responsible.id_responsavel,
            name: responsible.nome,
            email: responsible.email,
            phone: responsible.telefone,
            role: 'RESPONSIBLE',
            orgao: responsible.orgao ?? null,
          },
        })
        return
      }
      // 2) Não achou responsável: tenta cidadão (por e-mail ou CPF).
      //    Mesma mensagem de erro para "não existe" e "senha errada" (não revela contas).
      const user = await database.usuario.findUnique({ where: isEmailLogin ? { email } : { cpf } })
      if (!user || !(await verifyPassword(password, user.senha))) {
        response.status(401).json({ error: 'E-mail/CPF ou senha inválidos.' })
        return
      }
      const mustChangePassword = user.must_change_password
      const token = await createAuthToken(
        user.id_usuario,
        secret,
        mustChangePassword ? 'PASSWORD_CHANGE_REQUIRED' : 'CITIZEN',
      )
      response.cookie(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: production,
        sameSite: 'strict',
        maxAge: AUTH_TOKEN_TTL_SECONDS * 1000,
        path: '/',
      })
      response.json({
        user: {
          id: user.id_usuario,
          name: user.nome,
          email: user.email,
          phone: user.telefone,
          cpf: user.cpf,
          cep: user.cep,
          photo: user.foto,
          role: 'CITIZEN',
          mustChangePassword,
        },
      })
    } catch (error) {
      handlePrismaError(error, response, 'login')
    }
  })
}
