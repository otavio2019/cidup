import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  clearTestEmails,
  getTestEmails,
  notifySafely,
  sendComplaintReceivedEmail,
  sendComplaintStatusEmail,
  sendPasswordResetEmail,
} from '../src/email.js'

// ===== TESTES: ENVIO DE E-MAILS (src/email.ts) =====
// Nenhum teste chama o Brevo de verdade: fetch é substituído por um mock.

const FAKE_KEY = 'xkeysib-fake-test-key-123'
const ENV_KEYS = ['EMAIL_DISABLED', 'BREVO_API_KEY', 'BREVO_API_URL', 'SMTP_FROM', 'NODE_ENV', 'SMTP_HOST'] as const
const originalFetch = globalThis.fetch
let savedEnv: Record<string, string | undefined> = {}

type FetchCall = { url: string; init: RequestInit }

function mockFetch(handler: (call: FetchCall) => Promise<Response> | Response) {
  const calls: FetchCall[] = []
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(input), init: init ?? {} }
    calls.push(call)
    return handler(call)
  }) as typeof fetch
  return calls
}

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
  for (const key of ENV_KEYS) delete process.env[key]
  clearTestEmails()
})

afterEach(() => {
  globalThis.fetch = originalFetch
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key]
    else process.env[key] = savedEnv[key]
  }
})

test('sem BREVO_API_KEY, guarda a mensagem em memória e não chama fetch', async () => {
  const calls = mockFetch(() => new Response('{}', { status: 201 }))
  await sendPasswordResetEmail('cidadao@example.test', 'http://localhost:5173/recuperar-senha/nova?token=abc')
  const [message] = getTestEmails()
  assert.equal(message?.to, 'cidadao@example.test')
  assert.match(message?.subject ?? '', /Recuperação de senha/)
  assert.match(message?.text ?? '', /token=abc/)
  for (const content of [message?.text, message?.html]) {
    assert.match(content ?? '', /redefinir a senha da sua conta no CidUp/)
    assert.match(content ?? '', /válido por 30 minutos/)
    assert.match(content ?? '', /Se você não solicitou a redefinição, ignore este e-mail/)
  }
  assert.equal(calls.length, 0)
})

test('não envia quando EMAIL_DISABLED está ativado', async () => {
  process.env.EMAIL_DISABLED = 'true'
  process.env.BREVO_API_KEY = FAKE_KEY
  const calls = mockFetch(() => new Response('{}', { status: 201 }))
  const result = await sendComplaintStatusEmail('cidadao@example.test', 'CIDUP-1', 'RESOLVED')
  assert.deepEqual(result, { skipped: true })
  assert.equal(getTestEmails().length, 0)
  assert.equal(calls.length, 0)
})

test('em produção sem BREVO_API_KEY, falha sem tentar SMTP nem fetch', async () => {
  process.env.NODE_ENV = 'production'
  process.env.SMTP_HOST = 'smtp-relay.brevo.com'
  const calls = mockFetch(() => new Response('{}', { status: 201 }))
  await assert.rejects(sendComplaintReceivedEmail('a@example.test', 'CIDUP-1', 'PENDING'), /BREVO_API_KEY/)
  assert.equal(calls.length, 0)
})

test('com BREVO_API_KEY, chama a API do Brevo com método, URL, headers e corpo corretos', async () => {
  process.env.BREVO_API_KEY = FAKE_KEY
  process.env.SMTP_FROM = 'CidUp Avisos <avisos@cidup.example>'
  const calls = mockFetch(() => new Response('{"messageId":"<1@brevo>"}', { status: 201 }))

  const result = await sendComplaintReceivedEmail('cidadao@example.test', 'CIDUP-7', 'PENDING')

  assert.deepEqual(result, { skipped: false })
  assert.equal(calls.length, 1)
  const [call] = calls
  assert.equal(call?.url, 'https://api.brevo.com/v3/smtp/email')
  assert.equal(call?.init.method, 'POST')
  const headers = call?.init.headers as Record<string, string>
  assert.equal(headers['api-key'], FAKE_KEY)
  assert.equal(headers['Content-Type'], 'application/json')
  assert.equal(headers.Accept, 'application/json')
  assert.ok(call?.init.signal instanceof AbortSignal, 'deve usar sinal de timeout')
  const body = JSON.parse(String(call?.init.body))
  assert.deepEqual(body.sender, { name: 'CidUp Avisos', email: 'avisos@cidup.example' })
  assert.deepEqual(body.to, [{ email: 'cidadao@example.test' }])
  assert.equal(body.subject, 'Denúncia CIDUP-7 recebida — CidUp')
  assert.match(body.textContent, /CIDUP-7/)
  assert.match(body.htmlContent, /<strong>CIDUP-7<\/strong>/)
  assert.ok(!String(call?.init.body).includes(FAKE_KEY), 'a chave não pode ir no corpo')
  assert.equal(getTestEmails().length, 0)
})

