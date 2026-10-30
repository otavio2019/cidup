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
import { AUTH_COOKIE_NAME, AUTH_TOKEN_TTL_SECONDS, createAuthToken, readAuthPrincipalType, readAuthUserId, requireAuthentication } from './auth.js'
import { prisma } from './lib/prisma.js'
import { isSupabaseConfigured, supabaseRequest } from './lib/supabase.js'

/** API HTTP do CidUp: autenticação, usuários, órgãos, denúncias, históricos e integrações opcionais. */
const scrypt = promisify(scryptCallback)
// ===== CONFIGURAÇÃO E LIMITAÇÃO DE REQUISIÇÕES =====
// Limita tentativas de login e cadastro para dificultar abuso dos endpoints de autenticação.
const authenticationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Aguarde antes de tentar novamente.' },
})

// Converte um valor numérico em ID positivo ou retorna null quando ele for inválido.
// ===== VALIDAÇÃO E ADAPTAÇÃO DE DADOS =====
function readPositiveInt(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

// Garante que um dado desconhecido seja um objeto simples antes de ler suas propriedades.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Remove caracteres não numéricos para validar CPF, CEP e outros campos numéricos.
function digits(value: unknown) {
  return typeof value === 'string' ? value.replace(/\D/g, '') : ''
}

// Confere o formato e os dígitos verificadores antes do cadastro ou da atualização do perfil.
function isValidCpf(value: unknown) {
  const cpf = digits(value)
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false
  let sum = 0
  for (let index = 0; index < 9; index += 1) sum += Number(cpf[index]) * (10 - index)
  let digit = (sum * 10) % 11
  if (digit === 10) digit = 0
  if (digit !== Number(cpf[9])) return false
  sum = 0
  for (let index = 0; index < 10; index += 1) sum += Number(cpf[index]) * (11 - index)
  digit = (sum * 10) % 11
  if (digit === 10) digit = 0
  return digit === Number(cpf[10])
}

// Confere se o CEP informado pelo frontend contém exatamente oito dígitos.
function isValidCep(value: unknown) {
  return /^\d{8}$/.test(digits(value))
}

const MAX_IMAGE_BYTES = 2 * 1024 * 1024

// Valida o formato e o tamanho das imagens recebidas nas rotas de perfil e denúncia.
function isValidImageData(value: unknown) {
  if (typeof value !== 'string') return false
  const match = value.match(/^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/)
  const encodedImage = match?.[1]
  if (!encodedImage) return false
  try {
    return Buffer.from(encodedImage, 'base64').length <= MAX_IMAGE_BYTES
  } catch {
    return false
  }
}

// Normaliza texto para que a regra funcione com ou sem acentos e diferenças de caixa.
function normalizeRoutingText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
}

const organizationRoutingRules = [
  { typeKeywords: ['buraco', 'calcada', 'sinalizacao', 'pavimento'], organizationKeywords: ['obra', 'infraestrutura'] },
  { typeKeywords: ['iluminacao', 'poste', 'lampada'], organizationKeywords: ['iluminacao'] },
  { typeKeywords: ['lixo', 'descarte', 'entulho', 'limpeza'], organizationKeywords: ['limpeza'] },
  { typeKeywords: ['arvore', 'area verde', 'meio ambiente'], organizationKeywords: ['meio ambiente', 'ambiental'] },
  { typeKeywords: ['alagamento', 'drenagem', 'esgoto', 'saneamento'], organizationKeywords: ['saneamento', 'drenagem'] },
]

// Encontra o órgão responsável exclusivamente com base no tipo informado pelo cidadão.
function findOrganizationByComplaintType(type: string, organizations: Array<{ id_orgao: number; nome: string }>) {
  const normalizedType = normalizeRoutingText(type)
  const rule = organizationRoutingRules.find(({ typeKeywords }) =>
    typeKeywords.some((keyword) => normalizedType.includes(keyword)),
  )
  if (!rule) return organizations.find(({ nome }) => normalizeRoutingText(nome).includes('obra'))
  return organizations.find(({ nome }) => {
    const normalizedName = normalizeRoutingText(nome)
    return rule.organizationKeywords.some((keyword) => normalizedName.includes(keyword))
  })
}

