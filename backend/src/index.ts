import 'dotenv/config'
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import { Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'
import { AUTH_COOKIE_NAME, AUTH_TOKEN_TTL_SECONDS, createAuthToken, readAuthUserId, requireAuthentication } from './auth.js'
import { prisma } from './lib/prisma.js'

const scrypt = promisify(scryptCallback)
const authenticationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Aguarde antes de tentar novamente.' },
})

function readPositiveInt(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function handlePrismaError(error: unknown, response: express.Response, operation: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      response.status(404).json({ error: 'Registro não encontrado.' })
      return
    }
    if (error.code === 'P2002' || error.code === 'P2003') {
      response.status(409).json({ error: 'O registro conflita com dados existentes ou relacionamentos.' })
      return
    }
  }

  console.error(`Database operation failed: ${operation}`)
  response.status(500).json({ error: 'Não foi possível concluir a operação.' })
}

function isAdministrator(userId: number, administratorIds: ReadonlySet<number>) {
  return administratorIds.has(userId)
}

function complaintResponse(complaint: {
  id_denuncia: number
  titulo: string
  descricao: string
  tipo: string
  status: string
  data_registro: Date
  endereco: string
  latitude: number
  longitude: number
  id_usuario: number
  id_orgao: number
  orgao?: { id_orgao: number; nome: string } | null
  historico?: Array<{ id_historico: number; descricao: string; observacao: string }>
}) {
  return {
    ...complaint,
    id: complaint.id_denuncia,
    protocol: `CIDUP-${complaint.id_denuncia}`,
    title: complaint.titulo,
    description: complaint.descricao,
    address: complaint.endereco,
    neighborhood: '',
    number: '',
    complement: '',
    createdAt: complaint.data_registro.toISOString(),
    registeredAt: complaint.data_registro.toISOString(),
    type: { name: complaint.tipo },
  }
}

export function createApp(
  database: PrismaClient = prisma,
  options: {
    authTokenSecret?: string
    frontendOrigins?: string
    administratorIds?: string
    production?: boolean
  } = {},
) {
const secret = options.authTokenSecret ?? process.env.AUTH_TOKEN_SECRET
if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
  throw new Error('Set AUTH_TOKEN_SECRET to a value of at least 32 bytes.')
}
const frontendOrigins = (options.frontendOrigins ?? process.env.FRONTEND_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const allowedOrigins = new Set(frontendOrigins)
const administratorIds = new Set(
  (options.administratorIds ?? process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map((value) => readPositiveInt(value))
    .filter((value): value is number => value !== null),
)
const production = options.production ?? process.env.NODE_ENV === 'production'
if (production && frontendOrigins.some((origin) => new URL(origin).protocol !== 'https:')) {
  throw new Error('FRONTEND_ORIGINS must use HTTPS in production.')
}
const authenticate = requireAuthentication(secret)
const app = express()

app.disable('x-powered-by')
app.set('trust proxy', production ? 1 : false)
if (production) {
  app.use((request, response, next) => {
    if (!request.secure) {
      response.status(400).json({ error: 'A API exige HTTPS.' })
      return
    }
    next()
  })
}
app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.has(origin) ? origin ?? false : false)
  },
  credentials: true,
}))
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())
app.use('/api', (_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store')
  next()
})
app.use('/api', (request, response, next) => {
  const origin = request.get('origin')
  if (origin && !allowedOrigins.has(origin)) {
    response.status(403).json({ error: 'Origem não permitida.' })
    return
  }
  next()
})
function requireAdministrator(request: express.Request, response: express.Response, next: express.NextFunction) {
  const userId = readAuthUserId(request)
  if (!userId) {
    response.status(401).json({ error: 'Autenticação necessária.' })
    return
  }
  if (!isAdministrator(userId, administratorIds)) {
    response.status(403).json({ error: 'Operação restrita a responsáveis autorizados.' })
    return
  }
  next()
}
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer
  return `${salt}:${derivedKey.toString('hex')}`
}

async function verifyPassword(password: string, storedHash: string) {
  const [salt, key] = storedHash.split(':')
  if (!salt || !/^[a-f0-9]{32}$/i.test(salt) || !key || !/^[a-f0-9]{128}$/i.test(key)) return false

  const derivedKey = (await scrypt(password, salt, 64)) as Buffer
  const storedKey = Buffer.from(key, 'hex')
  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey)
}

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' })
})

