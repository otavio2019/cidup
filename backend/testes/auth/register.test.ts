import { test } from 'node:test'
import assert from 'node:assert/strict'
import { callApi, record, setupTestServer, users, type RecordValue } from '../helpers/testServer.js'

// ===== TESTES: CADASTRO (src/routes/auth/register.ts) =====
setupTestServer()

test('o cadastro aceita dados válidos sem retornar o hash da senha', async () => {
  const response = await callApi('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Pessoa Nova',
      email: 'nova@example.test',
      phone: '3333333333',
      cpf: '123.456.789-09',
      cep: '58707-660',
      password: 'senha-segura',
    }),
  })
  const body = await response.json() as RecordValue
  assert.equal(response.status, 201)
  assert.equal(record(body.user).email, 'nova@example.test')
  assert.equal('senha' in record(body.user), false)
  assert.equal('passwordHash' in record(body.user), false)
  assert.notEqual(users.get(3)?.senha, 'senha-segura')
})

test('o cadastro rejeita dados inválidos sem criar um usuário', async () => {
  const beforeCount = users.size
  const response = await callApi('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'A', email: '', phone: '', password: 'x' }),
  })
  assert.equal(response.status, 400)
  assert.equal(users.size, beforeCount)
})

