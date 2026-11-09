import type { Prisma } from '@prisma/client'
import { requireAdministrator } from '../../intermediarios/authenticate.js'
import { handlePrismaError } from '../../utilitarios/prismaErrors.js'
import { isRecord, readPositiveInt } from '../../utilitarios/validation.js'
import type { RouteContext } from '../context.js'

// ===== ADMIN: ÓRGÃOS =====
// Consultas são públicas (também usadas por ComplaintReviewPage.tsx);
// criar, alterar e excluir exigem responsável (ResponsiblePanelPage.tsx).
export function registerOrganizationRoutes({ app, database, authenticate }: RouteContext) {
  // Lista apenas os campos públicos dos órgãos responsáveis.
  // QUEM USA: ComplaintReviewPage.tsx e ResponsiblePanelPage.tsx.
  // MIDDLEWARE: nenhum (pública). PRISMA: orgao (findMany).
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
  // QUEM USA: nenhuma tela hoje. MIDDLEWARE: nenhum (pública). PRISMA: orgao.
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
  // QUEM USA: nenhuma tela hoje. MIDDLEWARE: authenticate, requireAdministrator.
  // PRISMA: orgao (create).
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
  // QUEM USA: nenhuma tela hoje. MIDDLEWARE: authenticate, requireAdministrator.
  // PRISMA: orgao (update).
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
  // QUEM USA: nenhuma tela hoje. MIDDLEWARE: authenticate, requireAdministrator.
  // PRISMA: denuncia (count), orgao (delete).
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
}
