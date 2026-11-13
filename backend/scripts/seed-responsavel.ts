import 'dotenv/config'
import { randomBytes, scrypt as scryptCallback } from 'node:crypto'
import { promisify } from 'node:util'
import { prisma } from '../src/biblioteca/prisma.js'

// ===== SEED DO RESPONSÁVEL =====
// Rodar com: npm run seed:responsavel (package.json do backend).
// Cria ou atualiza o responsável que entra pelo login do painel (ResponsiblePanelPage.tsx).
const scrypt = promisify(scryptCallback)

// O QUE FAZ: lê uma variável obrigatória do backend/.env ou aborta com erro.
// QUEM USA: main (neste arquivo).
function requiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Defina ${name} no backend/.env antes de executar o seed.`)
  return value
}

// O QUE FAZ: gera o hash scrypt no formato "salt:hash" para guardar em responsavel.senha.
// QUEM USA: main (neste arquivo).
// Por quê: a senha nunca é salva em texto puro. O login (POST /api/auth/login em
//   backend/src/routes/auth/login.ts) precisa ler este mesmo formato.
async function hashPassword(password: string) {
  if (password.length < 6 || password.length > 1024) {
    throw new Error('RESPONSAVEL_PASSWORD deve conter entre 6 e 1024 caracteres.')
  }
  const salt = randomBytes(16).toString('hex')
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer
  return `${salt}:${derivedKey.toString('hex')}`
}

// O QUE FAZ: valida as variáveis RESPONSAVEL_* e faz upsert do responsável por e-mail.
// QUEM USA: execução direta do script (await main() no fim do arquivo).
// CHAMA: requiredEnv, hashPassword e prisma.responsavel.upsert (lib/prisma.ts).
async function main() {
  // 1) Lê e valida os dados do ambiente.
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

  // 2) Cria o responsável ou atualiza se o e-mail já existir; vincula ao órgão.
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

// Sempre fecha a conexão com o banco, mesmo se main falhar.
try {
  await main()
} finally {
  await prisma.$disconnect()
}