async function registerUser(request: express.Request, response: express.Response) {
  const body = isRecord(request.body) ? request.body : {}
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const password = body.password

  if (name.length < 2 || name.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255 ||
      !phone || phone.length > 20 || typeof password !== 'string' || password.length < 6 || password.length > 1024) {
    response.status(400).json({ error: 'Informe nome, e-mail, telefone e uma senha com pelo menos 6 caracteres.' })
    return
  }

  try {
    const user = await database.usuario.create({
      data: { nome: name, email, telefone: phone, senha: await hashPassword(password) },
      select: { id_usuario: true, nome: true, email: true, telefone: true },
    })
    response.status(201).json({ user })
  } catch (error) {
    handlePrismaError(error, response, 'register-user')
  }
}

app.post(['/api/auth/register', '/api/users', '/api/usuarios'], authenticationRateLimit, registerUser)

app.post('/api/auth/login', authenticationRateLimit, async (request, response) => {
  const body = isRecord(request.body) ? request.body : {}
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = body.password
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length > 1024) {
    response.status(400).json({ error: 'Informe e-mail e senha.' })
    return
  }

  try {
    const user = await database.usuario.findUnique({ where: { email } })
    if (!user || !(await verifyPassword(password, user.senha))) {
      response.status(401).json({ error: 'E-mail ou senha inválidos.' })
      return
    }
    const token = await createAuthToken(user.id_usuario, secret)
    response.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: production,
      sameSite: 'strict',
      maxAge: AUTH_TOKEN_TTL_SECONDS * 1000,
      path: '/',
    })
    response.json({
      user: {
        id: user.id_usuario,
        name: user.nome,
        email: user.email,
        phone: user.telefone,
        role: isAdministrator(user.id_usuario, administratorIds) ? 'RESPONSIBLE' : 'CITIZEN',
      },
    })
  } catch (error) {
    handlePrismaError(error, response, 'login')
  }
})

app.post('/api/auth/logout', (_request, response) => {
  response.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: production,
    sameSite: 'strict',
    path: '/',
  })
  response.status(204).send()
})

app.get('/api/auth/session', authenticate, async (request, response) => {
  const id_usuario = readAuthUserId(request)
  if (!id_usuario) {
    response.status(401).json({ error: 'Autenticação necessária.' })
    return
  }
  try {
    const user = await database.usuario.findUnique({
      where: { id_usuario },
      select: { id_usuario: true, nome: true, email: true, telefone: true },
    })
    if (!user) {
      response.status(401).json({ error: 'Credencial inválida ou expirada.' })
      return
    }
    response.json({
      user: {
        id: user.id_usuario,
        name: user.nome,
        email: user.email,
        phone: user.telefone,
        role: isAdministrator(user.id_usuario, administratorIds) ? 'RESPONSIBLE' : 'CITIZEN',
      },
    })
  } catch (error) {
    handlePrismaError(error, response, 'read-auth-session')
  }
})

app.get(['/api/users', '/api/usuarios'], authenticate, async (request, response) => {
  const id_usuario = readAuthUserId(request)
  if (!id_usuario) {
    response.status(401).json({ error: 'Autenticação necessária.' })
    return
  }
  try {
    const user = await database.usuario.findUnique({
      where: { id_usuario },
      select: { id_usuario: true, nome: true, email: true, telefone: true },
    })
    if (!user) {
      response.status(404).json({ error: 'Usuário não encontrado.' })
      return
    }
    response.json({ users: [user] })
  } catch (error) {
    handlePrismaError(error, response, 'list-own-user')
  }
})

