import { test } from 'node:test'
import assert from 'node:assert/strict'
import { callApi, cookieFor, setupTestServer, type RecordValue } from '../helpers/testServer.js'

// ===== TESTES: RASCUNHO COM IA (src/routes/usuario/aiDraft.ts) =====
setupTestServer()

test('o endpoint de IA exige autenticação e falhas do Prisma não expõem segredos', async () => {
  const response = await callApi('/api/ai/complaint-draft', {
    method: 'POST',
    body: JSON.stringify({ description: 'Relato suficientemente detalhado.' }),
  })
  assert.equal(response.status, 401)
})

test('o rascunho da IA devolve só ocorrências aceitas pelo formulário', async () => {
  const originalFetch = globalThis.fetch
  const previousKey = process.env.AI_API_KEY
  const previousBaseUrl = process.env.AI_BASE_URL
  process.env.AI_API_KEY = 'test-key'
  process.env.AI_BASE_URL = 'http://ai.example.test/v1'
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!String(input).startsWith('http://ai.example.test/')) return originalFetch(input, init)
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        title: 'Buraco na Rua das Flores',
        categories: ['Buraco ou problema na via', 'Categoria inventada'],
        priority: 'Alta',
        summary: 'Há um buraco grande na Rua das Flores, perto da escola.',
      }) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
  try {
    const response = await callApi('/api/ai/complaint-draft', {
      method: 'POST',
      headers: { Cookie: await cookieFor(1) },
      body: JSON.stringify({ description: 'Há um buraco grande na Rua das Flores, perto da escola.' }),
    })
    const body = await response.json() as RecordValue
    assert.equal(response.status, 200)
    assert.deepEqual(body.categories, ['Buraco ou problema na via'])
    assert.equal(body.category, 'Buraco ou problema na via')
    assert.equal(body.title, 'Buraco na Rua das Flores')
  } finally {
    globalThis.fetch = originalFetch
    if (previousKey === undefined) delete process.env.AI_API_KEY
    else process.env.AI_API_KEY = previousKey
    if (previousBaseUrl === undefined) delete process.env.AI_BASE_URL
    else process.env.AI_BASE_URL = previousBaseUrl
  }
})

