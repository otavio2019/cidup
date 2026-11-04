import { test } from 'node:test'
import assert from 'node:assert/strict'
import { callApi, cookieFor, record, recoveryRequests, responsibleCookieFor, setupTestServer, users, type RecordValue } from '../helpers/testServer.js'

// ===== TESTES: PEDIDOS DE RECUPERAÇÃO NO PAINEL (src/routes/admin/passwordRecoveryRequests.ts) =====
setupTestServer()

test('responsável define senha temporária e cidadão precisa trocá-la antes de acessar o sistema', async () => {
  // Cria um pedido pendente por CPF (src/routes/auth/passwordRecovery.ts) para o responsável atender.
  const recoveryRequest = await callApi('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ cpf: '529.982.247-25' }),
  })
  assert.equal(recoveryRequest.status, 202)

  const oldUser = { ...users.get(1)! }
  const noSession = await callApi('/api/admin/password-recovery-requests')
  assert.equal(noSession.status, 401)
  const citizenSession = await cookieFor(1)
  const forbidden = await callApi('/api/admin/password-recovery-requests', {
    headers: { Cookie: citizenSession },
  })
  assert.equal(forbidden.status, 403)

  const cookie = await responsibleCookieFor(99)
  const listResponse = await callApi('/api/admin/password-recovery-requests', {
    headers: { Cookie: cookie },
  })
  assert.equal(listResponse.status, 200)
  const requests = (await listResponse.json() as { requests: Array<{ id: number; citizen: string }> }).requests
  assert.equal(requests.length, 1)
  assert.equal(requests[0]?.citizen, 'Pessoa Um')
  const requestId = requests[0]?.id
  assert.ok(requestId)

  const setPassword = await callApi(`/api/admin/password-recovery-requests/${requestId}/temporary-password`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({ temporaryPassword: 'temporaria-123' }),
  })
  assert.equal(setPassword.status, 200)
  assert.equal(users.get(1)?.must_change_password, true)
  assert.notEqual(users.get(1)?.senha, 'temporaria-123')
  assert.equal(recoveryRequests.get(requestId)?.status, 'COMPLETED')

  const login = await callApi('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'um@example.test', password: 'temporaria-123' }),
  })
  assert.equal(login.status, 200)
  assert.equal(record((await login.json() as RecordValue).user).mustChangePassword, true)
  const temporaryCookie = login.headers.get('set-cookie')?.split(';')[0]
  assert.ok(temporaryCookie)

  const blocked = await callApi('/api/complaints', { headers: { Cookie: temporaryCookie } })
  assert.equal(blocked.status, 403)
  assert.equal((await blocked.json() as { code: string }).code, 'PASSWORD_CHANGE_REQUIRED')

  const unchanged = await callApi('/api/auth/change-temporary-password', {
    method: 'POST',
    headers: { Cookie: temporaryCookie },
    body: JSON.stringify({ newPassword: 'temporaria-123' }),
  })
  assert.equal(unchanged.status, 400)

  const changed = await callApi('/api/auth/change-temporary-password', {
    method: 'POST',
    headers: { Cookie: temporaryCookie },
    body: JSON.stringify({ newPassword: 'definitiva-123' }),
  })
  assert.equal(changed.status, 200)
  const regularCookie = changed.headers.get('set-cookie')?.split(';')[0]
  assert.ok(regularCookie)
  const accessible = await callApi('/api/complaints', { headers: { Cookie: regularCookie } })
  assert.equal(accessible.status, 200)

  users.set(1, oldUser)
  recoveryRequests.clear()
})

