import prismaPackage from '@prisma/client'

const { PrismaClient } = prismaPackage

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined. Copy backend/.env.example to backend/.env and set your PostgreSQL connection string.')
}

export const prisma = new PrismaClient()