app.get(['/api/users/:id', '/api/usuarios/:id'], authenticate, async (request, response) => {
  const authenticatedUserId = readAuthUserId(request)
  const requestedUserId = readPositiveInt(request.params.id)
  if (!authenticatedUserId) {
    response.status(401).json({ error: 'Autenticação necessária.' })
    return
  }
  if (!requestedUserId) {
    response.status(400).json({ error: 'Identificação do usuário inválida.' })
    return
  }
  if (requestedUserId !== authenticatedUserId) {
    response.status(404).json({ error: 'Usuário não encontrado.' })
    return
  }

  try {
    const user = await database.usuario.findUnique({
      where: { id_usuario: authenticatedUserId },
      select: { id_usuario: true, nome: true, email: true, telefone: true },
    })
    if (!user) {
      response.status(404).json({ error: 'Usuário não encontrado.' })
      return
    }
    response.json({ user })
  } catch (error) {
    handlePrismaError(error, response, 'read-own-user')
  }
})

app.patch(['/api/users/:id', '/api/usuarios/:id'], authenticate, async (request, response) => {
  const authenticatedUserId = readAuthUserId(request)
  const requestedUserId = readPositiveInt(request.params.id)
  const body = isRecord(request.body) ? request.body : {}
  if (!authenticatedUserId) {
    response.status(401).json({ error: 'Autenticação necessária.' })
    return
  }
  if (!requestedUserId) {
    response.status(400).json({ error: 'Identificação do usuário inválida.' })
    return
  }
  if (requestedUserId !== authenticatedUserId) {
    response.status(404).json({ error: 'Usuário não encontrado.' })
    return
  }

  const data: Prisma.usuarioUpdateInput = {}
  if ('name' in body || 'nome' in body) {
    const nome = body.nome ?? body.name
    if (typeof nome !== 'string' || nome.trim().length < 2 || nome.trim().length > 150) {
      response.status(400).json({ error: 'Nome inválido.' })
      return
    }
    data.nome = nome.trim()
  }
  if ('email' in body) {
    if (typeof body.email !== 'string' || !body.email.trim() || body.email.trim().length > 255) {
      response.status(400).json({ error: 'E-mail inválido.' })
      return
    }
    data.email = body.email.trim().toLowerCase()
  }
  if ('phone' in body || 'telefone' in body) {
    const telefone = body.telefone ?? body.phone
    if (typeof telefone !== 'string' || !telefone.trim() || telefone.trim().length > 20) {
      response.status(400).json({ error: 'Telefone inválido.' })
      return
    }
    data.telefone = telefone.trim()
  }
  if ('password' in body || 'senha' in body) {
    const senha = body.senha ?? body.password
    if (typeof senha !== 'string' || senha.length < 6 || senha.length > 1024) {
      response.status(400).json({ error: 'A senha deve ter entre 6 e 1024 caracteres.' })
      return
    }
    data.senha = await hashPassword(senha)
  }
  if (Object.keys(data).length === 0) {
    response.status(400).json({ error: 'Informe pelo menos um campo para atualizar.' })
    return
  }

  try {
    const user = await database.usuario.update({
      where: { id_usuario: authenticatedUserId },
      data,
      select: { id_usuario: true, nome: true, email: true, telefone: true },
    })
    response.json({ user })
  } catch (error) {
    handlePrismaError(error, response, 'update-own-user')
  }
})

app.delete(['/api/users/:id', '/api/usuarios/:id'], authenticate, async (request, response) => {
  const authenticatedUserId = readAuthUserId(request)
  const requestedUserId = readPositiveInt(request.params.id)
  if (!authenticatedUserId) {
    response.status(401).json({ error: 'Autenticação necessária.' })
    return
  }
  if (!requestedUserId) {
    response.status(400).json({ error: 'Identificação do usuário inválida.' })
    return
  }
  if (requestedUserId !== authenticatedUserId) {
    response.status(404).json({ error: 'Usuário não encontrado.' })
    return
  }

  try {
    const [complaints, histories] = await Promise.all([
      database.denuncia.count({ where: { id_usuario: authenticatedUserId } }),
      database.historico.count({ where: { id_usuario: authenticatedUserId } }),
    ])
    if (complaints > 0 || histories > 0) {
      response.status(409).json({ error: 'Não é possível excluir um usuário com denúncias ou históricos vinculados.' })
      return
    }
    await database.usuario.delete({ where: { id_usuario: authenticatedUserId } })
    response.status(204).send()
  } catch (error) {
    handlePrismaError(error, response, 'delete-own-user')
  }
})

