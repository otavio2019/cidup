import { once } from 'node:events'
import { scrypt as scryptCallback } from 'node:crypto'
import { promisify } from 'node:util'
import { after, before } from 'node:test'
import type { AddressInfo } from 'node:net'
import { PrismaClient } from '@prisma/client'
import { AUTH_COOKIE_NAME, createAuthToken } from '../../src/auth.js'
import { createApp } from '../../src/app.js'

// ===== APOIO COMPARTILHADO DOS TESTES DA API =====
// Banco simulado em memória (sem PostgreSQL real), dados iniciais e servidor HTTP de teste.
// Cada arquivo *.test.ts roda em um processo separado, então cada um começa com os dados abaixo.
// Uso: chame setupTestServer() no topo do arquivo de teste e use callApi/cookieFor nas chamadas.

export const secret = 'test-auth-secret-that-is-at-least-32-bytes-long'
export const scrypt = promisify(scryptCallback)
export type RecordValue = Record<string, unknown>
export type Handler = (args: RecordValue) => unknown | Promise<unknown>

// Converte valores desconhecidos em objetos seguros para consultar nos mocks.
export function record(value: unknown): RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as RecordValue
    : {}
}

// Substitui um delegate do Prisma por handlers controlados pelo teste.
export function installDelegate(client: PrismaClient, name: string, handlers: Record<string, Handler>) {
  const delegate = new Proxy<Record<string, unknown>>({}, {
    get(_target, property) {
      const handler = handlers[String(property)]
      if (!handler) return undefined
      return (args: unknown = {}) => handler(record(args))
    },
  })
  Object.defineProperty(client, name, { configurable: true, value: delegate })
}

export type StoredUser = {
  id_usuario: number
  nome: string
  email: string
  telefone: string
  cpf: string
  senha: string
  must_change_password: boolean
}

export type StoredRecoveryRequest = {
  id: number
  id_usuario: number
  status: string
  requested_at: Date
  resolved_at: Date | null
  id_responsavel: number | null
}

export type StoredResetToken = {
  id: number
  token_hash: string
  id_usuario: number
  expires_at: Date
  used_at: Date | null
}

export type StoredResponsible = {
  id_responsavel: number
  nome: string
  email: string
  telefone: string
  senha: string
  id_orgao: number
  orgao: { id_orgao: number; nome: string }
}

export type StoredComplaint = {
  id_denuncia: number
  id_usuario: number
  id_orgao: number
  prioridade?: string | null
  titulo: string
  descricao: string
  tipo: string
  status: string
  data_registro: Date
  endereco: string
  latitude: number
  longitude: number
  categorias: string[]
  orgao: { id_orgao: number; nome: string }
}

export const users = new Map<number, StoredUser>()
export const resetTokens = new Map<number, StoredResetToken>()
export const recoveryRequests = new Map<number, StoredRecoveryRequest>()
export const responsibleAccounts = new Map<number, StoredResponsible>()
export const complaints = new Map<number, StoredComplaint>()
export const histories = new Map<number, RecordValue>()
export const calls: Array<{ model: string; method: string; args: RecordValue }> = []
export let nextUserId = 3
export let nextHistoryId = 1
export let nextResetTokenId = 1
export let nextRecoveryRequestId = 1
export let client: PrismaClient
export let baseUrl: string
export let server: ReturnType<ReturnType<typeof createApp>['listen']>

// Registra as consultas simuladas para permitir verificar filtros e permissões.
export function remember(model: string, method: string, args: RecordValue) {
  calls.push({ model, method, args })
}

export const routingOrganizations = [
  { id_orgao: 1, nome: 'Secretaria de Infraestrutura', descricao: 'Vias e calçadas' },
  { id_orgao: 2, nome: 'Secretaria de Iluminação Pública', descricao: 'Iluminação urbana' },
  { id_orgao: 3, nome: 'Secretaria de Limpeza Urbana', descricao: 'Limpeza e descarte' },
  { id_orgao: 4, nome: 'Secretaria de Meio Ambiente', descricao: 'Árvores e áreas verdes' },
  { id_orgao: 5, nome: 'Secretaria de Saneamento', descricao: 'Drenagem e esgoto' },
]

// Simula a projeção select do Prisma sobre o usuário armazenado no teste.
export function selectedUser(user: StoredUser, args: RecordValue) {
  const select = record(args.select)
  if (Object.keys(select).length === 0) return { ...user }
  return Object.fromEntries(
    Object.keys(select)
      .filter((field) => field in user)
      .map((field) => [field, user[field as keyof StoredUser]]),
  )
}

