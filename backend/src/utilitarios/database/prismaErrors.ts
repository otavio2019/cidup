import { Prisma } from '@prisma/client'
import type express from 'express'

// ===== ERROS DO BANCO DE DADOS =====
// Traduz erros conhecidos do Prisma e oculta detalhes internos nos demais casos.
// P2025 = não encontrado (404) | P2002 = dado duplicado (409) | P2003 = relação inválida (409).
// Qualquer outro erro vira 500 genérico, sem vazar detalhes.
// QUEM USA: o catch de quase todas as rotas.
export function handlePrismaError(error: unknown, response: express.Response, operation: string) {
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