app.get(['/api/orgaos', '/api/organs'], async (_request, response) => {
  try {
    const orgaos = await database.orgao.findMany({
      select: { id_orgao: true, nome: true, descricao: true },
      orderBy: { nome: 'asc' },
    })
    response.json({ orgaos })
  } catch (error) {
    handlePrismaError(error, response, 'list-organizations')
  }
})

app.get(['/api/orgaos/:id', '/api/organs/:id'], async (request, response) => {
  const id_orgao = readPositiveInt(request.params.id)
  if (!id_orgao) {
    response.status(400).json({ error: 'Identificação do órgão inválida.' })
    return
  }

  try {
    const orgao = await database.orgao.findUnique({
      where: { id_orgao },
      select: { id_orgao: true, nome: true, descricao: true },
    })
    if (!orgao) {
      response.status(404).json({ error: 'Órgão não encontrado.' })
      return
    }
    response.json({ orgao })
  } catch (error) {
    handlePrismaError(error, response, 'read-organization')
  }
})

app.post(['/api/orgaos', '/api/organs'], authenticate, requireAdministrator, async (request, response) => {
  const body = isRecord(request.body) ? request.body : {}
  const nome = typeof body.nome === 'string' ? body.nome.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const telefone = typeof body.telefone === 'string' ? body.telefone.trim() : ''
  if (!nome || nome.length > 150 || !email || email.length > 255 ||
      !telefone || telefone.length > 20 || typeof body.descricao !== 'string' || !body.descricao.trim()) {
    response.status(400).json({ error: 'Informe nome, e-mail, telefone e descrição válidos.' })
    return
  }

  try {
    const orgao = await database.orgao.create({
      data: { nome, email, telefone, descricao: body.descricao.trim() },
    })
    response.status(201).json({ orgao })
  } catch (error) {
    handlePrismaError(error, response, 'create-organization')
  }
})

app.patch(['/api/orgaos/:id', '/api/organs/:id'], authenticate, requireAdministrator, async (request, response) => {
  const id_orgao = readPositiveInt(request.params.id)
  const body = isRecord(request.body) ? request.body : {}
  if (!id_orgao) {
    response.status(400).json({ error: 'Identificação do órgão inválida.' })
    return
  }

  const data: Prisma.orgaoUpdateInput = {}
  for (const field of ['nome', 'email', 'telefone', 'descricao'] as const) {
    if (!(field in body)) continue
    if (typeof body[field] !== 'string' || !body[field].trim()) {
      response.status(400).json({ error: `Campo ${field} inválido.` })
      return
    }
    const value = body[field].trim()
    if ((field === 'nome' && value.length > 150) ||
        (field === 'email' && value.length > 255) ||
        (field === 'telefone' && value.length > 20)) {
      response.status(400).json({ error: `Campo ${field} excede o tamanho permitido.` })
      return
    }
    data[field] = field === 'email' ? value.toLowerCase() : value
  }
  if (Object.keys(data).length === 0) {
    response.status(400).json({ error: 'Informe pelo menos um campo para atualizar.' })
    return
  }

  try {
    const orgao = await database.orgao.update({ where: { id_orgao }, data })
    response.json({ orgao })
  } catch (error) {
    handlePrismaError(error, response, 'update-organization')
  }
})

app.delete(['/api/orgaos/:id', '/api/organs/:id'], authenticate, requireAdministrator, async (request, response) => {
  const id_orgao = readPositiveInt(request.params.id)
  if (!id_orgao) {
    response.status(400).json({ error: 'Identificação do órgão inválida.' })
    return
  }
  try {
    if (await database.denuncia.count({ where: { id_orgao } })) {
      response.status(409).json({ error: 'Não é possível excluir um órgão com denúncias vinculadas.' })
      return
    }
    await database.orgao.delete({ where: { id_orgao } })
    response.status(204).send()
  } catch (error) {
    handlePrismaError(error, response, 'delete-organization')
  }
})

app.get(['/api/complaints', '/api/denuncias'], authenticate, async (request, response) => {
  const id_usuario = readAuthUserId(request)
  if (!id_usuario) {
    response.status(401).json({ error: 'Autenticação necessária.' })
    return
  }
  const administrator = isAdministrator(id_usuario, administratorIds)
  try {
    const denuncias = await database.denuncia.findMany({
      where: administrator ? {} : { id_usuario },
      include: { orgao: { select: { id_orgao: true, nome: true } } },
      orderBy: { data_registro: 'desc' },
    })
    const complaints = denuncias.map(complaintResponse)
    response.json({ denuncias, complaints })
  } catch (error) {
    handlePrismaError(error, response, 'list-complaints')
  }
})

