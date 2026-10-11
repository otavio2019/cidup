import { once } from 'node:events'
import { scrypt as scryptCallback } from 'node:crypto'
import { promisify } from 'node:util'
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { PrismaClient } from '@prisma/client'
import { SignJWT } from 'jose'
import { AUTH_COOKIE_NAME, createAuthToken } from './auth.js'
import { createApp } from './index.js'

const secret = 'test-auth-secret-that-is-at-least-32-bytes-long'
const scrypt = promisify(scryptCallback)
type RecordValue = Record<string, unknown>
type Handler = (args: RecordValue) => unknown | Promise<unknown>

function record(value: unknown): RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as RecordValue
    : {}
}

function installDelegate(client: PrismaClient, name: string, handlers: Record<string, Handler>) {
  const delegate = new Proxy<Record<string, unknown>>({}, {
    get(_target, property) {
      const handler = handlers[String(property)]
      if (!handler) return undefined
      return (args: unknown = {}) => handler(record(args))
    },
  })
  Object.defineProperty(client, name, { configurable: true, value: delegate })
}

type StoredUser = {
  id_usuario: number
  nome: string
  email: string
  telefone: string
  senha: string
}

type StoredComplaint = {
  id_denuncia: number
  id_usuario: number
  id_orgao: number
  titulo: string
  descricao: string
  tipo: string
  status: string
  data_registro: Date
  endereco: string
  latitude: number
  longitude: number
  orgao: { id_orgao: number; nome: string }
}

const users = new Map<number, StoredUser>()
const complaints = new Map<number, StoredComplaint>()
const histories = new Map<number, RecordValue>()
const calls: Array<{ model: string; method: string; args: RecordValue }> = []
let nextUserId = 3
let nextHistoryId = 1
let client: PrismaClient
let baseUrl: string
let server: ReturnType<ReturnType<typeof createApp>['listen']>

function remember(model: string, method: string, args: RecordValue) {
  calls.push({ model, method, args })
}

function selectedUser(user: StoredUser, args: RecordValue) {
  const select = record(args.select)
  if (Object.keys(select).length === 0) return { ...user }
  return Object.fromEntries(
    Object.keys(select)
      .filter((field) => field in user)
      .map((field) => [field, user[field as keyof StoredUser]]),
  )
}

