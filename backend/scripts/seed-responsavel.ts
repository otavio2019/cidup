import 'dotenv/config'
import { randomBytes, scrypt as scryptCallback } from 'node:crypto'
import { promisify } from 'node:util'
import { prisma } from '../src/lib/prisma.js'

const scrypt = promisify(scryptCallback)

function requiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Defina ${name} no backend/.env antes de executar o seed.`)
  return value
}

async function hashPassword(password: string) {
  if (password.length < 6 || password.length > 1024) {
    throw new Error('RESPONSAVEL_PASSWORD deve conter entre 6 e 1024 caracteres.')
  }
  const salt = randomBytes(16).toString('hex')
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer
  return `${salt}:${derivedKey.toString('hex')}`
}

async function main() {
  const nome = requiredEnv('RESPONSAVEL_NAME')
  const email = requiredEnv('RESPONSAVEL_EMAIL').toLowerCase()
  const telefone = requiredEnv('RESPONSAVEL_PHONE')
  const senha = await hashPassword(requiredEnv('RESPONSAVEL_PASSWORD'))
  const id_orgao = Number(requiredEnv('RESPONSAVEL_ORGAO_ID'))

  if (!Number.isSafeInteger(id_orgao) || id_orgao <= 0) {
    throw new Error('RESPONSAVEL_ORGAO_ID deve ser um ID positivo.')
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
    throw new Error('RESPONSAVEL_EMAIL deve ser um e-mail válido.')
  }
  if (nome.length < 2 || nome.length > 150 || telefone.length > 20) {
    throw new Error('RESPONSAVEL_NAME ou RESPONSAVEL_PHONE excede o tamanho permitido.')
  }

  const responsible = await prisma.responsavel.upsert({
    where: { email },
    create: {
      nome,
      email,
      telefone,
      senha,
      orgao: { connect: { id_orgao } },
    },
    update: {
      nome,
      telefone,
      senha,
      orgao: { connect: { id_orgao } },
    },
    select: { id_responsavel: true, nome: true, email: true, id_orgao: true },
  })

  console.log(`Responsável sincronizado: ${responsible.nome} <${responsible.email}> (id ${responsible.id_responsavel}, órgão ${responsible.id_orgao})`)
}

try {
  await main()
} finally {
  await prisma.$disconnect()
}