app.get(['/api/complaints/:id', '/api/denuncias/:id'], authenticate, async (request, response) => {
  const id_usuario = readAuthUserId(request)
  const id_denuncia = readPositiveInt(request.params.id)
  if (!id_usuario) {
    response.status(401).json({ error: 'Autenticação necessária.' })
    return
  }
  if (!id_denuncia) {
    response.status(400).json({ error: 'Identificação inválida.' })
    return
  }
  try {
    const denuncia = await database.denuncia.findFirst({
      where: {
        id_denuncia,
        ...(isAdministrator(id_usuario, administratorIds) ? {} : { id_usuario }),
      },
      include: { orgao: { select: { id_orgao: true, nome: true } } },
    })
    if (!denuncia) {
      response.status(404).json({ error: 'Denúncia não encontrada.' })
      return
    }
    response.json({ denuncia, complaint: complaintResponse(denuncia) })
  } catch (error) {
    handlePrismaError(error, response, 'read-complaint')
  }
})

app.post(['/api/complaints', '/api/denuncias'], authenticate, async (request, response) => {
  const body = isRecord(request.body) ? request.body : {}
  const id_usuario = readAuthUserId(request)
  const tipoValue = body.tipo ?? body.type
  const tituloValue = body.titulo ?? body.title ?? tipoValue
  const descricaoValue = body.descricao ?? body.description
  const enderecoValue = body.endereco ?? body.address
  const id_orgao = readPositiveInt(body.id_orgao ?? body.orgaoId)
  const latitude = body.latitude
  const longitude = body.longitude

  if (!id_usuario) {
    response.status(401).json({ error: 'Autenticação necessária.' })
    return
  }
  if (typeof tipoValue !== 'string' || !tipoValue.trim() || tipoValue.trim().length > 100 ||
      typeof tituloValue !== 'string' || !tituloValue.trim() || tituloValue.trim().length > 200 ||
      typeof descricaoValue !== 'string' || !descricaoValue.trim() ||
      !id_orgao || typeof latitude !== 'number' || !Number.isFinite(latitude) ||
      latitude < -90 || latitude > 90 ||
      typeof longitude !== 'number' || !Number.isFinite(longitude) ||
      longitude < -180 || longitude > 180) {
    response.status(400).json({ error: 'Informe tipo, descrição, órgão, latitude e longitude válidos.' })
    return
  }
  const legacyAddress = [
    enderecoValue,
    body.number,
    body.neighborhood,
    body.complement,
  ].filter((part): part is string => typeof part === 'string' && Boolean(part.trim()))
    .map((part) => part.trim())
    .join(', ')
  const endereco = typeof enderecoValue === 'string' ? legacyAddress : ''
  if (!endereco) {
    response.status(400).json({ error: 'Informe o endereço da denúncia.' })
    return
  }

  try {
    const denuncia = await database.denuncia.create({
      data: {
        titulo: tituloValue.trim(),
        tipo: tipoValue.trim(),
        descricao: descricaoValue.trim(),
        status: 'RECEIVED',
        endereco,
        latitude,
        longitude,
        usuario: { connect: { id_usuario } },
        orgao: { connect: { id_orgao } },
      },
      include: { orgao: { select: { id_orgao: true, nome: true } } },
    })
    response.status(201).json({ denuncia, complaint: complaintResponse(denuncia) })
  } catch (error) {
    handlePrismaError(error, response, 'create-complaint')
  }
})

