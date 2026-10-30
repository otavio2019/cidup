import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

type EmailMessage = {
  to: string
  subject: string
  text: string
  html?: string
}

let testMessages: EmailMessage[] = []

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

export function getTestEmails() {
  return [...testMessages]
}

export function clearTestEmails() {
  testMessages = []
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  return sendEmail({
    to,
    subject: 'Recuperação de senha — CidUp',
    text: `Recebemos uma solicitação para trocar sua senha no CidUp. Acesse este link em até 30 minutos: ${resetUrl}\n\nSe você não fez esta solicitação, ignore este e-mail.`,
    html: `<p>Recebemos uma solicitação para trocar sua senha no CidUp.</p><p><a href="${resetUrl}">Criar nova senha</a> (válido por 30 minutos)</p><p>Se você não fez esta solicitação, ignore este e-mail.</p>`,
  })
}

export async function sendComplaintReceivedEmail(to: string, protocol: string, status: string) {
  return sendEmail({
    to,
    subject: `Denúncia ${protocol} recebida — CidUp`,
    text: `Sua denúncia ${protocol} foi recebida pelo CidUp. Status atual: ${status}.`,
    html: `<p>Sua denúncia <strong>${protocol}</strong> foi recebida pelo CidUp.</p><p>Status atual: <strong>${status}</strong>.</p>`,
  })
}

export async function sendComplaintStatusEmail(to: string, protocol: string, status: string, observation?: string) {
  return sendEmail({
    to,
    subject: `Atualização da denúncia ${protocol} — CidUp`,
    text: `A denúncia ${protocol} foi atualizada para: ${status}.${observation ? ` Observação: ${observation}` : ''}`,
    html: `<p>A denúncia <strong>${protocol}</strong> foi atualizada para:</p><p><strong>${status}</strong></p>${observation ? `<p>Observação: ${observation}</p>` : ''}`,
  })
}
