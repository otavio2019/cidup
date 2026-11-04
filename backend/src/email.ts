import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

type EmailMessage = {
  to: string
  subject: string
  text: string
  html?: string
}

// ===== ENVIO DE E-MAILS =====
// Sem SMTP configurado, as mensagens ficam só em memória (modo teste).
let testMessages: EmailMessage[] = []

// O QUE FAZ: monta o transporte SMTP; sem host/usuário/senha, usa jsonTransport (não envia).
// QUEM USA: sendEmail (neste arquivo).
// Variáveis: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_SECURE.
function createTransport(): Transporter {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT ?? 587)
  const user = process.env.SMTP_USER
  const password = process.env.SMTP_PASSWORD

  if (host && user && password) {
    return nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass: password },
    })
  }

  return nodemailer.createTransport({ jsonTransport: true })
}

// O QUE FAZ: envia um e-mail; EMAIL_DISABLED=true pula o envio.
// QUEM USA: as três funções sendXxxEmail abaixo.
// CHAMA: createTransport. Guarda cópia em testMessages quando não há SMTP_HOST.
export async function sendEmail(message: EmailMessage) {
  if (process.env.EMAIL_DISABLED === 'true') return { skipped: true }
  if (!process.env.SMTP_HOST) testMessages.push(message)
  const transporter = createTransport()
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? 'CidUp <no-reply@cidup.local>',
    ...message,
  })
  return { skipped: false }
}

// O QUE FAZ: devolve uma cópia dos e-mails guardados em memória.
// QUEM USA: apenas testes (backend/tests/email.test.ts).
export function getTestEmails() {
  return [...testMessages]
}

// O QUE FAZ: limpa os e-mails guardados em memória.
// QUEM USA: apenas testes (backend/tests/email.test.ts).
export function clearTestEmails() {
  testMessages = []
}

// O QUE FAZ: envia o link de recuperação de senha (válido por 30 minutos).
// QUEM USA: backend/src/routes/auth/passwordRecovery.ts, rota POST /api/auth/forgot-password.
// CHAMA: sendEmail. Telas ligadas: ForgotPasswordPage.tsx e ResetPasswordPage.tsx.
export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  return sendEmail({
    to,
    subject: 'Recuperação de senha — CidUp',
    text: `Recebemos uma solicitação para trocar sua senha no CidUp. Acesse este link em até 30 minutos: ${resetUrl}\n\nSe você não fez esta solicitação, ignore este e-mail.`,
    html: `<p>Recebemos uma solicitação para trocar sua senha no CidUp.</p><p><a href="${resetUrl}">Criar nova senha</a> (válido por 30 minutos)</p><p>Se você não fez esta solicitação, ignore este e-mail.</p>`,
  })
}

// O QUE FAZ: avisa que a denúncia foi recebida (protocolo e status atual).
// QUEM USA: backend/src/routes/usuario/complaints.ts, rota POST /api/complaints (cidadão e órgão).
// CHAMA: sendEmail.
export async function sendComplaintReceivedEmail(to: string, protocol: string, status: string) {
  return sendEmail({
    to,
    subject: `Denúncia ${protocol} recebida — CidUp`,
    text: `Sua denúncia ${protocol} foi recebida pelo CidUp. Status atual: ${status}.`,
    html: `<p>Sua denúncia <strong>${protocol}</strong> foi recebida pelo CidUp.</p><p>Status atual: <strong>${status}</strong>.</p>`,
  })
}

// O QUE FAZ: avisa que o status da denúncia mudou (com observação opcional).
// QUEM USA: backend/src/routes/usuario/complaints.ts, rota PATCH /api/complaints/:id; backend/tests/email.test.ts.
// CHAMA: sendEmail.
export async function sendComplaintStatusEmail(to: string, protocol: string, status: string, observation?: string) {
  return sendEmail({
    to,
    subject: `Atualização da denúncia ${protocol} — CidUp`,
    text: `A denúncia ${protocol} foi atualizada para: ${status}.${observation ? ` Observação: ${observation}` : ''}`,
    html: `<p>A denúncia <strong>${protocol}</strong> foi atualizada para:</p><p><strong>${status}</strong></p>${observation ? `<p>Observação: ${observation}</p>` : ''}`,
  })
}

// O QUE FAZ: executa o envio de e-mail sem derrubar a rota se ele falhar.
// A falha só é registrada no console; a resposta ao usuário segue normal.
// QUEM USA: rotas de recuperação de senha e de denúncias.
export async function notifySafely(action: () => Promise<unknown>) {
  try {
    await action()
  } catch (error) {
    console.error('Falha ao enviar e-mail transacional:', error instanceof Error ? error.message : 'erro desconhecido')
  }
}
