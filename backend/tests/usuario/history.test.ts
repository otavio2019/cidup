import { test } from 'node:test'
import assert from 'node:assert/strict'
import { callApi, calls, cookieFor, record, setupTestServer } from '../helpers/testServer.js'

// ===== TESTES: HISTÓRICO (src/routes/usuario/history.ts) =====
setupTestServer()

test('os históricos são privados e limitados ao usuário autenticado', async () => {
  const unauthorized = await callApi('/api/historicos')
  assert.equal(unauthorized.status, 401)
  calls.length = 0
  const response = await callApi('/api/historicos', { headers: { Cookie: await cookieFor(1) } })
  assert.equal(response.status, 200)
  const query = calls.find((call) => call.model === 'historico' && call.method === 'findMany')
  assert.equal(record(query?.args.where).denuncia !== undefined, true)
})