app.patch(['/api/complaints/:id', '/api/denuncias/:id'], authenticate, async (request, response) => {
  const id_usuario = readAuthUserId(request)
  const id_denuncia = readPositiveInt(request.params.id)
  const body = isRecord(request.body) ? request.body : {}
  if (!id_usuario) {
    response.status(401).json({ error: 'Autenticação necessária.' })
    return
  }
  if (!id_denuncia) {
    response.status(400).json({ error: 'Identificação inválida.' })
    return
  }
  const administrator = isAdministrator(id_usuario, administratorIds)

  const data: Prisma.denunciaUpdateInput = {}
  if (!administrator && ('status' in body || 'id_orgao' in body || 'orgaoId' in body)) {
    response.status(403).json({ error: 'Somente responsáveis podem alterar status ou encaminhar denúncias.' })
    return
  }
  const stringFields = [
    ['titulo', body.titulo ?? body.title, 200],
    ['tipo', body.tipo ?? body.type, 100],
    ['descricao', body.descricao ?? body.description, undefined],
    ['status', body.status, 50],
    ['endereco', body.endereco ?? body.address, undefined],
  ] as const
  for (const [field, value, maxLength] of stringFields) {
    if (value === undefined) continue
    if (typeof value !== 'string' || !value.trim() || (maxLength !== undefined && value.trim().length > maxLength)) {
      response.status(400).json({ error: `Campo ${field} inválido.` })
      return
    }
    data[field] = value.trim()
  }
  for (const field of ['latitude', 'longitude'] as const) {
    if (field in body) {
      if (typeof body[field] !== 'number' || !Number.isFinite(body[field])) {
        response.status(400).json({ error: `Campo ${field} inválido.` })
        return
      }
      data[field] = body[field]
    }
  }
  if ('id_orgao' in body || 'orgaoId' in body) {
    const id_orgao = readPositiveInt(body.id_orgao ?? body.orgaoId)
    if (!id_orgao) {
      response.status(400).json({ error: 'Identificação do órgão inválida.' })
      return
    }
    data.orgao = { connect: { id_orgao } }
  }
  if (Object.keys(data).length === 0) {
    response.status(400).json({ error: 'Informe pelo menos um campo para atualizar.' })
    return
  }

  try {
    const existing = await database.denuncia.findFirst({
      where: {
        id_denuncia,
        ...(administrator ? {} : { id_usuario }),
      },
    })
    if (!existing) {
      response.status(404).json({ error: 'Denúncia não encontrada.' })
      return
    }
    const denuncia = await database.denuncia.update({
      where: { id_denuncia },
      data,
      include: { orgao: { select: { id_orgao: true, nome: true } } },
    })
    response.json({ denuncia, complaint: complaintResponse(denuncia) })
  } catch (error) {
    handlePrismaError(error, response, 'update-complaint')
  }
})

app.delete(['/api/complaints/:id', '/api/denuncias/:id'], authenticate, async (request, response) => {
  const id_usuario = readAuthUserId(request)
  const id_denuncia = readPositiveInt(request.params.id)
  if (!id_usuario) {
    response.status(401).json({ error: 'Autenticação necessária.' })
    return
  }
  if (!id_denuncia) {
    response.status(400).json({ error: 'Identificação inválida.' })
    return
  }
  try {
    const existing = await database.denuncia.findFirst({
      where: {
        id_denuncia,
        ...(isAdministrator(id_usuario, administratorIds) ? {} : { id_usuario }),
      },
      select: { id_denuncia: true },
    })
    if (!existing) {
      response.status(404).json({ error: 'Denúncia não encontrada.' })
      return
    }
    if (await database.historico.count({ where: { id_denuncia } })) {
      response.status(409).json({ error: 'Não é possível excluir uma denúncia com históricos vinculados.' })
      return
    }
    await database.denuncia.delete({ where: { id_denuncia } })
    response.status(204).send()
  } catch (error) {
    handlePrismaError(error, response, 'delete-complaint')
  }
})

app.get(['/api/historicos', '/api/histories'], authenticate, async (request, response) => {
  const id_usuario = readAuthUserId(request)
  if (!id_usuario) {
    response.status(401).json({ error: 'Autenticação necessária.' })
    return
  }
  const administrator = isAdministrator(id_usuario, administratorIds)
  try {
    const historicos = await database.historico.findMany({
      where: administrator ? {} : { denuncia: { id_usuario } },
      include: {
        denuncia: { select: { id_denuncia: true, titulo: true, tipo: true, status: true, id_usuario: true } },
      },
      orderBy: { id_historico: 'desc' },
    })
    response.json({ historicos })
  } catch (error) {
    handlePrismaError(error, response, 'list-histories')
  }
})

