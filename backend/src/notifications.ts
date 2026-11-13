import type { PrismaClient } from '@prisma/client'

export type NotificationInput = {
  title: string
  message: string
  type: string
  userId?: number
  responsibleId?: number
  complaintId?: number
}

export async function createNotification(database: PrismaClient, input: NotificationInput) {
  return database.notificacao.create({
    data: {
      titulo: input.title,
      mensagem: input.message,
      tipo: input.type,
      ...(input.userId ? { usuario: { connect: { id_usuario: input.userId } } } : {}),
      ...(input.responsibleId ? { responsavel: { connect: { id_responsavel: input.responsibleId } } } : {}),
      ...(input.complaintId ? { denuncia: { connect: { id_denuncia: input.complaintId } } } : {}),
    },
  })
}

export async function notifyResponsibleOrganizations(
  database: PrismaClient,
  organizationIds: number[],
  input: Omit<NotificationInput, 'userId' | 'responsibleId'>,
) {
  const ids = [...new Set(organizationIds)]
  if (!ids.length) return
  const responsaveis = await database.responsavel.findMany({
    where: { id_orgao: { in: ids } },
    select: { id_responsavel: true },
  })
  await Promise.all(responsaveis.map((responsavel) => createNotification(database, {
    ...input,
    responsibleId: responsavel.id_responsavel,
  })))
}

export async function notifyAllResponsibles(database: PrismaClient, input: Omit<NotificationInput, 'userId' | 'responsibleId'>) {
  const responsaveis = await database.responsavel.findMany({ select: { id_responsavel: true } })
  await Promise.all(responsaveis.map((responsavel) => createNotification(database, {
    ...input,
    responsibleId: responsavel.id_responsavel,
  })))
}

export async function notifySafely(action: () => Promise<unknown>, label = 'notificação interna') {
  try {
    await action()
  } catch (error) {
    console.error(`Falha em ${label}:`, error instanceof Error ? error.message : 'erro desconhecido')
  }
}

export function notificationResponse(notification: {
  id: number
  titulo: string
  mensagem: string
  tipo: string
  lida: boolean
  data_criacao: Date
  id_denuncia: number | null
}) {
  return {
    id: notification.id,
    title: notification.titulo,
    message: notification.mensagem,
    type: notification.tipo,
    read: notification.lida,
    createdAt: notification.data_criacao.toISOString(),
    complaintId: notification.id_denuncia,
  }
}
