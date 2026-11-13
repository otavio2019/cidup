import { test } from 'node:test'
import assert from 'node:assert/strict'
import { callApi, cookieFor, notifications, responsibleCookieFor, setupTestServer } from './helpers/testServer.js'

setupTestServer()

test('notificações são criadas e isoladas por cidadão e responsável', async () => {
  const citizen = await cookieFor(1)
  const otherCitizen = await cookieFor(2)
  const responsible = await responsibleCookieFor(99)
  const created = await callApi('/api/complaints', {
    method: 'POST',
    headers: { Cookie: citizen },
    body: JSON.stringify({
      type: 'Buraco ou problema na via',
      description: 'Buraco na rua de teste.',
      address: 'Rua de teste, 10',
      latitude: -23,
      longitude: -46,
    }),
  })
  assert.equal(created.status, 201)

  const citizenResponse = await callApi('/api/notificacoes', { headers: { Cookie: citizen } })
  const citizenBody = await citizenResponse.json() as { notifications: Array<{ id: number; type: string }>; unreadCount: number; unreadByType: Record<string, number> }
  assert.equal(citizenResponse.status, 200)
  assert.equal(citizenBody.unreadCount, 1)
  assert.equal(citizenBody.unreadByType.COMPLAINT_RECEIVED, 1)
  assert.equal(citizenBody.notifications[0]?.type, 'COMPLAINT_RECEIVED')
  const citizenNotificationId = citizenBody.notifications[0]!.id

  const responsibleResponse = await callApi('/api/notifications', { headers: { Cookie: responsible } })
  const responsibleBody = await responsibleResponse.json() as { notifications: Array<{ id: number }>; unreadCount: number }
  assert.equal(responsibleBody.unreadCount, 1)
  const responsibleNotificationId = responsibleBody.notifications[0]!.id
  assert.notEqual(citizenNotificationId, responsibleNotificationId)

  const forbidden = await callApi(`/api/notifications/${citizenNotificationId}/read`, {
    method: 'PATCH',
    headers: { Cookie: otherCitizen },
  })
  assert.equal(forbidden.status, 404)
  assert.equal(notifications.get(citizenNotificationId)?.lida, false)

  const read = await callApi(`/api/notificacoes/${citizenNotificationId}/ler`, {
    method: 'PATCH',
    headers: { Cookie: citizen },
  })
  assert.equal(read.status, 204)
  assert.equal(notifications.get(citizenNotificationId)?.lida, true)
  const readAll = await callApi('/api/notifications/read-all', {
    method: 'PATCH',
    headers: { Cookie: responsible },
  })
  assert.deepEqual(await readAll.json(), { updated: 1 })
  assert.equal(notifications.get(responsibleNotificationId)?.lida, true)
})

test('recuperação de senha e histórico notificam os destinatários corretos', async () => {
  notifications.clear()
  const recovery = await callApi('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ cpf: '52998224725' }),
  })
  assert.equal(recovery.status, 202)
  assert.ok([...notifications.values()].some((item) => item.tipo === 'PASSWORD_RECOVERY' && item.id_responsavel === 99))

  const history = await callApi('/api/historicos', {
    method: 'POST',
    headers: { Cookie: await responsibleCookieFor(99) },
    body: JSON.stringify({ id_denuncia: 101, descricao: 'Atualização', foto: 'foto', observacao: 'Em atendimento' }),
  })
  assert.equal(history.status, 201)
  assert.ok([...notifications.values()].some((item) =>
    item.tipo === 'COMPLAINT_OBSERVATION' && item.id_usuario === 1 && item.id_denuncia === 101,
  ))
})
