import type { Prisma } from '@prisma/client'
import { readAuthPrincipalType, readAuthUserId } from '../../auth.js'
import { isResponsibleRequest } from '../../middlewares/authenticate.js'
import { createNotification, notifySafely } from '../../notifications.js'
import { handlePrismaError } from '../../utils/prismaErrors.js'
import { isRecord, readPositiveInt } from '../../utils/validation.js'
import type { RouteContext } from '../context.js'

// ===== USUÁRIO: HISTÓRICO DAS DENÚNCIAS =====
// O registro de mudança de status é feito por frontend/src/pages/admin/ResponsiblePanelPage.tsx.
export function registerHistoryRoutes({ app, database, authenticate }: RouteContext) {
  // Lista históricos das denúncias próprias, liberando todos os registros a administradores.
  // QUEM USA: nenhuma tela hoje. MIDDLEWARE: authenticate. PRISMA: historico.
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

  // Consulta um histórico apenas se estiver ligado a uma denúncia acessível ao usuário.
  // QUEM USA: nenhuma tela hoje. MIDDLEWARE: authenticate. PRISMA: historico.
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
  // QUEM USA: ResponsiblePanelPage.tsx (registra a mudança de status).
  // MIDDLEWARE: authenticate. PRISMA: denuncia (checa dono), historico (create).
  app.post(['/api/historicos', '/api/histories'], authenticate, async (request, response) => {
    const authenticatedUserId = readAuthUserId(request)
    const body = isRecord(request.body) ? request.body : {}
    if (!authenticatedUserId) {
      response.status(401).json({ error: 'Autenticação necessária.' })
      return
    }
    // `responsible` = sessão de responsável: o histórico fica ligado a ele (id_responsavel).
    // Cidadão: o histórico fica ligado a ele (id_usuario).
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
      const complaintForNotification = await database.denuncia.findUnique({
        where: { id_denuncia },
        select: { id_usuario: true },
      })
      if (!complaintForNotification) {
        response.status(404).json({ error: 'Denúncia não encontrada.' })
        return
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
      if (responsible) {
        void notifySafely(() => createNotification(database, {
          title: 'Nova observação na denúncia',
          message: `O responsável adicionou uma observação à denúncia CIDUP-${id_denuncia}.`,
          type: 'COMPLAINT_OBSERVATION',
          userId: complaintForNotification.id_usuario,
          complaintId: id_denuncia,
        }))
      }
      response.status(201).json({ historico })
    } catch (error) {
      handlePrismaError(error, response, 'create-history')
    }
  })

  // Atualiza dados do histórico e impede vínculos com denúncias de outros usuários.
  // QUEM USA: nenhuma tela hoje. MIDDLEWARE: authenticate.
  // PRISMA: denuncia (checa dono), historico (findFirst, update).
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
  // QUEM USA: nenhuma tela hoje. MIDDLEWARE: authenticate.
  // PRISMA: historico (findFirst, delete).
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
}