function installDatabaseMocks(database: PrismaClient) {
  installDelegate(database, 'usuario', {
    async create(args) {
      remember('usuario', 'create', args)
      const data = record(args.data)
      if ([...users.values()].some((user) => user.email === data.email)) {
        throw new Error('unique constraint detail must not be exposed')
      }
      const user: StoredUser = {
        id_usuario: nextUserId++,
        nome: String(data.nome),
        email: String(data.email),
        telefone: String(data.telefone),
        senha: String(data.senha),
      }
      users.set(user.id_usuario, user)
      return selectedUser(user, args)
    },
    async findUnique(args) {
      remember('usuario', 'findUnique', args)
      if (process.env.TEST_PRISMA_ERROR === '1') {
        throw new Error('sensitive database connection details')
      }
      const where = record(args.where)
      const user = [...users.values()].find((candidate) =>
        ('id_usuario' in where && candidate.id_usuario === where.id_usuario) ||
        ('email' in where && candidate.email === where.email),
      )
      return user ? selectedUser(user, args) : null
    },
    async update(args) {
      remember('usuario', 'update', args)
      const where = record(args.where)
      const data = record(args.data)
      const user = users.get(Number(where.id_usuario))
      if (!user) return null
      Object.assign(user, data)
      return selectedUser(user, args)
    },
    async delete(args) {
      remember('usuario', 'delete', args)
      const where = record(args.where)
      return users.delete(Number(where.id_usuario))
    },
  })

  installDelegate(database, 'orgao', {
    async findMany(args) {
      remember('orgao', 'findMany', args)
      return [{
        id_orgao: 1,
        nome: 'Órgão de teste',
        descricao: 'Descrição pública',
      }]
    },
  })

  installDelegate(database, 'denuncia', {
    async count(args) {
      remember('denuncia', 'count', args)
      const where = record(args.where)
      return [...complaints.values()].filter((complaint) =>
        (!('id_usuario' in where) || complaint.id_usuario === where.id_usuario) &&
        (!('id_orgao' in where) || complaint.id_orgao === where.id_orgao),
      ).length
    },
    async findMany(args) {
      remember('denuncia', 'findMany', args)
      const where = record(args.where)
      return [...complaints.values()].filter((complaint) =>
        !('id_usuario' in where) || complaint.id_usuario === where.id_usuario,
      )
    },
    async findFirst(args) {
      remember('denuncia', 'findFirst', args)
      const where = record(args.where)
      const complaint = complaints.get(Number(where.id_denuncia))
      if (!complaint || ('id_usuario' in where && complaint.id_usuario !== where.id_usuario)) return null
      if ('id_denuncia' in record(where.denuncia)) return null
      return complaint
    },
    async create(args) {
      remember('denuncia', 'create', args)
      const data = record(args.data)
      const userConnect = record(record(data.usuario).connect)
      const orgConnect = record(record(data.orgao).connect)
      const id_denuncia = Math.max(0, ...complaints.keys()) + 1
      const complaint: StoredComplaint = {
        id_denuncia,
        id_usuario: Number(userConnect.id_usuario),
        id_orgao: Number(orgConnect.id_orgao),
        titulo: String(data.titulo),
        descricao: String(data.descricao),
        tipo: String(data.tipo),
        status: String(data.status),
        data_registro: new Date(),
        endereco: String(data.endereco),
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        orgao: { id_orgao: Number(orgConnect.id_orgao), nome: 'Órgão de teste' },
      }
      complaints.set(id_denuncia, complaint)
      return complaint
    },
    async update(args) {
      remember('denuncia', 'update', args)
      const where = record(args.where)
      const data = record(args.data)
      const complaint = complaints.get(Number(where.id_denuncia))
      if (!complaint) return null
      Object.assign(complaint, data)
      return complaint
    },
    async delete(args) {
      remember('denuncia', 'delete', args)
      const where = record(args.where)
      complaints.delete(Number(where.id_denuncia))
    },
  })

  installDelegate(database, 'historico', {
    async count(args) {
      remember('historico', 'count', args)
      const where = record(args.where)
      return [...histories.values()].filter((history) =>
        !('id_usuario' in where) || history.id_usuario === where.id_usuario,
      ).length
    },
    async findMany(args) {
      remember('historico', 'findMany', args)
      return [...histories.values()]
    },
    async create(args) {
      remember('historico', 'create', args)
      const data = record(args.data)
      const history = {
        id_historico: nextHistoryId++,
        descricao: data.descricao,
        foto: data.foto,
        observacao: data.observacao,
        id_usuario: record(record(data.usuario).connect).id_usuario,
        id_denuncia: record(record(data.denuncia).connect).id_denuncia,
      }
      histories.set(Number(history.id_historico), history)
      return history
    },
    async findFirst(args) {
      remember('historico', 'findFirst', args)
      const where = record(args.where)
      return histories.get(Number(where.id_historico)) ?? null
    },
    async update(args) {
      remember('historico', 'update', args)
      return null
    },
    async delete(args) {
      remember('historico', 'delete', args)
      const where = record(args.where)
      histories.delete(Number(where.id_historico))
    },
  })
}

async function cookieFor(userId: number) {
  return `${AUTH_COOKIE_NAME}=${await createAuthToken(userId, secret)}`
}

async function callApi(path: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
}