app.get(['/api/historicos/:id', '/api/histories/:id'], authenticate, async (request, response) => {
  const id_historico = readPositiveInt(request.params.id)
  const id_usuario = readAuthUserId(request)
  if (!id_usuario) {
    response.status(401).json({ error: 'Autenticação necessária.' })
    return
  }
  if (!id_historico) {
    response.status(400).json({ error: 'Identificação do histórico inválida.' })
    return
  }
  try {
    const historico = await database.historico.findFirst({
      where: {
        id_historico,
        ...(isAdministrator(id_usuario, administratorIds) ? {} : { denuncia: { id_usuario } }),
      },
      include: {
        denuncia: { select: { id_denuncia: true, titulo: true, tipo: true, status: true, id_usuario: true } },
      },
    })
    if (!historico) {
      response.status(404).json({ error: 'Histórico não encontrado.' })
      return
    }
    response.json({ historico })
  } catch (error) {
    handlePrismaError(error, response, 'read-history')
  }
})

app.post(['/api/historicos', '/api/histories'], authenticate, async (request, response) => {
  const authenticatedUserId = readAuthUserId(request)
  const body = isRecord(request.body) ? request.body : {}
  if (!authenticatedUserId) {
    response.status(401).json({ error: 'Autenticação necessária.' })
    return
  }
  const administrator = isAdministrator(authenticatedUserId, administratorIds)
  const id_usuario = administrator
    ? readPositiveInt(body.id_usuario) ?? authenticatedUserId
    : authenticatedUserId
  const id_denuncia = readPositiveInt(body.id_denuncia)
  if (typeof body.descricao !== 'string' || !body.descricao.trim() ||
      typeof body.foto !== 'string' || !body.foto.trim() ||
      typeof body.observacao !== 'string' || !body.observacao.trim() ||
      !id_denuncia || (administrator && 'id_usuario' in body && !readPositiveInt(body.id_usuario))) {
    response.status(400).json({ error: 'Informe descrição, foto, observação, usuário e denúncia válidos.' })
    return
  }
  try {
    if (!administrator) {
      const ownComplaint = await database.denuncia.findFirst({
        where: { id_denuncia, id_usuario: authenticatedUserId },
        select: { id_denuncia: true },
      })
      if (!ownComplaint) {
        response.status(404).json({ error: 'Denúncia não encontrada.' })
        return
      }
    }
    const historico = await database.historico.create({
      data: {
        descricao: body.descricao.trim(),
        foto: body.foto.trim(),
        observacao: body.observacao.trim(),
        usuario: { connect: { id_usuario } },
        denuncia: { connect: { id_denuncia } },
      },
    })
    response.status(201).json({ historico })
  } catch (error) {
    handlePrismaError(error, response, 'create-history')
  }
})

app.patch(['/api/historicos/:id', '/api/histories/:id'], authenticate, async (request, response) => {
  const id_historico = readPositiveInt(request.params.id)
  const authenticatedUserId = readAuthUserId(request)
  const body = isRecord(request.body) ? request.body : {}
  if (!authenticatedUserId) {
    response.status(401).json({ error: 'Autenticação necessária.' })
    return
  }
  if (!id_historico) {
    response.status(400).json({ error: 'Identificação do histórico inválida.' })
    return
  }

  const administrator = isAdministrator(authenticatedUserId, administratorIds)
  const data: Prisma.historicoUpdateInput = {}
  for (const field of ['descricao', 'foto', 'observacao'] as const) {
    if (!(field in body)) continue
    if (typeof body[field] !== 'string' || !body[field].trim()) {
      response.status(400).json({ error: `Campo ${field} inválido.` })
      return
    }
    data[field] = body[field].trim()
  }
  if (administrator && 'id_usuario' in body) {
    const id_usuario = readPositiveInt(body.id_usuario)
    if (!id_usuario) {
      response.status(400).json({ error: 'Identificação do usuário inválida.' })
      return
    }
    data.usuario = { connect: { id_usuario } }
  }
  if ('id_denuncia' in body) {
    const id_denuncia = readPositiveInt(body.id_denuncia)
    if (!id_denuncia) {
      response.status(400).json({ error: 'Identificação da denúncia inválida.' })
      return
    }
    if (!administrator) {
      const ownComplaint = await database.denuncia.findFirst({
        where: { id_denuncia, id_usuario: authenticatedUserId },
        select: { id_denuncia: true },
      })
      if (!ownComplaint) {
        response.status(404).json({ error: 'Denúncia não encontrada.' })
        return
      }
    }
    data.denuncia = { connect: { id_denuncia } }
  }
  if (Object.keys(data).length === 0) {
    response.status(400).json({ error: 'Informe pelo menos um campo para atualizar.' })
    return
  }

  try {
    const existing = await database.historico.findFirst({
      where: {
        id_historico,
        ...(administrator ? {} : { id_usuario: authenticatedUserId, denuncia: { id_usuario: authenticatedUserId } }),
      },
      select: { id_historico: true },
    })
    if (!existing) {
      response.status(404).json({ error: 'Histórico não encontrado.' })
      return
    }
    const historico = await database.historico.update({ where: { id_historico }, data })
    response.json({ historico })
  } catch (error) {
    handlePrismaError(error, response, 'update-history')
  }
})