// Traduz erros conhecidos do Prisma e oculta detalhes internos nos demais casos.
function handlePrismaError(error: unknown, response: express.Response, operation: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      response.status(404).json({ error: 'Registro não encontrado.' })
      return
    }
    if (error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(', ') : ''
      const fieldMessage = target.includes('email')
        ? 'Este e-mail já está cadastrado.'
        : target.includes('cpf')
          ? 'Este CPF já está cadastrado.'
          : target.includes('telefone')
            ? 'Este telefone já está cadastrado.'
            : 'Um dos dados informados já está cadastrado.'
      response.status(409).json({ error: fieldMessage })
      return
    }
    if (error.code === 'P2003') {
      response.status(409).json({ error: 'O registro possui um relacionamento inválido.' })
      return
    }
  }

  console.error(`Falha na operação do banco de dados: ${operation}`, {
    name: error instanceof Error ? error.name : typeof error,
    code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined,
  })
  response.status(500).json({ error: 'Não foi possível concluir a operação.' })
}

// Verifica se a sessão pertence à conta única de responsável autenticada.
function isResponsibleRequest(request: express.Request) {
  return readAuthPrincipalType(request) === 'RESPONSIBLE'
}

// Adapta os campos do banco ao formato de denúncia consumido pelo frontend.
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
  foto?: string | null
  id_usuario: number
  id_orgao: number
  orgao?: { id_orgao: number; nome: string } | null
  usuario?: { id_usuario: number; nome: string; email: string; telefone?: string | null; cpf?: string | null; foto?: string | null } | null
  historico?: Array<{ id_historico: number; descricao: string; observacao: string }>
}) {
  return {
    ...complaint,
    id: complaint.id_denuncia,
    protocol: `CIDUP-${complaint.id_denuncia}`,
    title: complaint.titulo,
    description: complaint.descricao,
    address: complaint.endereco,
    photo: complaint.foto ?? null,
    neighborhood: '',
    number: '',
    complement: '',
    createdAt: complaint.data_registro.toISOString(),
    registeredAt: complaint.data_registro.toISOString(),
    type: { name: complaint.tipo },
    citizen: complaint.usuario?.nome ?? '',
    citizenEmail: complaint.usuario?.email ?? '',
    citizenPhone: complaint.usuario?.telefone ?? '',
    citizenCpf: complaint.usuario?.cpf ?? '',
    citizenPhoto: complaint.usuario?.foto ?? null,
    history: (complaint.historico ?? []).map((item) => ({
      id: item.id_historico,
      description: item.descricao,
      observation: item.observacao,
    })),
  }
}

// ===== CONFIGURAÇÃO DA API E MIDDLEWARES =====
// Monta a API com banco e opções injetáveis, validando as configurações antes de expor rotas.
export function createApp(
  database: PrismaClient = prisma,
  options: {
    authTokenSecret?: string
    frontendOrigins?: string
    production?: boolean
  } = {},
) {
const secret = options.authTokenSecret ?? process.env.AUTH_TOKEN_SECRET
if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
  throw new Error('Defina AUTH_TOKEN_SECRET com um valor de pelo menos 32 bytes.')
}
const frontendOrigins = (options.frontendOrigins ?? process.env.FRONTEND_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const allowedOrigins = new Set(frontendOrigins)
const production = options.production ?? process.env.NODE_ENV === 'production'
const authCookieSameSite = production ? 'none' : 'lax'
if (production && frontendOrigins.some((origin) => new URL(origin).protocol !== 'https:')) {
  throw new Error('FRONTEND_ORIGINS deve usar HTTPS em produção.')
}
const authenticate = requireAuthentication(secret)
const app = express()

// Configura cabeçalhos, origem permitida, JSON e cookie usados pelas rotas abaixo.
app.disable('x-powered-by')
app.set('trust proxy', production ? 1 : false)
if (production) {
  // Recusa conexões sem TLS quando a API está configurada para produção.
  app.use((request, response, next) => {
    if (!request.secure) {
      response.status(400).json({ error: 'A API exige HTTPS.' })
      return
    }
    next()
  })
}
// Permite credenciais somente para origens explicitamente configuradas.
app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.has(origin) ? origin ?? false : false)
  },
  credentials: true,
}))
// Define limites e middlewares necessários para interpretar JSON e cookies de sessão.
app.use(express.json({ limit: '4mb' }))
app.use(cookieParser())
// Impede que respostas com dados de API sejam reutilizadas por caches intermediários.
app.use('/api', (_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store')
  next()
})
// Bloqueia chamadas de origens não permitidas, inclusive em rotas sem autenticação.
app.use('/api', (request, response, next) => {
  const origin = request.get('origin')
  if (origin && !allowedOrigins.has(origin)) {
    response.status(403).json({ error: 'Origem não permitida.' })
    return
  }
  next()
})
// Restringe operações administrativas a usuários autenticados presentes na lista autorizada.
function requireAdministrator(request: express.Request, response: express.Response, next: express.NextFunction) {
  const userId = readAuthUserId(request)
  if (!userId) {
    response.status(401).json({ error: 'Autenticação necessária.' })
    return
  }
  if (!isResponsibleRequest(request)) {
    response.status(403).json({ error: 'Operação restrita a responsáveis autorizados.' })
    return
  }
  next()
}
// Armazena a senha como salt aleatório e derivação scrypt, nunca em texto puro.
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer
  return `${salt}:${derivedKey.toString('hex')}`
}