test('usa remetente padrão e BREVO_API_URL sem barra final duplicada', async () => {
  process.env.BREVO_API_KEY = FAKE_KEY
  process.env.BREVO_API_URL = 'https://brevo.mock.test/v3/'
  const calls = mockFetch(() => new Response(null, { status: 202 }))
  await sendPasswordResetEmail('a@example.test', 'https://cidup.example/r?token=1')
  assert.equal(calls[0]?.url, 'https://brevo.mock.test/v3/smtp/email')
  assert.deepEqual(JSON.parse(String(calls[0]?.init.body)).sender, { name: 'CidUp', email: 'no-reply@cidup.local' })
})

test('resposta não-2xx gera erro com status, resumo limitado e sem a chave', async () => {
  process.env.BREVO_API_KEY = FAKE_KEY
  const longBody = JSON.stringify({ code: 'unauthorized', message: `Key ${FAKE_KEY} not found ${'x'.repeat(2000)}` })
  mockFetch(() => new Response(longBody, { status: 401 }))
  await assert.rejects(sendComplaintStatusEmail('a@example.test', 'CIDUP-1', 'RESOLVED'), (error: Error) => {
    assert.match(error.message, /HTTP 401/)
    assert.ok(!error.message.includes(FAKE_KEY), 'a chave não pode aparecer no erro')
    assert.ok(error.message.length < 400, 'o resumo do erro deve ser limitado')
    return true
  })
})

test('timeout da chamada gera erro', async () => {
  process.env.BREVO_API_KEY = FAKE_KEY
  mockFetch(() => {
    throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
  })
  await assert.rejects(sendPasswordResetEmail('a@example.test', 'https://cidup.example/r'), /tempo limite/)
})

test('falha de rede não expõe a chave', async () => {
  process.env.BREVO_API_KEY = FAKE_KEY
  mockFetch(() => {
    throw new TypeError(`fetch failed for ${FAKE_KEY}`)
  })
  await assert.rejects(sendPasswordResetEmail('a@example.test', 'https://cidup.example/r'), (error: Error) => {
    assert.ok(!error.message.includes(FAKE_KEY))
    return true
  })
})

test('notifySafely registra a falha sem a chave e sem derrubar a rota', async () => {
  process.env.BREVO_API_KEY = FAKE_KEY
  mockFetch(() => new Response(`invalid key ${FAKE_KEY}`, { status: 401 }))
  const logged: string[] = []
  const originalError = console.error
  console.error = (...args: unknown[]) => { logged.push(args.map(String).join(' ')) }
  try {
    await notifySafely(() => sendPasswordResetEmail('a@example.test', 'https://cidup.example/r'))
  } finally {
    console.error = originalError
  }
  assert.equal(logged.length, 1)
  assert.match(logged[0] ?? '', /HTTP 401/)
  assert.ok(!logged.join('\n').includes(FAKE_KEY))
})

test('valores dinâmicos são escapados no HTML', async () => {
  process.env.BREVO_API_KEY = FAKE_KEY
  const calls = mockFetch(() => new Response('{}', { status: 201 }))
  await sendComplaintStatusEmail('a@example.test', 'CIDUP-<1>', '<b>RESOLVED</b>', '<script>alert("x")</script> & <img src=x onerror=1>')
  await sendPasswordResetEmail('a@example.test', 'https://cidup.example/r?token=1&x="><script>')

  const statusHtml = JSON.parse(String(calls[0]?.init.body)).htmlContent as string
  assert.ok(!statusHtml.includes('<script>'))
  assert.ok(!statusHtml.includes('<img'))
  assert.ok(!statusHtml.includes('<b>RESOLVED'))
  assert.match(statusHtml, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; &lt;img/)
  assert.match(statusHtml, /CIDUP-&lt;1&gt;/)

  const resetHtml = JSON.parse(String(calls[1]?.init.body)).htmlContent as string
  assert.match(resetHtml, /href="https:\/\/cidup\.example\/r\?token=1&amp;x=&quot;&gt;&lt;script&gt;"/)
})
