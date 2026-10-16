import prismaPackage from '@prisma/client'

const { PrismaClient } = prismaPackage

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL não está definida. Copie backend/.env.example para backend/.env e configure a URL de conexão do PostgreSQL.')
}

export const prisma = new PrismaClient()