// Recalcula o hash e compara os bytes em tempo constante para validar uma senha.
async function verifyPassword(password: string, storedHash: string) {
  const [salt, key] = storedHash.split(':')
  if (!salt || !/^[a-f0-9]{32}$/i.test(salt) || !key || !/^[a-f0-9]{128}$/i.test(key)) return false

  const derivedKey = (await scrypt(password, salt, 64)) as Buffer
  const storedKey = Buffer.from(key, 'hex')
  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey)
}

// Disponibiliza uma verificação simples de disponibilidade sem exigir sessão.
app.get('/health', (_request, response) => {
  response.json({ status: 'ok' })
})

// Verifica a configuração e a conectividade do serviço Supabase.
app.get('/api/supabase/status', authenticate, async (_request, response) => {
  if (!isSupabaseConfigured()) {
    response.status(503).json({ error: 'Supabase não configurado.' })
    return
  }

  try {
    const result = await supabaseRequest('/')
    response.status(result.ok ? 200 : 502).json({ connected: result.ok })
  } catch {
    response.status(502).json({ connected: false })
  }
})

// ===== AUTENTICAÇÃO: CADASTRO, LOGIN E SESSÃO =====
// Valida os campos do cadastro e cria um usuário sem expor a senha armazenada.
async function registerUser(request: express.Request, response: express.Response) {
  const body = isRecord(request.body) ? request.body : {}
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const cpf = digits(body.cpf)
  const cep = digits(body.cep)
  const password = body.password

  if (name.length < 2 || name.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255 ||
      !phone || phone.length > 20 || typeof password !== 'string' || password.length < 6 || password.length > 1024) {
    response.status(400).json({ error: 'Informe nome, e-mail, telefone, CPF, CEP e uma senha válida.' })
    return
  }
  if (!isValidCpf(body.cpf)) {
    response.status(400).json({ error: 'CPF inválido. Confira os números digitados.' })
    return
  }
  if (!isValidCep(body.cep)) {
    response.status(400).json({ error: 'CEP inválido. Informe 8 números no formato 00000-000.' })
    return
  }

  try {
    const user = await database.usuario.create({
      data: { nome: name, email, telefone: phone, cpf, cep, senha: await hashPassword(password) },
      select: { id_usuario: true, nome: true, email: true, telefone: true, cpf: true, cep: true, foto: true },
    })
    response.status(201).json({ user })
  } catch (error) {
    handlePrismaError(error, response, 'register-user')
  }
}

// Recebe o cadastro iniciado pelo formulário do frontend e encaminha os dados ao Prisma.
app.post(['/api/auth/register', '/api/users', '/api/usuarios'], authenticationRateLimit, registerUser)

