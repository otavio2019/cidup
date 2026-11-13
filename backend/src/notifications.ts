import type { PrismaClient } from '@prisma/client'
import webpush from 'web-push'

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const vapidSubject = process.env.VAPID_SUBJECT

if (vapidPublicKey && vapidPrivateKey && vapidSubject) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
}

export type NotificationInput = {
  title: string
  message: string
  type: string
  userId?: number
  responsibleId?: number
  complaintId?: number
}

export async function createNotification(database: PrismaClient, input: NotificationInput) {
  const notification = await database.notificacao.create({
    data: {
      titulo: input.title,
      mensagem: input.message,
      tipo: input.type,
      ...(input.userId ? { usuario: { connect: { id_usuario: input.userId } } } : {}),
      ...(input.responsibleId ? { responsavel: { connect: { id_responsavel: input.responsibleId } } } : {}),
      ...(input.complaintId ? { denuncia: { connect: { id_denuncia: input.complaintId } } } : {}),
    },
  })

  await notifySafely(
    () => sendPushForNotification(database, notification.id, input),
    'envio de notificação Push',
  )
  return notification
}

async function sendPushForNotification(
  database: PrismaClient,
  notificationId: number,
  input: NotificationInput,
) {
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) return
  const target = input.responsibleId
    ? { id_responsavel: input.responsibleId }
    : input.userId
      ? { id_usuario: input.userId }
      : null
  if (!target) return

  const subscriptions = await database.push_subscription.findMany({ where: target })
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify({
          id: notificationId,
          title: input.title,
          message: input.message,
          complaintId: input.complaintId ?? null,
          url: input.responsibleId ? '/responsavel/denuncias' : '/minhas-denuncias',
        }),
      )
    } catch (error: unknown) {
      const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
        ? Number(error.statusCode)
        : null
      if (statusCode === 404 || statusCode === 410) {
        await database.push_subscription.delete({ where: { id: subscription.id } })
        return
      }
      throw error
    }
  }))
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