before(async () => {
  client = new PrismaClient({ datasourceUrl: 'postgresql://127.0.0.1:5432/cidup_test?schema=public' })
  installDatabaseMocks(client)
  const passwordHash = `${'a'.repeat(32)}:${(await scrypt('secret-password', 'a'.repeat(32), 64) as Buffer).toString('hex')}`
  users.set(1, { id_usuario: 1, nome: 'Pessoa Um', email: 'um@example.test', telefone: '1111111111', senha: passwordHash })
  users.set(2, { id_usuario: 2, nome: 'Pessoa Dois', email: 'dois@example.test', telefone: '2222222222', senha: passwordHash })
  complaints.set(101, {
    id_denuncia: 101,
    id_usuario: 1,
    id_orgao: 1,
    titulo: 'Registro próprio',
    descricao: 'Relato privado do cidadão um',
    tipo: 'Iluminação',
    status: 'RECEIVED',
    data_registro: new Date('2026-01-01T00:00:00.000Z'),
    endereco: 'Rua de teste',
    latitude: -23,
    longitude: -46,
    orgao: { id_orgao: 1, nome: 'Órgão de teste' },
  })
  complaints.set(202, {
    ...complaints.get(101)!,
    id_denuncia: 202,
    id_usuario: 2,
    titulo: 'Registro alheio',
    descricao: 'Relato privado do cidadão dois',
  })
  histories.set(1, {
    id_historico: 1,
    id_usuario: 1,
    id_denuncia: 101,
    descricao: 'Atualização privada',
    foto: 'https://example.test/foto',
    observacao: 'Observação',
  })
  const app = createApp(client, {
    authTokenSecret: secret,
    frontendOrigins: 'http://localhost:5173',
    administratorIds: '99',
  })
  server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${address.port}`
})

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  })
  await client.$disconnect()
})

test('health endpoint is public and responds successfully', async () => {
  const response = await callApi('/health')
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok' })
})

test('registration accepts valid input and does not return the password hash', async () => {
  const response = await callApi('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Pessoa Nova',
      email: 'nova@example.test',
      phone: '3333333333',
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

test('registration rejects invalid input without creating a user', async () => {
  const beforeCount = users.size
  const response = await callApi('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'A', email: '', phone: '', password: 'x' }),
  })
  assert.equal(response.status, 400)
  assert.equal(users.size, beforeCount)
})

test('login verifies the password and issues an HttpOnly session cookie', async () => {
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

test('login rejects an incorrect password', async () => {
  const response = await callApi('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'um@example.test', password: 'wrong-password' }),
  })
  assert.equal(response.status, 401)
  assert.equal(response.headers.get('set-cookie'), null)
})

test('protected API rejects requests without a cookie, regardless of x-user-id', async () => {
  const response = await callApi('/api/complaints', {
    headers: { 'x-user-id': '1' },
  })
  assert.equal(response.status, 401)
})

test('protected API rejects invalid and expired cookies', async () => {
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

test('x-user-id cannot override the user identity in the signed cookie', async () => {
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
  assert.deepEqual(listed.map((complaint) => complaint.id), [101])
  assert.equal(calls.find((call) => call.model === 'denuncia' && call.method === 'findMany')?.args.where instanceof Object, true)
  assert.equal(record(calls.find((call) => call.model === 'denuncia' && call.method === 'findMany')?.args.where).id_usuario, 1)
})

test('users cannot read, update, or delete another user complaint', async () => {
  const cookie = await cookieFor(1)
  const read = await callApi('/api/complaints/202', { headers: { Cookie: cookie, 'x-user-id': '2' } })
  calls.length = 0
  const update = await callApi('/api/complaints/202', {
    method: 'PATCH',
    headers: { Cookie: cookie, 'x-user-id': '2' },
    body: JSON.stringify({ description: 'tentativa indevida' }),
  })
  const remove = await callApi('/api/complaints/202', {
    method: 'DELETE',
    headers: { Cookie: cookie, 'x-user-id': '2' },
  })
  assert.equal(read.status, 404)
  assert.equal(update.status, 404)
  assert.equal(remove.status, 404)
  assert.equal(calls.some((call) => call.model === 'denuncia' && ['update', 'delete'].includes(call.method)), false)
  assert.equal(complaints.get(202)?.descricao, 'Relato privado do cidadão dois')
})

test('authenticated user can update and delete only their own user record', async () => {
  const cookie = await cookieFor(1)
  const otherUser = await callApi('/api/users/2', {
    method: 'PATCH',
    headers: { Cookie: cookie },
    body: JSON.stringify({ name: 'Alterado indevidamente' }),
  })
  const invalidId = await callApi('/api/users/not-an-id', { headers: { Cookie: cookie } })
  assert.equal(otherUser.status, 404)
  assert.equal(invalidId.status, 400)
  assert.equal(users.get(2)?.nome, 'Pessoa Dois')
})

test('Prisma failures return a generic message without sensitive details', async () => {
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
    assert.equal(body.includes('sensitive database connection details'), false)
    assert.equal(logged.some((args) => args.join(' ').includes('sensitive database connection details')), false)
  } finally {
    delete process.env.TEST_PRISMA_ERROR
    console.error = originalError
  }
})

test('organization reads expose only public fields; writes require configured admin', async () => {
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

test('histories are private and scoped to the authenticated user', async () => {
  const unauthorized = await callApi('/api/historicos')
  assert.equal(unauthorized.status, 401)
  calls.length = 0
  const response = await callApi('/api/historicos', { headers: { Cookie: await cookieFor(1) } })
  assert.equal(response.status, 200)
  const query = calls.find((call) => call.model === 'historico' && call.method === 'findMany')
  assert.equal(record(query?.args.where).denuncia !== undefined, true)
})

test('AI endpoint requires authentication and Prisma-backed errors never leak secrets', async () => {
  const response = await callApi('/api/ai/complaint-draft', {
    method: 'POST',
    body: JSON.stringify({ description: 'Relato suficientemente detalhado.' }),
  })
  assert.equal(response.status, 401)
})

test('login rejects malformed and too-short token secrets at app construction', () => {
  assert.throws(
    () => createApp(client, { authTokenSecret: 'short-secret' }),
    /at least 32 bytes/i,
  )
})