// Autentica as credenciais e devolve os dados públicos junto ao cookie de sessão.
app.post('/api/auth/login', authenticationRateLimit, async (request, response) => {
  const body = isRecord(request.body) ? request.body : {}
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = body.password
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length > 1024) {
    response.status(400).json({ error: 'Informe e-mail e senha.' })
    return
  }

  try {
    const responsible = await database.responsavel.findUnique({
      where: { email },
      include: { orgao: { select: { id_orgao: true, nome: true } } },
    })
    if (responsible) {
      if (!(await verifyPassword(password, responsible.senha))) {
        response.status(401).json({ error: 'E-mail ou senha inválidos.' })
        return
      }
      const token = await createAuthToken(responsible.id_responsavel, secret, 'RESPONSIBLE')
      response.cookie(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: production,
        sameSite: authCookieSameSite,
        maxAge: AUTH_TOKEN_TTL_SECONDS * 1000,
        path: '/',
      })
      response.json({
        user: {
          id: responsible.id_responsavel,
          name: responsible.nome,
          email: responsible.email,
          phone: responsible.telefone,
          role: 'RESPONSIBLE',
          orgao: responsible.orgao ?? null,
        },
      })
      return
    }
    const user = await database.usuario.findUnique({ where: { email } })
    if (!user || !(await verifyPassword(password, user.senha))) {
      response.status(401).json({ error: 'E-mail ou senha inválidos.' })
      return
    }
    const token = await createAuthToken(user.id_usuario, secret, 'CITIZEN')
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
        cpf: user.cpf,
        cep: user.cep,
        photo: user.foto,
        role: 'CITIZEN',
      },
    })
  } catch (error) {
    handlePrismaError(error, response, 'login')
  }
})

// Encerra a sessão removendo o cookie com os mesmos atributos de segurança.
app.post('/api/auth/logout', (_request, response) => {
  response.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: production,
    sameSite: authCookieSameSite,
    path: '/',
  })
  response.status(204).send()
})

// Confirma a sessão atual consultando o usuário associado ao token.
app.get('/api/auth/session', authenticate, async (request, response) => {
  const principalId = readAuthUserId(request)
  if (!principalId) {
    response.status(401).json({ error: 'Autenticação necessária.' })
    return
  }
  try {
    if (readAuthPrincipalType(request) === 'RESPONSIBLE') {
      const responsible = await database.responsavel.findUnique({
        where: { id_responsavel: principalId },
        select: {
          id_responsavel: true,
          nome: true,
          email: true,
          telefone: true,
          orgao: { select: { id_orgao: true, nome: true } },
        },
      })
      if (!responsible) {
        response.status(401).json({ error: 'Credencial inválida ou expirada.' })
        return
      }
      response.json({
        user: {
          id: responsible.id_responsavel,
          name: responsible.nome,
          email: responsible.email,
          phone: responsible.telefone,
          role: 'RESPONSIBLE',
          orgao: responsible.orgao ?? null,
        },
      })
      return
    }
    const id_usuario = principalId
    const user = await database.usuario.findUnique({
      where: { id_usuario },
      select: { id_usuario: true, nome: true, email: true, telefone: true, cpf: true, cep: true, foto: true },
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
        role: 'CITIZEN',
      },
    })
  } catch (error) {
    handlePrismaError(error, response, 'read-auth-session')
  }
})

