import { test } from 'node:test'
import assert from 'node:assert/strict'
import { callApi, cookieFor, setupTestServer, type RecordValue } from '../helpers/testServer.js'
import { extractAiAddress } from '../../src/utils/aiAddress.js'

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
    assert.equal(body.description, 'Há um buraco grande na Rua das Flores, perto da escola.')
    assert.equal(body.type, 'Buraco ou problema na via')
    assert.equal(body.street, null)
    assert.equal(body.number, null)
    assert.equal(body.neighborhood, null)
    assert.equal(body.referencePoint, null)
    assert.equal(body.summary, body.improvedDescription)
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

test('a rota devolve a localização estruturada sem alterar a descrição original', async () => {
  const originalFetch = globalThis.fetch
  const previousKey = process.env.AI_API_KEY
  const previousBaseUrl = process.env.AI_BASE_URL
  const description = 'Existe um buraco na Avenida Solon de Lucena, número 55, no bairro Centro, próximo à praça.'
  process.env.AI_API_KEY = 'test-key'
  process.env.AI_BASE_URL = 'http://ai.address.test/v1'
  let prompt = ''
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!String(input).startsWith('http://ai.address.test/')) return originalFetch(input, init)
    prompt = String(init?.body)
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      title: 'Buraco na avenida',
      categories: ['Buraco ou problema na via'],
      priority: 'ALTA',
      improvedDescription: 'Um buraco na avenida.',
      street: 'Avenida Solon de Lucena',
      number: '55',
      neighborhood: 'Centro',
      referencePoint: 'próximo à praça',
    }) } }] }), { status: 200 })
  }) as typeof fetch
  try {
    const response = await callApi('/api/ai/complaint-draft', {
      method: 'POST',
      headers: { Cookie: await cookieFor(1) },
      body: JSON.stringify({ description }),
    })
    const body = await response.json() as RecordValue
    assert.equal(response.status, 200)
    assert.equal(body.description, description)
    assert.equal(body.street, 'Avenida Solon de Lucena')
    assert.equal(body.number, '55')
    assert.equal(body.neighborhood, 'Centro')
    assert.equal(body.referencePoint, 'próximo à praça')
    assert.equal(body.type, 'Buraco ou problema na via')
    assert.equal(body.priority, 'Alta')
    assert.match(prompt, /referencePoint/)
    assert.match(prompt, /CEP/)
  } finally {
    globalThis.fetch = originalFetch
    if (previousKey === undefined) delete process.env.AI_API_KEY
    else process.env.AI_API_KEY = previousKey
    if (previousBaseUrl === undefined) delete process.env.AI_BASE_URL
    else process.env.AI_BASE_URL = previousBaseUrl
  }
})

test('valida os campos de endereço propostos pela IA contra o relato', () => {
  const cases = [
    {
      description: 'Poste apagado na Avenida Solon de Lucena, número 55, Centro, perto da praça.',
      proposed: { street: 'Avenida Solon de Lucena', number: '55', neighborhood: 'Centro', referencePoint: 'perto da praça' },
      expected: { street: 'Avenida Solon de Lucena', number: '55', neighborhood: 'Centro', referencePoint: 'perto da praça' },
    },
    {
      description: 'Buraco na Rua das Flores, no bairro Catolé.',
      proposed: { street: 'Rua das Flores', number: null, neighborhood: 'Catolé', referencePoint: null },
      expected: { street: 'Rua das Flores', number: null, neighborhood: 'Catolé', referencePoint: null },
    },
    {
      description: 'Lixo acumulado próximo ao mercado municipal.',
      proposed: { street: 'Rua inventada', number: '99', neighborhood: 'Centro', referencePoint: 'próximo ao mercado municipal' },
      expected: { street: null, number: null, neighborhood: null, referencePoint: 'próximo ao mercado municipal' },
    },
    {
      description: 'Problema de iluminação pública.',
      proposed: { street: 'Rua inventada', number: '55', neighborhood: 'Centro', referencePoint: 'perto da praça' },
      expected: { street: null, number: null, neighborhood: null, referencePoint: null },
    },
    {
      description: 'Problema perto da Praça da Bandeira, CEP 58400-055, protocolo número 55.',
      proposed: { street: 'Praça da Bandeira', number: '55', neighborhood: 'Bandeira', referencePoint: 'perto da Praça da Bandeira' },
      expected: { street: null, number: null, neighborhood: null, referencePoint: 'perto da Praça da Bandeira' },
    },
    {
      description: 'Buraco na Rua das Flores, 55, Centro, perto da escola.',
      proposed: { street: 'Rua das Flores, 55, Centro', number: '55', neighborhood: 'Centro', referencePoint: 'perto da escola' },
      expected: { street: null, number: null, neighborhood: null, referencePoint: 'perto da escola' },
    },
    {
      description: 'Buraco na Rua das Flores 55 Centro, perto da escola.',
      proposed: { street: 'Rua das Flores 55 Centro', number: '55', neighborhood: 'Centro', referencePoint: 'perto da escola' },
      expected: { street: null, number: null, neighborhood: null, referencePoint: 'perto da escola' },
    },
    {
      description: 'Problema na Travessa São José, telefone 99888-5544, no bairro Centro.',
      proposed: { street: 'Travessa São José', number: '99888', neighborhood: 'Centro', referencePoint: null },
      expected: { street: 'Travessa São José', number: null, neighborhood: 'Centro', referencePoint: null },
    },
  ]
  for (const { description, proposed, expected } of cases) {
    assert.deepEqual(extractAiAddress(proposed, description), expected, description)
  }

  for (const street of ['Av. Brasil', 'Travessa São José', 'Praça da Sé', 'Rodovia BR-101', 'Estrada Velha']) {
    const description = `Há um problema na ${street}, 42, no bairro Centro.`
    assert.deepEqual(extractAiAddress({ street, number: '42', neighborhood: 'Centro' }, description), {
      street, number: '42', neighborhood: 'Centro', referencePoint: null,
    })
  }
  assert.deepEqual(extractAiAddress(
    { street: 'Rua dos Ipês', number: '120', neighborhood: 'Catolé', referencePoint: 'em frente ao colégio' },
    'Buraco na Rua dos Ipês 120, no bairro Catolé, em frente ao colégio.',
  ), { street: 'Rua dos Ipês', number: '120', neighborhood: 'Catolé', referencePoint: 'em frente ao colégio' })
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