app.delete(['/api/historicos/:id', '/api/histories/:id'], authenticate, async (request, response) => {
  const id_historico = readPositiveInt(request.params.id)
  const id_usuario = readAuthUserId(request)
  if (!id_usuario) {
    response.status(401).json({ error: 'Autenticação necessária.' })
    return
  }
  if (!id_historico) {
    response.status(400).json({ error: 'Identificação do histórico inválida.' })
    return
  }
  try {
    const existing = await database.historico.findFirst({
      where: {
        id_historico,
        ...(isAdministrator(id_usuario, administratorIds) ? {} : { id_usuario, denuncia: { id_usuario } }),
      },
      select: { id_historico: true },
    })
    if (!existing) {
      response.status(404).json({ error: 'Histórico não encontrado.' })
      return
    }
    await database.historico.delete({ where: { id_historico } })
    response.status(204).send()
  } catch (error) {
    handlePrismaError(error, response, 'delete-history')
  }
})

app.post('/api/ai/complaint-draft', authenticate, async (request, response) => {
  const description =
    typeof request.body?.description === 'string'
      ? request.body.description.trim()
      : ''

  if (description.length < 10) {
    response.status(400).json({
      error: 'Descreva o problema com pelo menos 10 caracteres.',
    })
    return
  }

  const apiKey = process.env.AI_API_KEY
  if (!apiKey) {
    response.status(503).json({
      error: 'A IA ainda não está configurada. Adicione AI_API_KEY ao backend.',
    })
    return
  }

  try {
    const baseUrl = (process.env.AI_BASE_URL ?? 'https://api.openai.com/v1').replace(
      /\/$/,
      '',
    )
    const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL ?? 'gpt-4o-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Você estrutura denúncias cidadãs em JSON. Não invente informações. Responda somente com as propriedades title, category, priority e summary. Use português do Brasil.',
          },
          {
            role: 'user',
            content: `Denúncia: ${description}`,
          },
        ],
      }),
    })

    if (!aiResponse.ok) {
      throw new Error(`AI provider returned ${aiResponse.status}`)
    }

    const completion = (await aiResponse.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>
    }
    const content = completion.choices?.[0]?.message?.content ?? '{}'
    const draft = JSON.parse(content) as {
      title?: string
      category?: string
      priority?: string
      summary?: string
    }

    response.json({
      title: draft.title ?? '',
      category: draft.category ?? '',
      priority: draft.priority ?? '',
      summary: draft.summary ?? '',
    })
  } catch (error) {
    console.error('AI complaint draft failed')
    response.status(502).json({
      error: 'Não foi possível gerar o rascunho agora. Tente novamente.',
    })
  }
})

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (error instanceof SyntaxError) {
    response.status(400).json({ error: 'Corpo da requisição inválido.' })
    return
  }
  console.error('Unhandled request error')
  response.status(500).json({ error: 'Não foi possível concluir a operação.' })
})

return app
}

const isMainModule = process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url

if (isMainModule) {
  const app = createApp()
  const port = Number(process.env.PORT ?? 3000)
  app.listen(port, () => {
    console.log(`Backend listening on port ${port}`)
  })
}