// ===== USUÁRIOS: PERFIL E GERENCIAMENTO DA PRÓPRIA CONTA =====
// Retorna somente o perfil do usuário autenticado.
app.get(['/api/users', '/api/usuarios'], authenticate, async (request, response) => {
  const id_usuario = readAuthUserId(request)
  if (!id_usuario) {
    response.status(401).json({ error: 'Autenticação necessária.' })
    return
  }
  try {
    const user = await database.usuario.findUnique({
      where: { id_usuario },
      select: { id_usuario: true, nome: true, email: true, telefone: true, cpf: true, cep: true, foto: true },
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

// Consulta o perfil apenas quando o ID solicitado pertence à própria sessão.
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
      select: { id_usuario: true, nome: true, email: true, telefone: true, cpf: true, cep: true, foto: true },
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

// Valida e atualiza campos permitidos exclusivamente no perfil do usuário autenticado.
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
  if ('cpf' in body) {
    if (!isValidCpf(body.cpf)) {
      response.status(400).json({ error: 'CPF inválido.' })
      return
    }
    data.cpf = digits(body.cpf)
  }
  if ('cep' in body) {
    if (!isValidCep(body.cep)) {
      response.status(400).json({ error: 'CEP inválido.' })
      return
    }
    data.cep = digits(body.cep)
  }
  if ('photo' in body || 'foto' in body) {
    const photo = body.photo ?? body.foto
    if (photo !== null && !isValidImageData(photo)) {
      response.status(400).json({ error: 'Foto inválida. Use PNG, JPG ou WEBP de até 2 MB.' })
      return
    }
    data.foto = photo === null ? null : String(photo)
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
      select: { id_usuario: true, nome: true, email: true, telefone: true, cpf: true, cep: true, foto: true },
    })
    response.json({ user })
  } catch (error) {
    handlePrismaError(error, response, 'update-own-user')
  }
})

// Exclui o próprio usuário somente quando não há denúncias ou históricos vinculados.
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

// ===== ÓRGÃOS: CONSULTA E ADMINISTRAÇÃO =====
// Lista apenas os campos públicos dos órgãos responsáveis.
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

// Busca um órgão por ID sem retornar seus dados de contato privados.
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

// Cria um órgão depois de validar os campos e autorizar o responsável.
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

// Atualiza somente campos válidos de um órgão para administradores autorizados.
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

// Remove um órgão apenas quando não existem denúncias relacionadas a ele.
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

// ===== DENÚNCIAS: CONSULTA, CRIAÇÃO E ATUALIZAÇÃO =====
// Lista as denúncias próprias; administradores autorizados podem consultar todas.
app.get(['/api/complaints', '/api/denuncias'], authenticate, async (request, response) => {
  const id_usuario = readAuthUserId(request)
  if (!id_usuario) {
    response.status(401).json({ error: 'Autenticação necessária.' })
    return
  }
  const responsibleUser = isResponsibleRequest(request)
  try {
    const denuncias = await database.denuncia.findMany({
      where: responsibleUser ? {} : { id_usuario },
      include: {
        orgao: { select: { id_orgao: true, nome: true } },
        usuario: { select: { id_usuario: true, nome: true, email: true, telefone: true, cpf: true, foto: true } },
        historico: {
          orderBy: { id_historico: 'desc' },
          select: { id_historico: true, descricao: true, observacao: true },
        },
      },
      orderBy: { data_registro: 'desc' },
    })
    const complaints = denuncias.map(complaintResponse)
    response.json({ denuncias, complaints })
  } catch (error) {
    handlePrismaError(error, response, 'list-complaints')
  }
})

// Consulta uma denúncia somente se ela pertencer ao usuário ou se houver acesso administrativo.
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
        ...(isResponsibleRequest(request) ? {} : { id_usuario }),
      },
      include: {
        orgao: { select: { id_orgao: true, nome: true } },
        usuario: { select: { id_usuario: true, nome: true, email: true, telefone: true, cpf: true, foto: true } },
        historico: {
          orderBy: { id_historico: 'desc' },
          select: { id_historico: true, descricao: true, observacao: true },
        },
      },
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

