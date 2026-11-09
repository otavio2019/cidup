import type { Prisma } from '@prisma/client'
import { readAuthUserId } from '../../auth.js'
import { hashPassword } from '../../utilitarios/passwords.js'
import { handlePrismaError } from '../../utilitarios/prismaErrors.js'
import { digits, isRecord, isValidCep, isValidCpf, isValidImageData, readPositiveInt } from '../../utilitarios/validation.js'
import type { RouteContext } from '../context.js'

// ===== USUÁRIO: PERFIL E GERENCIAMENTO DA PRÓPRIA CONTA =====
// Tela ligada: frontend/src/pages/usuario/ProfilePage.tsx.
export function registerProfileRoutes({ app, database, authenticate }: RouteContext) {
  // Retorna somente o perfil do usuário autenticado.
  // QUEM USA: nenhuma tela hoje (o perfil vem de /api/auth/session).
  // MIDDLEWARE: authenticate. PRISMA: usuario (findUnique).
  app.get(['/api/users', '/api/usuarios'], authenticate, async (request, response) => {
    const id_usuario = readAuthUserId(request)
    if (!id_usuario) {
      response.status(401).json({ error: 'Autenticação necessária.' })
      return
    }
    try {
      const user = await database.usuario.findUnique({
        where: { id_usuario },
        select: { id_usuario: true, nome: true, email: true, telefone: true, cpf: true, cep: true, foto: true },
      })
      if (!user) {
        response.status(404).json({ error: 'Usuário não encontrado.' })
        return
      }
      response.json({ users: [user] })
    } catch (error) {
      handlePrismaError(error, response, 'list-own-user')
    }
  })

  // Consulta o perfil apenas quando o ID solicitado pertence à própria sessão.
  // QUEM USA: nenhuma tela hoje. MIDDLEWARE: authenticate. PRISMA: usuario.
  app.get(['/api/users/:id', '/api/usuarios/:id'], authenticate, async (request, response) => {
    const authenticatedUserId = readAuthUserId(request)
    const requestedUserId = readPositiveInt(request.params.id)
    if (!authenticatedUserId) {
      response.status(401).json({ error: 'Autenticação necessária.' })
      return
    }
    if (!requestedUserId) {
      response.status(400).json({ error: 'Identificação do usuário inválida.' })
      return
    }
    if (requestedUserId !== authenticatedUserId) {
      response.status(404).json({ error: 'Usuário não encontrado.' })
      return
    }

    try {
      const user = await database.usuario.findUnique({
        where: { id_usuario: authenticatedUserId },
        select: { id_usuario: true, nome: true, email: true, telefone: true, cpf: true, cep: true, foto: true },
      })
      if (!user) {
        response.status(404).json({ error: 'Usuário não encontrado.' })
        return
      }
      response.json({ user })
    } catch (error) {
      handlePrismaError(error, response, 'read-own-user')
    }
  })

  // Valida e atualiza campos permitidos exclusivamente no perfil do usuário autenticado.
  // QUEM USA: ProfilePage.tsx (salvar perfil). MIDDLEWARE: authenticate.
  // CHAMA: isValidCpf, isValidCep, isValidImageData, hashPassword. PRISMA: usuario (update).
  app.patch(['/api/users/:id', '/api/usuarios/:id'], authenticate, async (request, response) => {
    // Segurança: a SESSÃO define o usuário; o :id da URL só é conferido contra ela.
    // ID diferente devolve 404 (não revela se o outro usuário existe).
    const authenticatedUserId = readAuthUserId(request)
    const requestedUserId = readPositiveInt(request.params.id)
    const body = isRecord(request.body) ? request.body : {}
    if (!authenticatedUserId) {
      response.status(401).json({ error: 'Autenticação necessária.' })
      return
    }
    if (!requestedUserId) {
      response.status(400).json({ error: 'Identificação do usuário inválida.' })
      return
    }
    if (requestedUserId !== authenticatedUserId) {
      response.status(404).json({ error: 'Usuário não encontrado.' })
      return
    }

    // Só entram em `data` os campos que vieram no corpo (atualização parcial).
    // Aceita nomes em português e inglês (nome/name, telefone/phone, foto/photo).
    const data: Prisma.usuarioUpdateInput = {}
    if ('name' in body || 'nome' in body) {
      const nome = body.nome ?? body.name
      if (typeof nome !== 'string' || nome.trim().length < 2 || nome.trim().length > 150) {
        response.status(400).json({ error: 'Nome inválido.' })
        return
      }
      data.nome = nome.trim()
    }
    if ('email' in body) {
      if (typeof body.email !== 'string' || !body.email.trim() || body.email.trim().length > 255) {
        response.status(400).json({ error: 'E-mail inválido.' })
        return
      }
      data.email = body.email.trim().toLowerCase()
    }
    if ('phone' in body || 'telefone' in body) {
      const telefone = body.telefone ?? body.phone
      if (typeof telefone !== 'string' || !telefone.trim() || telefone.trim().length > 20) {
        response.status(400).json({ error: 'Telefone inválido.' })
        return
      }
      data.telefone = telefone.trim()
    }
    if ('cpf' in body) {
      if (!isValidCpf(body.cpf)) {
        response.status(400).json({ error: 'CPF inválido.' })
        return
      }
      data.cpf = digits(body.cpf)
    }
    if ('cep' in body) {
      if (!isValidCep(body.cep)) {
        response.status(400).json({ error: 'CEP inválido.' })
        return
      }
      data.cep = digits(body.cep)
    }
    if ('photo' in body || 'foto' in body) {
      const photo = body.photo ?? body.foto
      if (photo !== null && !isValidImageData(photo)) {
        response.status(400).json({ error: 'Foto inválida. Use PNG, JPG ou WEBP de até 2 MB.' })
        return
      }
      data.foto = photo === null ? null : String(photo)
    }
    if ('password' in body || 'senha' in body) {
      const senha = body.senha ?? body.password
      if (typeof senha !== 'string' || senha.length < 6 || senha.length > 1024) {
        response.status(400).json({ error: 'A senha deve ter entre 6 e 1024 caracteres.' })
        return
      }
      data.senha = await hashPassword(senha)
    }
    if (Object.keys(data).length === 0) {
      response.status(400).json({ error: 'Informe pelo menos um campo para atualizar.' })
      return
    }

    try {
      const user = await database.usuario.update({
        where: { id_usuario: authenticatedUserId },
        data,
        select: { id_usuario: true, nome: true, email: true, telefone: true, cpf: true, cep: true, foto: true },
      })
      response.json({ user })
    } catch (error) {
      handlePrismaError(error, response, 'update-own-user')
    }
  })

  // Exclui o próprio usuário somente quando não há denúncias ou históricos vinculados.
  // QUEM USA: nenhuma tela hoje. MIDDLEWARE: authenticate.
  // PRISMA: denuncia e historico (count), usuario (delete).
  app.delete(['/api/users/:id', '/api/usuarios/:id'], authenticate, async (request, response) => {
    const authenticatedUserId = readAuthUserId(request)
    const requestedUserId = readPositiveInt(request.params.id)
    if (!authenticatedUserId) {
      response.status(401).json({ error: 'Autenticação necessária.' })
      return
    }
    if (!requestedUserId) {
      response.status(400).json({ error: 'Identificação do usuário inválida.' })
      return
    }
    if (requestedUserId !== authenticatedUserId) {
      response.status(404).json({ error: 'Usuário não encontrado.' })
      return
    }

    try {
      const [complaints, histories] = await Promise.all([
        database.denuncia.count({ where: { id_usuario: authenticatedUserId } }),
        database.historico.count({ where: { id_usuario: authenticatedUserId } }),
      ])
      if (complaints > 0 || histories > 0) {
        response.status(409).json({ error: 'Não é possível excluir um usuário com denúncias ou históricos vinculados.' })
        return
      }
      await database.usuario.delete({ where: { id_usuario: authenticatedUserId } })
      response.status(204).send()
    } catch (error) {
      handlePrismaError(error, response, 'delete-own-user')
    }
  })
}
