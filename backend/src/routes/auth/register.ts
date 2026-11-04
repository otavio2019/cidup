import type express from 'express'
import { registerRateLimit } from '../../middlewares/rateLimits.js'
import { hashPassword } from '../../utils/passwords.js'
import { handlePrismaError } from '../../utils/prismaErrors.js'
import { digits, isRecord, isValidCep, isValidCpf } from '../../utils/validation.js'
import type { RouteContext } from '../context.js'

// ===== AUTENTICAÇÃO: CADASTRO =====
// Tela ligada: frontend/src/pages/auth/RegisterPage.tsx.
export function registerRegisterRoutes({ app, database }: RouteContext) {
  // Valida os campos do cadastro e cria um usuário sem expor a senha armazenada.
  async function registerUser(request: express.Request, response: express.Response) {
    // 1) Limpa os dados recebidos (trim, minúsculas no e-mail, só dígitos em CPF/CEP).
    const body = isRecord(request.body) ? request.body : {}
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
    const cpf = digits(body.cpf)
    const cep = digits(body.cep)
    const password = body.password

    if (name.length < 2 || name.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255 ||
        !phone || phone.length > 20 || typeof password !== 'string' || password.length < 6 || password.length > 1024) {
      response.status(400).json({ error: 'Informe nome, e-mail, telefone, CPF, CEP e uma senha válida.' })
      return
    }
    if (!isValidCpf(body.cpf)) {
      response.status(400).json({ error: 'CPF inválido. Confira os números digitados.' })
      return
    }
    if (!isValidCep(body.cep)) {
      response.status(400).json({ error: 'CEP inválido. Informe 8 números no formato 00000-000.' })
      return
    }

    // 2) Grava com a senha já em hash. Duplicados (e-mail/CPF/telefone) caem no
    //    handlePrismaError como 409.
    try {
      const user = await database.usuario.create({
        data: { nome: name, email, telefone: phone, cpf, cep, senha: await hashPassword(password) },
        select: { id_usuario: true, nome: true, email: true, telefone: true, cpf: true, cep: true, foto: true },
      })
      response.status(201).json({ user })
    } catch (error) {
      handlePrismaError(error, response, 'register-user')
    }
  }

  // Recebe o cadastro iniciado pelo formulário do frontend e encaminha os dados ao Prisma.
  // QUEM USA: RegisterPage.tsx (POST /api/auth/register).
  // MIDDLEWARE: registerRateLimit. CHAMA: registerUser, que usa isValidCpf, isValidCep,
  // hashPassword. PRISMA: usuario (create).
  app.post(['/api/auth/register', '/api/users', '/api/usuarios'], registerRateLimit, registerUser)
}
