import { readAuthUserId } from '../auth.js'
import { isResponsibleRequest } from '../intermediarios/authenticate.js'
import { notificationResponse } from '../notifications.js'
import { handlePrismaError } from '../utilitarios/prismaErrors.js'
import { readPositiveInt } from '../utilitarios/validation.js'
import type { RouteContext } from './context.js'

export function registerNotificationRoutes({ app, database, authenticate }: RouteContext) {
  app.get(['/api/notifications', '/api/notificacoes'], authenticate, async (request, response) => {
    const principalId = readAuthUserId(request)
    if (!principalId) {
      response.status(401).json({ error: 'Autenticação necessária.' })
      return
    }
    const where = isResponsibleRequest(request) ? { id_responsavel: principalId } : { id_usuario: principalId }
    try {
      const [notifications, unreadCount, unreadByType] = await Promise.all([
        database.notificacao.findMany({
          where,
          orderBy: { data_criacao: 'desc' },
          take: 50,
          select: { id: true, titulo: true, mensagem: true, tipo: true, lida: true, data_criacao: true, id_denuncia: true },
        }),
        database.notificacao.count({ where: { ...where, lida: false } }),
        database.notificacao.groupBy({ by: ['tipo'], where: { ...where, lida: false }, _count: { _all: true } }),
      ])
      response.json({
        notifications: notifications.map(notificationResponse),
        unreadCount,
        unreadByType: Object.fromEntries(unreadByType.map((item) => [item.tipo, item._count._all])),
      })
    } catch (error) {
      handlePrismaError(error, response, 'list-notifications')
    }
  })

  app.patch(['/api/notifications/:id/read', '/api/notificacoes/:id/ler'], authenticate, async (request, response) => {
    const principalId = readAuthUserId(request)
    const notificationId = readPositiveInt(request.params.id)
    if (!principalId || !notificationId) {
      response.status(400).json({ error: 'Notificação inválida.' })
      return
    }
    const where = isResponsibleRequest(request)
      ? { id: notificationId, id_responsavel: principalId }
      : { id: notificationId, id_usuario: principalId }
    try {
      const result = await database.notificacao.updateMany({ where, data: { lida: true } })
      if (result.count !== 1) {
        response.status(404).json({ error: 'Notificação não encontrada.' })
        return
      }
      response.status(204).send()
    } catch (error) {
      handlePrismaError(error, response, 'read-notification')
    }
  })

  app.patch(['/api/notifications/read-all', '/api/notificacoes/ler-todas'], authenticate, async (request, response) => {
    const principalId = readAuthUserId(request)
    if (!principalId) {
      response.status(401).json({ error: 'Autenticação necessária.' })
      return
    }
    const where = isResponsibleRequest(request) ? { id_responsavel: principalId } : { id_usuario: principalId }
    try {
      const result = await database.notificacao.updateMany({ where: { ...where, lida: false }, data: { lida: true } })
      response.json({ updated: result.count })
    } catch (error) {
      handlePrismaError(error, response, 'read-all-notifications')
    }
  })
}