// Valida e registra a denúncia, encaminhando-a automaticamente pelo tipo informado.
app.post(['/api/complaints', '/api/denuncias'], authenticate, async (request, response) => {
  const body = isRecord(request.body) ? request.body : {}
  const id_usuario = readAuthUserId(request)
  const tipoValue = body.tipo ?? body.type
  const tituloValue = body.titulo ?? body.title ?? tipoValue
  const descricaoValue = body.descricao ?? body.description
  const enderecoValue = body.endereco ?? body.address
  const latitude = body.latitude
  const longitude = body.longitude
  const photoValue = body.foto ?? body.photo

  if (!id_usuario) {
    response.status(401).json({ error: 'Autenticação necessária.' })
    return
  }
  if (typeof tipoValue !== 'string' || !tipoValue.trim() || tipoValue.trim().length > 100 ||
      typeof tituloValue !== 'string' || !tituloValue.trim() || tituloValue.trim().length > 200 ||
      typeof descricaoValue !== 'string' || !descricaoValue.trim() ||
      typeof latitude !== 'number' || !Number.isFinite(latitude) ||
      latitude < -90 || latitude > 90 ||
      typeof longitude !== 'number' || !Number.isFinite(longitude) ||
      longitude < -180 || longitude > 180) {
    response.status(400).json({ error: 'Informe tipo, descrição, latitude e longitude válidos.' })
    return
  }
  if (photoValue !== undefined && photoValue !== null && !isValidImageData(photoValue)) {
    response.status(400).json({ error: 'A foto deve ser PNG, JPG ou WEBP e ter no máximo 2 MB.' })
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
    const organizations = await database.orgao.findMany({
      select: { id_orgao: true, nome: true },
      orderBy: { nome: 'asc' },
    })
    const organization = findOrganizationByComplaintType(tipoValue.trim(), organizations)
    if (!organization) {
      response.status(503).json({ error: 'Nenhum órgão disponível para encaminhar esta denúncia.' })
      return
    }
    const denuncia = await database.denuncia.create({
      data: {
        titulo: tituloValue.trim(),
        tipo: tipoValue.trim(),
        descricao: descricaoValue.trim(),
        status: 'RECEIVED',
        endereco,
        latitude,
        longitude,
        foto: photoValue === undefined || photoValue === null ? null : String(photoValue),
        usuario: { connect: { id_usuario } },
        orgao: { connect: { id_orgao: organization.id_orgao } },
      },
      include: { orgao: { select: { id_orgao: true, nome: true } }, orgaos_extras: { select: { id_orgao: true, nome: true } } },
    })
    response.status(201).json({ denuncia, complaint: complaintResponse(denuncia) })
  } catch (error) {
    handlePrismaError(error, response, 'create-complaint')
  }
})

// Atualiza uma denúncia própria, reservando mudanças de status e encaminhamento aos responsáveis.
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
  const responsibleUser = isResponsibleRequest(request)

  const data: Prisma.denunciaUpdateInput = {}
  if (!responsibleUser && ('status' in body || 'id_orgao' in body || 'orgaoId' in body)) {
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
        ...(responsibleUser ? {} : { id_usuario }),
      },
    })
    if (!existing) {
      response.status(404).json({ error: 'Denúncia não encontrada.' })
      return
    }
    const denuncia = await database.denuncia.update({
      where: { id_denuncia },
      data,
      include: {
        orgao: { select: { id_orgao: true, nome: true } },
        usuario: { select: { id_usuario: true, nome: true, email: true, telefone: true, cpf: true, foto: true } },
        historico: {
          orderBy: { id_historico: 'desc' },
          select: { id_historico: true, descricao: true, observacao: true },
        },
      },
    })
    response.json({ denuncia, complaint: complaintResponse(denuncia) })
  } catch (error) {
    handlePrismaError(error, response, 'update-complaint')
  }
})

// Exclui uma denúncia própria ou administrativa somente se não houver histórico associado.
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
        ...(isResponsibleRequest(request) ? {} : { id_usuario }),
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

