import { test } from 'node:test'
import assert from 'node:assert/strict'
import { callApi, recoveryRequests, setupTestServer } from '../helpers/testServer.js'

// ===== TESTES: RECUPERAÇÃO DE SENHA (src/routes/auth/passwordRecovery.ts) =====
setupTestServer()

test('solicitar recuperação por CPF retorna sempre a mesma resposta genérica', async () => {
  const response = await callApi('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ cpf: '529.982.247-25' }),
  })
  const knownBody = await response.json()
  assert.equal(response.status, 202)
  assert.deepEqual(knownBody, {
    message: 'Se os dados corresponderem a uma conta, a solicitação será encaminhada ao responsável.',
  })
  assert.equal(recoveryRequests.size, 1)

  const missing = await callApi('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ cpf: '935.411.347-80' }),
  })
  assert.equal(missing.status, 202)
  assert.deepEqual(await missing.json(), knownBody)
  assert.equal(recoveryRequests.size, 1)

  const invalid = await callApi('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ cpf: '12345678900' }),
  })
  assert.equal(invalid.status, 202)
  assert.deepEqual(await invalid.json(), knownBody)
  assert.equal(recoveryRequests.size, 1)

  const duplicate = await callApi('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ cpf: '52998224725' }),
  })
  assert.equal(duplicate.status, 202)
  assert.equal(recoveryRequests.size, 1)
})

