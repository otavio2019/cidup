import 'dotenv/config'
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import cors from 'cors'
import express from 'express'
import { prisma } from './lib/prisma.js'

const app = express()
const port = Number(process.env.PORT ?? 3000)
const scrypt = promisify(scryptCallback)

const complaintStatuses = [
  'RECEIVED',
  'IN_ANALYSIS',
  'FORWARDED',
  'IN_SERVICE',
  'RESOLVED',
  'NOT_SERVED',
] as const

app.use(cors())
app.use(express.json())

function readUserId(request: express.Request) {
  const value = request.header('x-user-id')
  const userId = Number(value)
  return Number.isInteger(userId) && userId > 0 ? userId : null
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer
  return `${salt}:${derivedKey.toString('hex')}`
}

async function verifyPassword(password: string, storedHash: string) {
  const [salt, key] = storedHash.split(':')
  if (!salt || !key) return false

  const derivedKey = (await scrypt(password, salt, 64)) as Buffer
  const storedKey = Buffer.from(key, 'hex')
  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey)
}

function protocol() {
  return `CIDUP-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`
}

function complaintInput(body: Record<string, unknown>) {
  const type = typeof body.type === 'string' ? body.type.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const address = typeof body.address === 'string' ? body.address.trim() : ''
  const number = typeof body.number === 'string' ? body.number.trim() : ''
  const neighborhood = typeof body.neighborhood === 'string' ? body.neighborhood.trim() : ''
  const complement = typeof body.complement === 'string' ? body.complement.trim() : ''
  const title = typeof body.title === 'string' ? body.title.trim() : type

  if (!type || description.length < 20 || !address || !number || !neighborhood) {
    return null
  }

  return { type, title: title || type, description, address, number, neighborhood, complement }
}

// NOTE: esta rota confirma apenas que o servidor Express está ativo.
app.get('/health', (_request, response) => {
  response.json({ status: 'ok' })
})

app.post('/api/auth/register', async (request, response) => {
  const { name, email, password } = request.body as Record<string, unknown>
  if (typeof name !== 'string' || name.trim().length < 2 || typeof email !== 'string' || typeof password !== 'string' || password.length < 6) {
    response.status(400).json({ error: 'Informe nome, e-mail e uma senha com pelo menos 6 caracteres.' })
    return
  }

  try {
    const user = await prisma.user.create({
      data: { name: name.trim(), email: email.trim().toLowerCase(), passwordHash: await hashPassword(password) },
      select: { id: true, name: true, email: true, role: true },
    })
    response.status(201).json({ user })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      response.status(409).json({ error: 'Este e-mail já está cadastrado.' })
      return
    }
    response.status(500).json({ error: 'Não foi possível criar o cadastro.' })
  }
})

app.post('/api/auth/login', async (request, response) => {
  const { email, password } = request.body as Record<string, unknown>
  if (typeof email !== 'string' || typeof password !== 'string') {
    response.status(400).json({ error: 'Informe e-mail e senha.' })
    return
  }

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    response.status(401).json({ error: 'E-mail ou senha inválidos.' })
    return
  }
  response.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, token: String(user.id) })
})

app.get('/api/complaints', async (request, response) => {
  const userId = readUserId(request)
  if (!userId) {
    response.status(401).json({ error: 'Faça login para consultar suas denúncias.' })
    return
  }

  const complaints = await prisma.complaint.findMany({
    where: { userId },
    include: { type: true },
    orderBy: { createdAt: 'desc' },
  })
  response.json({ complaints })
})

app.post('/api/complaints', async (request, response) => {
  const userId = readUserId(request)
  const input = complaintInput(request.body as Record<string, unknown>)
  if (!userId) {
    response.status(401).json({ error: 'Faça login para registrar uma denúncia.' })
    return
  }
  if (!input) {
    response.status(400).json({ error: 'Preencha tipo, descrição, endereço, número e bairro.' })
    return
  }

  const type = await prisma.complaintType.upsert({
    where: { name: input.type },
    update: {},
    create: { name: input.type },
  })
  const complaint = await prisma.complaint.create({
    data: {
      protocol: protocol(),
      title: input.title,
      description: input.description,
      address: input.address,
      number: input.number,
      neighborhood: input.neighborhood,
      complement: input.complement || null,
      userId,
      typeId: type.id,
    },
    include: { type: true },
  })
  response.status(201).json({ complaint })
})

app.patch('/api/complaints/:id', async (request, response) => {
  const userId = readUserId(request)
  const complaintId = Number(request.params.id)
  if (!userId || !Number.isInteger(complaintId)) {
    response.status(400).json({ error: 'Identificação inválida.' })
    return
  }

  const body = request.body as Record<string, unknown>
  const data: Record<string, string> = {}
  for (const field of ['title', 'description', 'address', 'number', 'neighborhood', 'complement'] as const) {
    if (typeof body[field] === 'string') data[field] = body[field].trim()
  }
  if (typeof body.status === 'string' && complaintStatuses.includes(body.status as typeof complaintStatuses[number])) {
    data.status = body.status
  }
  if (typeof body.type === 'string' && body.type.trim()) {
    const type = await prisma.complaintType.upsert({ where: { name: body.type.trim() }, update: {}, create: { name: body.type.trim() } })
    data.typeId = String(type.id)
  }

  const existing = await prisma.complaint.findFirst({ where: { id: complaintId, userId } })
  if (!existing) {
    response.status(404).json({ error: 'Denúncia não encontrada.' })
    return
  }
  const updateData = { ...data }
  delete updateData.typeId
  const complaint = await prisma.complaint.update({ where: { id: complaintId }, data: { ...updateData, ...(data.typeId ? { typeId: Number(data.typeId) } : {}) }, include: { type: true } })
  response.json({ complaint })
})

app.delete('/api/complaints/:id', async (request, response) => {
  const userId = readUserId(request)
  const complaintId = Number(request.params.id)
  if (!userId || !Number.isInteger(complaintId)) {
    response.status(400).json({ error: 'Identificação inválida.' })
    return
  }
  const deleted = await prisma.complaint.deleteMany({ where: { id: complaintId, userId } })
  if (deleted.count === 0) {
    response.status(404).json({ error: 'Denúncia não encontrada.' })
    return
  }
  response.status(204).send()
})

app.post('/api/ai/complaint-draft', async (request, response) => {
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
    console.error('AI complaint draft failed:', error)
    response.status(502).json({
      error: 'Não foi possível gerar o rascunho agora. Tente novamente.',
    })
  }
})

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`)
})