// Lista históricos das denúncias próprias, liberando todos os registros a administradores.
app.get(['/api/historicos', '/api/histories'], authenticate, async (request, response) => {
  const id_usuario = readAuthUserId(request)
  if (!id_usuario) {
    response.status(401).json({ error: 'Autenticação necessária.' })
    return
  }
  const responsibleUser = isResponsibleRequest(request)
  try {
    const historicos = await database.historico.findMany({
      where: responsibleUser ? {} : { denuncia: { id_usuario } },
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

// ===== HISTÓRICO: ACOMPANHAMENTO DAS DENÚNCIAS =====
// Consulta um histórico apenas se estiver ligado a uma denúncia acessível ao usuário.
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
        ...(isResponsibleRequest(request) ? {} : { denuncia: { id_usuario } }),
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

// Registra um histórico e valida a permissão do usuário sobre a denúncia referenciada.
app.post(['/api/historicos', '/api/histories'], authenticate, async (request, response) => {
  const authenticatedUserId = readAuthUserId(request)
  const body = isRecord(request.body) ? request.body : {}
  if (!authenticatedUserId) {
    response.status(401).json({ error: 'Autenticação necessária.' })
    return
  }
  const responsibleUser = isResponsibleRequest(request)
  const responsible = readAuthPrincipalType(request) === 'RESPONSIBLE'
  const id_usuario = responsible
    ? readPositiveInt(body.id_usuario)
    : responsibleUser
      ? readPositiveInt(body.id_usuario) ?? authenticatedUserId
      : authenticatedUserId
  const id_denuncia = readPositiveInt(body.id_denuncia)
  if (typeof body.descricao !== 'string' || !body.descricao.trim() ||
      typeof body.foto !== 'string' || !body.foto.trim() ||
      typeof body.observacao !== 'string' || !body.observacao.trim() ||
      !id_denuncia || (responsibleUser && !responsible && 'id_usuario' in body && !readPositiveInt(body.id_usuario))) {
    response.status(400).json({ error: 'Informe descrição, foto, observação, usuário e denúncia válidos.' })
    return
  }
  try {
    if (!responsibleUser) {
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
        ...(responsible
          ? { responsavel: { connect: { id_responsavel: authenticatedUserId } } }
          : { usuario: { connect: { id_usuario: id_usuario ?? authenticatedUserId } } }),
        denuncia: { connect: { id_denuncia } },
      },
    })
    response.status(201).json({ historico })
  } catch (error) {
    handlePrismaError(error, response, 'create-history')
  }
})

// Atualiza dados do histórico e impede vínculos com denúncias de outros usuários.
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

  const responsibleUser = isResponsibleRequest(request)
  const data: Prisma.historicoUpdateInput = {}
  for (const field of ['descricao', 'foto', 'observacao'] as const) {
    if (!(field in body)) continue
    if (typeof body[field] !== 'string' || !body[field].trim()) {
      response.status(400).json({ error: `Campo ${field} inválido.` })
      return
    }
    data[field] = body[field].trim()
  }
  if (responsibleUser && 'id_usuario' in body) {
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
    if (!responsibleUser) {
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
        ...(responsibleUser ? {} : { id_usuario: authenticatedUserId, denuncia: { id_usuario: authenticatedUserId } }),
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

// Remove um histórico somente quando o registro pode ser acessado pela sessão atual.
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
        ...(isResponsibleRequest(request) ? {} : { id_usuario, denuncia: { id_usuario } }),
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

// ===== IA: SUGESTÃO DE RASCUNHO PARA O FRONTEND =====
// Solicita à IA um rascunho estruturado, sem criar ou enviar a denúncia automaticamente.
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
      throw new Error(`O provedor de IA retornou o status ${aiResponse.status}.`)
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
    console.error('Falha ao gerar rascunho de denúncia com IA.')
    response.status(502).json({
      error: 'Não foi possível gerar o rascunho agora. Tente novamente.',
    })
  }
})

// ===== TRATAMENTO DE ERROS DA API =====
// Converte erros inesperados e JSON malformado em respostas seguras para o cliente.
app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (isRecord(error) && (error.type === 'entity.too.large' || error.name === 'PayloadTooLargeError')) {
    response.status(413).json({ error: 'A requisição é muito grande. A foto deve ter no máximo 2 MB.' })
    return
  }
  if (error instanceof SyntaxError) {
    response.status(400).json({ error: 'Corpo da requisição inválido.' })
    return
  }
  console.error('Erro não tratado ao processar a solicitação.', {
    name: error instanceof Error ? error.name : typeof error,
    code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined,
  })
  response.status(500).json({ error: 'Não foi possível concluir a operação.' })
})

return app
}

// ===== INICIALIZAÇÃO DO SERVIDOR =====
// Inicia o servidor apenas quando este arquivo é executado diretamente.
const isMainModule = process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url

if (isMainModule) {
  const app = createApp()
  const port = Number(process.env.PORT ?? 3000)
  app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor da API em execução na porta ${port}.`)
  })
}
