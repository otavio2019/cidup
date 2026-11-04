import { readAuthUserId } from '../../auth.js'
import { requireAdministrator } from '../../middlewares/authenticate.js'
import { hashPassword } from '../../utils/passwords.js'
import { handlePrismaError } from '../../utils/prismaErrors.js'
import { isRecord, readPositiveInt } from '../../utils/validation.js'
import type { RouteContext } from '../context.js'

// ===== ADMIN: PEDIDOS DE RECUPERAÇÃO DE SENHA POR CPF =====
// Tela ligada: frontend/src/pages/admin/ResponsiblePanelPage.tsx.
export function registerPasswordRecoveryRequestRoutes({ app, database, authenticate }: RouteContext) {
  // O QUE FAZ: lista pedidos de recuperação de senha pendentes.
  // QUEM USA: ResponsiblePanelPage.tsx. MIDDLEWARE: authenticate, requireAdministrator.
  // PRISMA: password_recovery_request (com usuario).
  app.get('/api/admin/password-recovery-requests', authenticate, requireAdministrator, async (_request, response) => {
    try {
      const requests = await database.password_recovery_request.findMany({
        where: { status: 'PENDING' },
        orderBy: { requested_at: 'asc' },
        select: {
          id: true,
          requested_at: true,
          usuario: { select: { nome: true, email: true, telefone: true, cpf: true } },
        },
      })
      response.json({
        requests: requests.map((item) => ({
          id: item.id,
          requestedAt: item.requested_at,
          citizen: item.usuario.nome,
          email: item.usuario.email,
          phone: item.usuario.telefone,
          cpf: item.usuario.cpf,
        })),
      })
    } catch (error) {
      handlePrismaError(error, response, 'list-password-recovery-requests')
    }
  })

  // O QUE FAZ: gera senha temporária e obriga o usuário a trocá-la no próximo login.
  // QUEM USA: ResponsiblePanelPage.tsx. MIDDLEWARE: authenticate, requireAdministrator.
  // CHAMA: hashPassword. PRISMA: password_recovery_request, usuario (transação).
  app.post('/api/admin/password-recovery-requests/:id/temporary-password', authenticate, requireAdministrator, async (request, response) => {
    const requestId = readPositiveInt(request.params.id)
    const responsibleId = readAuthUserId(request)
    const temporaryPassword = isRecord(request.body) ? request.body.temporaryPassword : undefined
    if (!requestId || !responsibleId) {
      response.status(400).json({ error: 'Solicitação inválida.' })
      return
    }
    if (typeof temporaryPassword !== 'string' || temporaryPassword.length < 8 || temporaryPassword.length > 1024) {
      response.status(400).json({ error: 'A senha temporária deve ter pelo menos 8 caracteres.' })
      return
    }
    // Marca o pedido como atendido e grava a senha temporária na mesma transação.
    // O updateMany com status PENDING impede atender o mesmo pedido duas vezes.
    try {
      const completed = await database.$transaction(async (transaction) => {
        const requestUpdate = await transaction.password_recovery_request.updateMany({
          where: { id: requestId, status: 'PENDING' },
          data: { status: 'COMPLETED', resolved_at: new Date(), id_responsavel: responsibleId },
        })
        if (requestUpdate.count !== 1) return false
        const recoveryRequest = await transaction.password_recovery_request.findUnique({
          where: { id: requestId },
          select: { id_usuario: true },
        })
        if (!recoveryRequest) return false
        await transaction.usuario.update({
          where: { id_usuario: recoveryRequest.id_usuario },
          data: { senha: await hashPassword(temporaryPassword), must_change_password: true },
        })
        return true
      })
      if (!completed) {
        response.status(404).json({ error: 'Solicitação não encontrada ou já atendida.' })
        return
      }
      response.json({ message: 'Senha temporária definida. Entregue-a ao cidadão por um canal confiável.' })
    } catch (error) {
      handlePrismaError(error, response, 'set-temporary-password')
    }
  })
}
