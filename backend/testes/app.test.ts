import { test } from 'node:test'
import assert from 'node:assert/strict'
import { callApi, client, setupTestServer } from './helpers/testServer.js'
import { createApp } from '../src/app.js'

// ===== TESTES GERAIS DA API (app.ts) =====
setupTestServer()

test('o endpoint de saúde é público e responde com sucesso', async () => {
  const response = await callApi('/health')
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok' })
})

test('falhas do Prisma retornam uma mensagem genérica sem detalhes confidenciais', async () => {
  process.env.TEST_PRISMA_ERROR = '1'
  const originalError = console.error
  const logged: unknown[][] = []
  console.error = (...args: unknown[]) => { logged.push(args) }
  try {
    const response = await callApi('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'um@example.test', password: 'secret-password' }),
    })
    const body = await response.text()
    assert.equal(response.status, 500)
    assert.equal(body.includes('detalhes confidenciais da conexão com o banco de dados'), false)
    assert.equal(logged.some((args) => args.join(' ').includes('detalhes confidenciais da conexão com o banco de dados')), false)
    assert.equal(logged.some((args) => JSON.stringify(args).includes('"name":"Error"')), true)
  } finally {
    delete process.env.TEST_PRISMA_ERROR
    console.error = originalError
  }
})

test('o login rejeita segredos de token malformados ou curtos demais ao iniciar a aplicação', () => {
  assert.throws(
    () => createApp(client, { authTokenSecret: 'short-secret' }),
    /pelo menos 32 bytes/i,
  )
})

