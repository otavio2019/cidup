// ===== CONEXÃO COM O BANCO DE DADOS =====
/** Único ponto de criação do Prisma Client usado pelas rotas da API. */
import prismaPackage from '@prisma/client'

const { PrismaClient } = prismaPackage

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL não está definida. Copie backend/.env.example para backend/.env e configure a URL de conexão do PostgreSQL.')
}

// Instancia o cliente compartilhado que as rotas acessam por meio de createApp.
export const prisma = new PrismaClient()