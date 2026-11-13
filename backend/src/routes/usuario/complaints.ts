import type { Prisma } from '@prisma/client'
import { readAuthUserId } from '../../auth.js'
import { sendComplaintReceivedEmail, sendComplaintStatusEmail } from '../../email.js'
import { isResponsibleRequest } from '../../middlewares/authenticate.js'
import { createNotification, notifyResponsibleOrganizations, notifySafely } from '../../notifications.js'
import {
  complaintResponse,
  distanceInMeters,
  findOrganizationByComplaintType,
  NEARBY_COMPLAINT_RADIUS_METERS,
  normalizePriority,
  supportedComplaintCategories,
} from '../../utils/complaints.js'
import { handlePrismaError } from '../../utils/prismaErrors.js'
import { isRecord, isValidImageData, readPositiveInt } from '../../utils/validation.js'
import type { RouteContext } from '../context.js'

// ===== USUÁRIO: DENÚNCIAS (CONSULTA, CRIAÇÃO E ATUALIZAÇÃO) =====
// Telas ligadas: páginas de denúncia em frontend/src/pages/usuario e,
// para mudança de status, frontend/src/pages/admin/ResponsiblePanelPage.tsx.
export function registerComplaintRoutes({ app, database, authenticate }: RouteContext) {
  // Lista as denúncias próprias; administradores autorizados podem consultar todas.
  // QUEM USA: DashboardPage.tsx, MyComplaintsPage.tsx, ResponsiblePanelPage.tsx.
  // MIDDLEWARE: authenticate. CHAMA: complaintResponse. PRISMA: denuncia (findMany).
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
          orgaos_extras: { select: { id_orgao: true, nome: true } },
          usuario: { select: { id_usuario: true, nome: true, email: true, telefone: true, cpf: true, foto: true } },
          historico: {
            orderBy: { id_historico: 'desc' },
            select: { id_historico: true, descricao: true, observacao: true, foto: true, data_criacao: true },
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
  // QUEM USA: ComplaintDetailsPage.tsx. MIDDLEWARE: authenticate.
  // CHAMA: complaintResponse. PRISMA: denuncia (findFirst).
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
          orgaos_extras: { select: { id_orgao: true, nome: true } },
          usuario: { select: { id_usuario: true, nome: true, email: true, telefone: true, cpf: true, foto: true } },
          historico: {
            orderBy: { id_historico: 'desc' },
            select: { id_historico: true, descricao: true, observacao: true, foto: true, data_criacao: true },
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

  // Encontra denúncias próximas que compartilham ao menos uma categoria, mantendo protocolos separados.
  // QUEM USA: ComplaintDetailsPage.tsx. MIDDLEWARE: authenticate.
  // CHAMA: distanceInMeters. PRISMA: denuncia (findFirst, findMany).
  app.get(['/api/complaints/:id/related', '/api/denuncias/:id/relacionadas'], authenticate, async (request, response) => {
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
      // 1) Pega a denúncia de referência (cidadão só vê as próprias).
      const complaint = await database.denuncia.findFirst({
        where: {
          id_denuncia,
          ...(isResponsibleRequest(request) ? {} : { id_usuario }),
        },
        select: { id_denuncia: true, categorias: true, tipo: true, latitude: true, longitude: true },
      })
      if (!complaint) {
        response.status(404).json({ error: 'Denúncia não encontrada.' })
        return
      }

      // 2) Monta uma "caixa" em graus ao redor do ponto (~50 m) para filtrar no banco.
      //    111_320 m = tamanho aproximado de 1 grau de latitude.
      const categories = complaint.categorias?.length ? complaint.categorias : [complaint.tipo]
      const latitudeDelta = NEARBY_COMPLAINT_RADIUS_METERS / 111_320
      const longitudeDelta = Math.min(
        180,
        NEARBY_COMPLAINT_RADIUS_METERS / (111_320 * Math.max(Math.abs(Math.cos(complaint.latitude * Math.PI / 180)), 0.000001)),
      )
      // 3) Busca candidatas dentro da caixa e com ao menos uma categoria em comum.
      const candidates = await database.denuncia.findMany({
        where: {
          id_denuncia: { not: id_denuncia },
          categorias: { hasSome: categories },
          latitude: { gte: Math.max(-90, complaint.latitude - latitudeDelta), lte: Math.min(90, complaint.latitude + latitudeDelta) },
          longitude: { gte: Math.max(-180, complaint.longitude - longitudeDelta), lte: Math.min(180, complaint.longitude + longitudeDelta) },
        },
        select: {
          id_denuncia: true,
          tipo: true,
          categorias: true,
          status: true,
          latitude: true,
          longitude: true,
        },
      })
      // 4) Refina pela distância real (a caixa é quadrada) e devolve as 10 mais próximas.
      const related = candidates
        .map((candidate) => ({
          id: candidate.id_denuncia,
          protocol: `CIDUP-${candidate.id_denuncia}`,
          categories: candidate.categorias?.length ? candidate.categorias : [candidate.tipo],
          status: candidate.status,
          distanceMeters: Math.round(distanceInMeters(complaint.latitude, complaint.longitude, candidate.latitude, candidate.longitude)),
        }))
        .filter((candidate) => candidate.id !== id_denuncia
          && candidate.categories.some((category) => categories.includes(category))
          && candidate.distanceMeters <= NEARBY_COMPLAINT_RADIUS_METERS)
        .sort((a, b) => a.distanceMeters - b.distanceMeters)
        .slice(0, 10)
      response.json({ related })
    } catch (error) {
      handlePrismaError(error, response, 'find-related-complaints')
    }
  })

  // Valida e registra a denúncia, encaminhando-a automaticamente pelo tipo informado.
  // QUEM USA: ComplaintReviewPage.tsx (envio final). MIDDLEWARE: authenticate.
  // CHAMA: isValidImageData, findOrganizationByComplaintType, complaintResponse,
  // notifySafely + sendComplaintReceivedEmail (src/email.ts).
  // PRISMA: orgao (findMany), denuncia (create, com usuario e orgao).
  app.post(['/api/complaints', '/api/denuncias'], authenticate, async (request, response) => {
    // 1) Lê os campos aceitando nomes em português e inglês (tipo/type, foto/photo...).
    const body = isRecord(request.body) ? request.body : {}
    const id_usuario = readAuthUserId(request)
    const tipoValue = body.tipo ?? body.type
    const categoriesValue = body.categorias ?? body.categories
    const hasExplicitCategories = categoriesValue !== undefined
    const tituloValue = body.titulo ?? body.title ?? tipoValue
    const descricaoValue = body.descricao ?? body.description
    const enderecoValue = body.endereco ?? body.address
    const neighborhoodValue = body.bairro ?? body.neighborhood ?? (
      typeof enderecoValue === 'string' ? enderecoValue.split(',').map((part) => part.trim()).filter(Boolean).at(-1) : undefined
    )
    const latitude = body.latitude
    const longitude = body.longitude
    const photoValue = body.foto ?? body.photo
    // Opcional: prioridade vinda do rascunho da IA; valores inválidos são ignorados.
    const prioridade = normalizePriority(body.prioridade ?? body.priority)
    const categories = categoriesValue === undefined
      ? (typeof tipoValue === 'string' ? [tipoValue.trim()] : [])
      : Array.isArray(categoriesValue)
        ? [...new Set(categoriesValue.filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean))]
        : []

    // 2) Valida tipo, título, descrição, categorias (lista suportada) e coordenadas de GPS.
    if (!id_usuario) {
      response.status(401).json({ error: 'Autenticação necessária.' })
      return
    }
    if (typeof tipoValue !== 'string' || !tipoValue.trim() || tipoValue.trim().length > 100 ||
        typeof tituloValue !== 'string' || !tituloValue.trim() || tituloValue.trim().length > 200 ||
        typeof descricaoValue !== 'string' || descricaoValue.trim().length < 20 || descricaoValue.trim().length > 1000 ||
        typeof enderecoValue !== 'string' || !enderecoValue.trim() || enderecoValue.trim().length > 300 ||
        typeof neighborhoodValue !== 'string' || !neighborhoodValue.trim() || neighborhoodValue.trim().length > 150 ||
        categories.length === 0 || categories.length > supportedComplaintCategories.length ||
        (hasExplicitCategories && categories.some((category) => !supportedComplaintCategories.includes(category))) ||
        (typeof tipoValue === 'string' && categories[0] !== tipoValue.trim()) ||
        typeof latitude !== 'number' || !Number.isFinite(latitude) ||
        latitude < -90 || latitude > 90 ||
        typeof longitude !== 'number' || !Number.isFinite(longitude) ||
        longitude < -180 || longitude > 180) {
      response.status(400).json({ error: 'Informe uma ou mais categorias, descrição, latitude e longitude válidas.' })
      return
    }
    if (photoValue !== undefined && photoValue !== null && !isValidImageData(photoValue)) {
      response.status(400).json({ error: 'A foto deve ser PNG, JPG ou WEBP e ter no máximo 2 MB.' })
      return
    }
    // 3) Junta endereço + número + bairro + complemento (formato antigo) em uma linha.
    const legacyAddress = [
      enderecoValue,
      body.number,
      neighborhoodValue,
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
      // 4) Descobre o órgão de cada categoria. O primeiro é o principal;
      //    os demais viram "órgãos extras".
      const organizations = await database.orgao.findMany({
        select: { id_orgao: true, nome: true, email: true },
        orderBy: { nome: 'asc' },
      })
      const routedOrganizations = categories
        .map((category) => findOrganizationByComplaintType(category, organizations))
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
      const organization = routedOrganizations[0]
      if (!organization) {
        response.status(503).json({ error: 'Nenhum órgão disponível para encaminhar esta denúncia.' })
        return
      }
      const denuncia = await database.denuncia.create({
        data: {
          titulo: tituloValue.trim(),
          tipo: categories[0]!,
          categorias: categories,
          descricao: descricaoValue.trim(),
          status: 'RECEIVED',
          endereco,
          latitude,
          longitude,
          foto: photoValue === undefined || photoValue === null ? null : String(photoValue),
          prioridade,
          usuario: { connect: { id_usuario } },
          orgao: { connect: { id_orgao: organization.id_orgao } },
          orgaos_extras: {
            connect: [...new Map(routedOrganizations
              .filter((item) => item.id_orgao !== organization.id_orgao)
              .map((item) => [item.id_orgao, { id_orgao: item.id_orgao }])).values()],
          },
        },
        include: {
          orgao: { select: { id_orgao: true, nome: true, email: true } },
          orgaos_extras: { select: { id_orgao: true, nome: true } },
          usuario: { select: { id_usuario: true, nome: true, email: true, telefone: true, cpf: true, foto: true } },
        },
      })
      void notifySafely(() => createNotification(database, {
        title: 'Denúncia recebida',
        message: `Sua denúncia CIDUP-${denuncia.id_denuncia} foi registrada e encaminhada para atendimento.`,
        type: 'COMPLAINT_RECEIVED',
        userId: denuncia.id_usuario,
        complaintId: denuncia.id_denuncia,
      }))
      void notifySafely(() => notifyResponsibleOrganizations(database,
        routedOrganizations.map((item) => item.id_orgao),
        {
          title: 'Nova denúncia recebida',
          message: `A denúncia CIDUP-${denuncia.id_denuncia} foi encaminhada para atendimento.`,
          type: 'COMPLAINT_RECEIVED',
          complaintId: denuncia.id_denuncia,
        },
      ))
      if (denuncia.usuario?.email) {
        void notifySafely(() => sendComplaintReceivedEmail(denuncia.usuario.email, `CIDUP-${denuncia.id_denuncia}`, denuncia.status))
      }
      if (denuncia.orgao?.email) {
        void notifySafely(() => sendComplaintReceivedEmail(denuncia.orgao.email, `CIDUP-${denuncia.id_denuncia}`, denuncia.status))
      }
      response.status(201).json({ denuncia, complaint: complaintResponse(denuncia) })
    } catch (error) {
      handlePrismaError(error, response, 'create-complaint')
    }
  })

  // Atualiza uma denúncia própria, reservando mudanças de status e encaminhamento aos responsáveis.
  // QUEM USA: ResponsiblePanelPage.tsx (muda status). MIDDLEWARE: authenticate.
  // CHAMA: isResponsibleRequest, normalizePriority, complaintResponse,
  // notifySafely + sendComplaintStatusEmail. PRISMA: denuncia (findFirst, update).
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

    // 1) Cidadão NÃO pode mudar status nem órgão: isso é papel do responsável (403).
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

    // 2) Confirma que a denúncia existe e que o usuário pode alterá-la.
    try {
      const existing = await database.denuncia.findFirst({
        where: {
          id_denuncia,
          ...(responsibleUser ? {} : { id_usuario }),
        },
        include: {
          usuario: { select: { email: true } },
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
      // 3) Só avisa o cidadão por e-mail quando o status realmente mudou.
      const statusChanged = typeof data.status === 'string' && data.status !== existing.status
      if (statusChanged && denuncia.usuario?.id_usuario) {
        void notifySafely(() => createNotification(database, {
          title: 'Atualização da denúncia',
          message: `A denúncia CIDUP-${denuncia.id_denuncia} foi atualizada para ${denuncia.status}.`,
          type: 'COMPLAINT_STATUS',
          userId: denuncia.usuario.id_usuario,
          complaintId: denuncia.id_denuncia,
        }))
      }
      if (statusChanged && denuncia.usuario?.email) {
        void notifySafely(() => sendComplaintStatusEmail(
          denuncia.usuario.email,
          `CIDUP-${denuncia.id_denuncia}`,
          denuncia.status,
          typeof body.observacao === 'string' ? body.observacao.trim() : undefined,
        ))
      }
      response.json({ denuncia, complaint: complaintResponse(denuncia) })
    } catch (error) {
      handlePrismaError(error, response, 'update-complaint')
    }
  })

  // Exclui uma denúncia própria ou administrativa somente se não houver histórico associado.
  // QUEM USA: DashboardPage.tsx (excluir). MIDDLEWARE: authenticate.
  // PRISMA: denuncia (findFirst, delete), historico (count).
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
}
