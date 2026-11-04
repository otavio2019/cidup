import { test } from 'node:test'
import assert from 'node:assert/strict'
import { callApi, calls, cookieFor, record, secret, setupTestServer, type RecordValue } from '../helpers/testServer.js'
import { SignJWT } from 'jose'
import { AUTH_COOKIE_NAME } from '../../src/auth.js'

// ===== TESTES: SESSÃO E PROTEÇÃO DAS ROTAS (src/auth.ts e src/middlewares/authenticate.ts) =====
setupTestServer()

test('a API protegida rejeita solicitações sem cookie, independentemente de x-user-id', async () => {
  const response = await callApi('/api/complaints', {
    headers: { 'x-user-id': '1' },
  })
  assert.equal(response.status, 401)
})

test('a API protegida rejeita cookies inválidos ou expirados', async () => {
  const invalid = await callApi('/api/complaints', {
    headers: { Cookie: `${AUTH_COOKIE_NAME}=not-a-jwt` },
  })
  const expiredToken = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer('cidup-api')
    .setAudience('cidup-web')
    .setSubject('1')
    .setIssuedAt(Math.floor(Date.now() / 1000) - 60)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 1)
    .sign(new TextEncoder().encode(secret))
  const expired = await callApi('/api/complaints', {
    headers: { Cookie: `${AUTH_COOKIE_NAME}=${expiredToken}` },
  })
  assert.equal(invalid.status, 401)
  assert.equal(expired.status, 401)
})

test('x-user-id não substitui a identidade do usuário no cookie assinado', async () => {
  calls.length = 0
  const response = await callApi('/api/complaints', {
    headers: {
      Cookie: await cookieFor(1),
      'x-user-id': '2',
    },
  })
  const body = await response.json() as RecordValue
  const listed = body.complaints as RecordValue[]
  assert.equal(response.status, 200)
  assert.equal(listed.some((complaint) => complaint.id === 202), false)
  assert.equal(listed.every((complaint) => complaint.id_usuario === 1), true)
  assert.equal(calls.find((call) => call.model === 'denuncia' && call.method === 'findMany')?.args.where instanceof Object, true)
  assert.equal(record(calls.find((call) => call.model === 'denuncia' && call.method === 'findMany')?.args.where).id_usuario, 1)
})

