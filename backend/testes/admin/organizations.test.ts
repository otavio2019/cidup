import { test } from 'node:test'
import assert from 'node:assert/strict'
import { callApi, cookieFor, setupTestServer, type RecordValue } from '../helpers/testServer.js'

// ===== TESTES: ÓRGÃOS (src/routes/admin/organizations.ts) =====
setupTestServer()

test('consultas de órgãos expõem apenas campos públicos e alterações exigem administrador autorizado', async () => {
  const publicResponse = await callApi('/api/orgaos')
  const publicBody = await publicResponse.json() as RecordValue
  const organization = (publicBody.orgaos as RecordValue[])[0]
  assert.equal(publicResponse.status, 200)
  assert.ok(organization)
  assert.equal('email' in organization, false)
  assert.equal('telefone' in organization, false)

  const unauthenticatedWrite = await callApi('/api/orgaos', {
    method: 'POST',
    body: JSON.stringify({ nome: 'Órgão', email: 'o@example.test', telefone: '444', descricao: 'Teste' }),
  })
  const citizenWrite = await callApi('/api/orgaos', {
    method: 'POST',
    headers: { Cookie: await cookieFor(1) },
    body: JSON.stringify({ nome: 'Órgão', email: 'o@example.test', telefone: '444', descricao: 'Teste' }),
  })
  assert.equal(unauthenticatedWrite.status, 401)
  assert.equal(citizenWrite.status, 403)
})

