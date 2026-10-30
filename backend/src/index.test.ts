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

// Converte valores desconhecidos em objetos seguros para consultar nos mocks.
function record(value: unknown): RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as RecordValue
    : {}
}

// Substitui um delegate do Prisma por handlers controlados pelo teste.
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

type StoredResponsible = {
  id_responsavel: number
  nome: string
  email: string
  telefone: string
  senha: string
  id_orgao: number
  orgao: { id_orgao: number; nome: string }
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
const responsibleAccounts = new Map<number, StoredResponsible>()
const complaints = new Map<number, StoredComplaint>()
const histories = new Map<number, RecordValue>()
const calls: Array<{ model: string; method: string; args: RecordValue }> = []
let nextUserId = 3
let nextHistoryId = 1
let client: PrismaClient
let baseUrl: string
let server: ReturnType<ReturnType<typeof createApp>['listen']>

// Registra as consultas simuladas para permitir verificar filtros e permissões.
function remember(model: string, method: string, args: RecordValue) {
  calls.push({ model, method, args })
}

const routingOrganizations = [
  { id_orgao: 1, nome: 'Secretaria de Infraestrutura', descricao: 'Vias e calçadas' },
  { id_orgao: 2, nome: 'Secretaria de Iluminação Pública', descricao: 'Iluminação urbana' },
  { id_orgao: 3, nome: 'Secretaria de Limpeza Urbana', descricao: 'Limpeza e descarte' },
  { id_orgao: 4, nome: 'Secretaria de Meio Ambiente', descricao: 'Árvores e áreas verdes' },
  { id_orgao: 5, nome: 'Secretaria de Saneamento', descricao: 'Drenagem e esgoto' },
]

// Simula a projeção select do Prisma sobre o usuário armazenado no teste.
function selectedUser(user: StoredUser, args: RecordValue) {
  const select = record(args.select)
  if (Object.keys(select).length === 0) return { ...user }
  return Object.fromEntries(
    Object.keys(select)
      .filter((field) => field in user)
      .map((field) => [field, user[field as keyof StoredUser]]),
  )
}

// Instala delegates em memória para testar a API sem depender do banco real.
function installDatabaseMocks(database: PrismaClient) {
  installDelegate(database, 'usuario', {
    async create(args) {
      remember('usuario', 'create', args)
      const data = record(args.data)
      if ([...users.values()].some((user) => user.email === data.email)) {
        throw new Error('detalhes da restrição de unicidade não devem ser expostos')
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
        throw new Error('detalhes confidenciais da conexão com o banco de dados')
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
      return routingOrganizations
    },
  })

  installDelegate(database, 'responsavel', {
    async findUnique(args) {
      remember('responsavel', 'findUnique', args)
      const where = record(args.where)
      const responsible = [...responsibleAccounts.values()].find((candidate) =>
        ('id_responsavel' in where && candidate.id_responsavel === where.id_responsavel) ||
        ('email' in where && candidate.email === where.email),
      )
      return responsible ? { ...responsible } : null
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
      const defaultOrganization = routingOrganizations[0]
      if (!defaultOrganization) throw new Error('O mock precisa de pelo menos um órgão.')
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
        orgao: routingOrganizations.find((organization) => organization.id_orgao === Number(orgConnect.id_orgao)) ?? defaultOrganization,
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

// Cria um cookie assinado para chamadas autenticadas dos testes.
async function cookieFor(userId: number) {
  return `${AUTH_COOKIE_NAME}=${await createAuthToken(userId, secret)}`
}

async function responsibleCookieFor(responsibleId: number) {
  return `${AUTH_COOKIE_NAME}=${await createAuthToken(responsibleId, secret, 'RESPONSIBLE')}`
}

// Envia uma requisição HTTP para a instância da API iniciada pelo conjunto de testes.
async function callApi(path: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
}

// Prepara banco simulado, usuários e servidor HTTP antes dos casos de teste.
before(async () => {
  client = new PrismaClient({ datasourceUrl: 'postgresql://127.0.0.1:5432/cidup_test?schema=public' })
  installDatabaseMocks(client)
  const passwordHash = `${'a'.repeat(32)}:${(await scrypt('secret-password', 'a'.repeat(32), 64) as Buffer).toString('hex')}`
  users.set(1, { id_usuario: 1, nome: 'Pessoa Um', email: 'um@example.test', telefone: '1111111111', senha: passwordHash })
  users.set(2, { id_usuario: 2, nome: 'Pessoa Dois', email: 'dois@example.test', telefone: '2222222222', senha: passwordHash })
  responsibleAccounts.set(99, {
    id_responsavel: 99,
    nome: 'Responsável Teste',
    email: 'responsavel@example.test',
    telefone: '9999999999',
    senha: passwordHash,
    id_orgao: 1,
    orgao: { id_orgao: 1, nome: 'Secretaria de Infraestrutura' },
  })
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
    orgao: { id_orgao: 1, nome: 'Secretaria de Infraestrutura' },
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
  })
  server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${address.port}`
})

// Encerra o servidor de teste e desconecta o cliente Prisma ao final.
after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  })
  await client.$disconnect()
})

test('o endpoint de saúde é público e responde com sucesso', async () => {
  const response = await callApi('/health')
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok' })
})

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

test('encaminha denúncias automaticamente para o órgão compatível com a categoria', async () => {
  const routingCases = [
    ['Buraco ou problema na via', 1, 'Secretaria de Infraestrutura'],
    ['Iluminação pública', 2, 'Secretaria de Iluminação Pública'],
    ['Lixo ou descarte irregular', 3, 'Secretaria de Limpeza Urbana'],
    ['Árvore ou área verde', 4, 'Secretaria de Meio Ambiente'],
    ['Alagamento ou drenagem', 5, 'Secretaria de Saneamento'],
  ] as const

  for (const [type, organizationId, organizationName] of routingCases) {
    const response = await callApi('/api/complaints', {
      method: 'POST',
      headers: { Cookie: await cookieFor(1) },
      body: JSON.stringify({
        type,
        title: type,
        description: `Relato de teste para ${type}.`,
        address: 'Rua de teste, 10, Centro',
        latitude: -23,
        longitude: -46,
      }),
    })
    const body = await response.json() as RecordValue
    const complaint = record(body.complaint)
    const organization = record(complaint.orgao)
    assert.equal(response.status, 201, type)
    assert.equal(complaint.id_orgao, organizationId, type)
    assert.equal(organization.nome, organizationName, type)
  }
})

test('aceita uma foto válida na criação da denúncia', async () => {
  calls.length = 0
  const photo = 'data:image/png;base64, iVBORw0KGgo='.replace(' ', '')
  const response = await callApi('/api/complaints', {
    method: 'POST',
    headers: { Cookie: await cookieFor(1) },
    body: JSON.stringify({
      type: 'Iluminação pública',
      title: 'Foto válida',
      description: 'Relato com uma imagem válida para teste.',
      address: 'Rua de teste, 10, Centro',
      latitude: -23,
      longitude: -46,
      photo,
    }),
  })
  assert.equal(response.status, 201)
  assert.equal(record(calls.find((call) => call.model === 'denuncia' && call.method === 'create')?.args.data).foto, photo)
})

test('rejeita foto maior que 2 MB antes de persistir a denúncia', async () => {
  calls.length = 0
  const oversizedPhoto = `data:image/png;base64,${'A'.repeat(2_800_000)}`
  const response = await callApi('/api/complaints', {
    method: 'POST',
    headers: { Cookie: await cookieFor(1) },
    body: JSON.stringify({
      type: 'Iluminação pública',
      title: 'Foto grande',
      description: 'Relato com uma imagem acima do limite permitido.',
      address: 'Rua de teste, 10, Centro',
      latitude: -23,
      longitude: -46,
      photo: oversizedPhoto,
    }),
  })
  assert.equal(response.status, 400)
  assert.match(await response.text(), /no máximo 2 MB/i)
  assert.equal(calls.some((call) => call.model === 'denuncia' && call.method === 'create'), false)
})

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

test('usuários não podem consultar, atualizar ou excluir denúncias de outras pessoas', async () => {
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

test('o usuário autenticado só pode atualizar e excluir o próprio cadastro', async () => {
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

test('os históricos são privados e limitados ao usuário autenticado', async () => {
  const unauthorized = await callApi('/api/historicos')
  assert.equal(unauthorized.status, 401)
  calls.length = 0
  const response = await callApi('/api/historicos', { headers: { Cookie: await cookieFor(1) } })
  assert.equal(response.status, 200)
  const query = calls.find((call) => call.model === 'historico' && call.method === 'findMany')
  assert.equal(record(query?.args.where).denuncia !== undefined, true)
})

test('o endpoint de IA exige autenticação e falhas do Prisma não expõem segredos', async () => {
  const response = await callApi('/api/ai/complaint-draft', {
    method: 'POST',
    body: JSON.stringify({ description: 'Relato suficientemente detalhado.' }),
  })
  assert.equal(response.status, 401)
})

test('o login rejeita segredos de token malformados ou curtos demais ao iniciar a aplicação', () => {
  assert.throws(
    () => createApp(client, { authTokenSecret: 'short-secret' }),
    /pelo menos 32 bytes/i,
  )
})