// Instala delegates em memória para testar a API sem depender do banco real.
export function installDatabaseMocks(database: PrismaClient) {
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
        cpf: String(data.cpf),
        senha: String(data.senha),
        must_change_password: Boolean(data.must_change_password ?? false),
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
        ('email' in where && candidate.email === where.email) ||
        ('cpf' in where && candidate.cpf === where.cpf),
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

  installDelegate(database, 'password_reset_token', {
    async deleteMany(args) {
      remember('password_reset_token', 'deleteMany', args)
      const where = record(args.where)
      for (const [id, token] of resetTokens) {
        if (!('id_usuario' in where) || token.id_usuario === where.id_usuario) resetTokens.delete(id)
      }
      return { count: 1 }
    },
    async create(args) {
      remember('password_reset_token', 'create', args)
      const data = record(args.data)
      const token: StoredResetToken = {
        id: nextResetTokenId++,
        token_hash: String(data.token_hash),
        id_usuario: Number(data.id_usuario),
        expires_at: new Date(String(data.expires_at)),
        used_at: null,
      }
      resetTokens.set(token.id, token)
      return token
    },
    async findUnique(args) {
      remember('password_reset_token', 'findUnique', args)
      const where = record(args.where)
      return [...resetTokens.values()].find((token) => token.token_hash === where.token_hash) ?? null
    },
    async updateMany(args) {
      remember('password_reset_token', 'updateMany', args)
      const where = record(args.where)
      const token = resetTokens.get(Number(where.id))
      const expiry = record(where.expires_at)
      if (!token || token.used_at || token.expires_at <= new Date(String(expiry.gt))) return { count: 0 }
      token.used_at = new Date(String(record(args.data).used_at))
      return { count: 1 }
    },
  })
  installDelegate(database, 'password_recovery_request', {
    async upsert(args) {
      remember('password_recovery_request', 'upsert', args)
      const where = record(args.where)
      const existing = [...recoveryRequests.values()].find((item) => item.id_usuario === where.id_usuario)
      if (existing) {
        Object.assign(existing, record(args.update))
        return existing
      }
      const data = record(args.create)
      const created: StoredRecoveryRequest = {
        id: nextRecoveryRequestId++,
        id_usuario: Number(data.id_usuario),
        status: 'PENDING',
        requested_at: new Date(),
        resolved_at: null,
        id_responsavel: null,
      }
      recoveryRequests.set(created.id, created)
      return created
    },
    async findMany(args) {
      remember('password_recovery_request', 'findMany', args)
      return [...recoveryRequests.values()]
        .filter((item) => item.status === record(args.where).status)
        .map((item) => {
          const user = users.get(item.id_usuario)
          return {
            id: item.id,
            requested_at: item.requested_at,
            usuario: { nome: user?.nome, email: user?.email, telefone: user?.telefone, cpf: user?.cpf },
          }
        })
    },
    async findUnique(args) {
      remember('password_recovery_request', 'findUnique', args)
      const id = Number(record(args.where).id)
      const item = recoveryRequests.get(id)
      return item ? { id_usuario: item.id_usuario } : null
    },
    async updateMany(args) {
      remember('password_recovery_request', 'updateMany', args)
      const where = record(args.where)
      const item = recoveryRequests.get(Number(where.id))
      if (!item || item.status !== where.status) return { count: 0 }
      Object.assign(item, record(args.data))
      return { count: 1 }
    },
  })
  Object.defineProperty(database, '$transaction', {
    configurable: true,
    value: (callback: (transaction: PrismaClient) => Promise<unknown>) => callback(database),
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
      const excludedId = record(where.id_denuncia).not
      const categoryMatches = record(where.categorias).hasSome
      const latitudeFilter = record(where.latitude)
      const longitudeFilter = record(where.longitude)
      return [...complaints.values()].filter((complaint) =>
        (!('id_usuario' in where) || complaint.id_usuario === where.id_usuario) &&
        (excludedId === undefined || complaint.id_denuncia !== Number(excludedId)) &&
        (!Array.isArray(categoryMatches) || categoryMatches.some((category) => complaint.categorias.includes(String(category)))) &&
        (latitudeFilter.gte === undefined || complaint.latitude >= Number(latitudeFilter.gte)) &&
        (latitudeFilter.lte === undefined || complaint.latitude <= Number(latitudeFilter.lte)) &&
        (longitudeFilter.gte === undefined || complaint.longitude >= Number(longitudeFilter.gte)) &&
        (longitudeFilter.lte === undefined || complaint.longitude <= Number(longitudeFilter.lte)),
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
      const routedOrganization = routingOrganizations.find((organization) => organization.id_orgao === Number(orgConnect.id_orgao))
      if (!routedOrganization) throw new Error('Órgão de teste não encontrado.')
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
        categorias: Array.isArray(data.categorias) ? data.categorias.map(String) : [String(data.tipo)],
        prioridade: typeof data.prioridade === 'string' ? data.prioridade : null,
        orgao: routedOrganization,
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
export async function cookieFor(userId: number) {
  return `${AUTH_COOKIE_NAME}=${await createAuthToken(userId, secret)}`
}

export async function responsibleCookieFor(responsibleId: number) {
  return `${AUTH_COOKIE_NAME}=${await createAuthToken(responsibleId, secret, 'RESPONSIBLE')}`
}

// Envia uma requisição HTTP para a instância da API iniciada pelo conjunto de testes.
export async function callApi(path: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
}


// Prepara banco simulado, usuários e servidor HTTP antes dos casos de teste,
// e encerra tudo ao final. Chame uma vez no topo de cada arquivo de teste.
export function setupTestServer() {
  before(async () => {
    client = new PrismaClient({ datasourceUrl: 'postgresql://127.0.0.1:5432/cidup_test?schema=public' })
    installDatabaseMocks(client)
    const passwordHash = `${'a'.repeat(32)}:${(await scrypt('secret-password', 'a'.repeat(32), 64) as Buffer).toString('hex')}`
    users.set(1, { id_usuario: 1, nome: 'Pessoa Um', email: 'um@example.test', telefone: '1111111111', cpf: '52998224725', senha: passwordHash, must_change_password: false })
    users.set(2, { id_usuario: 2, nome: 'Pessoa Dois', email: 'dois@example.test', telefone: '2222222222', cpf: '11144477735', senha: passwordHash, must_change_password: false })
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
      categorias: ['Iluminação'],
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
      production: false,
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
}
