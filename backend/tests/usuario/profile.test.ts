import { test } from 'node:test'
import assert from 'node:assert/strict'
import { callApi, cookieFor, setupTestServer, users } from '../helpers/testServer.js'

// ===== TESTES: PERFIL (src/routes/usuario/profile.ts) =====
setupTestServer()

test('o usuário autenticado só pode atualizar e excluir o próprio cadastro', async () => {
  const cookie = await cookieFor(1)
  const otherUser = await callApi('/api/users/2', {
    method: 'PATCH',
    headers: { Cookie: cookie },
    body: JSON.stringify({ name: 'Alterado indevidamente' }),
  })
  const invalidId = await callApi('/api/users/not-an-id', { headers: { Cookie: cookie } })
  assert.equal(otherUser.status, 404)
  assert.equal(invalidId.status, 400)
  assert.equal(users.get(2)?.nome, 'Pessoa Dois')
})

