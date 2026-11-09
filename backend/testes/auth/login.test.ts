import { test } from 'node:test'
import assert from 'node:assert/strict'
import { callApi, record, setupTestServer, type RecordValue } from '../helpers/testServer.js'

// ===== TESTES: LOGIN (src/routes/auth/login.ts) =====
setupTestServer()

test('o login verifica a senha e emite um cookie de sessão HttpOnly', async () => {
  const response = await callApi('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'um@example.test', password: 'secret-password' }),
  })
  const body = await response.json() as RecordValue
  const setCookie = response.headers.get('set-cookie') ?? ''
  assert.equal(response.status, 200)
  assert.equal('token' in body, false)
  assert.match(setCookie, /HttpOnly/i)
  assert.match(setCookie, /SameSite=Strict/i)
  assert.match(setCookie, /Path=\//i)
  assert.equal(setCookie.includes('Secure'), false)
})

test('o login aceita CPF com ou sem máscara no lugar do e-mail', async () => {
  for (const login of ['529.982.247-25', '52998224725']) {
    const response = await callApi('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password: 'secret-password' }),
    })
    assert.equal(response.status, 200)
    assert.equal(record((await response.json() as RecordValue).user).email, 'um@example.test')
  }
})

test('o login rejeita uma senha incorreta', async () => {
  const response = await callApi('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'um@example.test', password: 'wrong-password' }),
  })
  assert.equal(response.status, 401)
  assert.equal(response.headers.get('set-cookie'), null)
})

test('o login do responsável usa a conta própria e retorna o papel RESPONSIBLE', async () => {
  const response = await callApi('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'responsavel@example.test', password: 'secret-password' }),
  })
  const body = await response.json() as RecordValue
  assert.equal(response.status, 200)
  assert.equal(record(body.user).role, 'RESPONSIBLE')
  assert.equal(record(body.user).email, 'responsavel@example.test')
})

