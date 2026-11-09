import { AUTH_COOKIE_NAME, readAuthPrincipalType, readAuthUserId } from '../../auth.js'
import { handlePrismaError } from '../../utilitarios/prismaErrors.js'
import type { RouteContext } from '../context.js'

// ===== AUTENTICAÇÃO: SESSÃO E LOGOUT =====
export function registerSessionRoutes({ app, database, authenticate, production, authCookieSameSite }: RouteContext) {
  // Encerra a sessão removendo o cookie com os mesmos atributos de segurança.
  // QUEM USA: ProfilePage.tsx e DashboardPage.tsx. MIDDLEWARE: nenhum. Prisma: nenhum.
  app.post('/api/auth/logout', (_request, response) => {
    response.clearCookie(AUTH_COOKIE_NAME, {
      httpOnly: true,
      secure: production,
      sameSite: authCookieSameSite,
      path: '/',
    })
    response.status(204).send()
  })

  // Confirma a sessão atual consultando o usuário associado ao token.
  // QUEM USA: App.tsx (restaura sessão), DashboardPage.tsx, ProfilePage.tsx,
  // ResponsiblePanelPage.tsx. MIDDLEWARE: authenticate. PRISMA: responsavel, usuario.
  app.get('/api/auth/session', authenticate, async (request, response) => {
    const principalId = readAuthUserId(request)
    if (!principalId) {
      response.status(401).json({ error: 'Autenticação necessária.' })
      return
    }
    try {
      if (readAuthPrincipalType(request) === 'RESPONSIBLE') {
        const responsible = await database.responsavel.findUnique({
          where: { id_responsavel: principalId },
          select: {
            id_responsavel: true,
            nome: true,
            email: true,
            telefone: true,
            orgao: { select: { id_orgao: true, nome: true } },
          },
        })
        if (!responsible) {
          response.status(401).json({ error: 'Credencial inválida ou expirada.' })
          return
        }
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
      const id_usuario = principalId
      const user = await database.usuario.findUnique({
        where: { id_usuario },
        select: { id_usuario: true, nome: true, email: true, telefone: true, cpf: true, cep: true, foto: true, must_change_password: true },
      })
      if (!user) {
        response.status(401).json({ error: 'Credencial inválida ou expirada.' })
        return
      }
      response.json({
        user: {
          id: user.id_usuario,
          name: user.nome,
          email: user.email,
          phone: user.telefone,
          role: 'CITIZEN',
          mustChangePassword: user.must_change_password,
        },
      })
    } catch (error) {
      handlePrismaError(error, response, 'read-auth-session')
    }
  })
}
