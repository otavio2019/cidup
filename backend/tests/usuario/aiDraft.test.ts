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

test('o rascunho recebe contexto, remove categorias inventadas e normaliza a resposta', async () => {
  const originalFetch = globalThis.fetch
  const previousKey = process.env.AI_API_KEY
  const previousBaseUrl = process.env.AI_BASE_URL
  process.env.AI_API_KEY = 'test-key'
  process.env.AI_BASE_URL = 'http://ai.example.test/v1'
  let requestBody = ''
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!String(input).startsWith('http://ai.example.test/')) return originalFetch(input, init)
    requestBody = String(init?.body ?? '')
    const content = {
      title: 'Buraco na Rua das Flores',
      categories: ['Buraco ou problema na via', 'Categoria inventada'],
      priority: 'urgente',
      improvedDescription: 'Há um buraco grande na Rua das Flores, no Centro, perto da escola.',
    }
    return new Response(JSON.stringify({
      choices: [{ message: { content: `\`\`\`json\n${JSON.stringify(content)}\n\`\`\`` } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
  try {
    const response = await callApi('/api/ai/complaint-draft', {
      method: 'POST',
      headers: { Cookie: await cookieFor(1) },
      body: JSON.stringify({
        description: 'Há um buraco grande na Rua das Flores, perto da escola.',
        address: 'Rua das Flores',
        neighborhood: 'Centro',
        type: 'Buraco ou problema na via',
        categories: ['Buraco ou problema na via'],
      }),
    })
    const body = await response.json() as RecordValue
    assert.equal(response.status, 200)
    assert.deepEqual(body.categories, ['Buraco ou problema na via'])
    assert.equal(body.category, 'Buraco ou problema na via')
    assert.equal(body.title, 'Buraco na Rua das Flores')
    assert.equal(body.priority, 'Média')
    assert.equal(body.improvedDescription, 'Há um buraco grande na Rua das Flores, no Centro, perto da escola.')
    assert.match(requestBody, /Rua das Flores/)
    assert.match(requestBody, /Centro/)
    assert.match(requestBody, /Buraco ou problema na via/)
  } finally {
    globalThis.fetch = originalFetch
    if (previousKey === undefined) delete process.env.AI_API_KEY
    else process.env.AI_API_KEY = previousKey
    if (previousBaseUrl === undefined) delete process.env.AI_BASE_URL
    else process.env.AI_BASE_URL = previousBaseUrl
  }
})

test('a rota rejeita descrição curta e trata JSON inválido da IA sem quebrar', async () => {
  const shortResponse = await callApi('/api/ai/complaint-draft', {
    method: 'POST',
    headers: { Cookie: await cookieFor(1) },
    body: JSON.stringify({ description: 'curta' }),
  })
  assert.equal(shortResponse.status, 400)

  const originalFetch = globalThis.fetch
  const previousKey = process.env.AI_API_KEY
  const previousBaseUrl = process.env.AI_BASE_URL
  process.env.AI_API_KEY = 'test-key'
  process.env.AI_BASE_URL = 'http://ai.invalid.test/v1'
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!String(input).startsWith('http://ai.invalid.test/')) return originalFetch(input, init)
    return new Response(JSON.stringify({ choices: [{ message: { content: '{invalido' } }] }), { status: 200 })
  }) as typeof fetch
  try {
    const invalidResponse = await callApi('/api/ai/complaint-draft', {
      method: 'POST',
      headers: { Cookie: await cookieFor(1) },
      body: JSON.stringify({ description: 'Há um problema urbano detalhado neste local.' }),
    })
    assert.equal(invalidResponse.status, 502)
  } finally {
    globalThis.fetch = originalFetch
    if (previousKey === undefined) delete process.env.AI_API_KEY
    else process.env.AI_API_KEY = previousKey
    if (previousBaseUrl === undefined) delete process.env.AI_BASE_URL
    else process.env.AI_BASE_URL = previousBaseUrl
  }
})
