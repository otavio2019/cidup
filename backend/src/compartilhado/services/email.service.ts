type EmailMessage = {
  to: string
  subject: string
  text: string
  html?: string
}

// ===== ENVIO DE E-MAILS =====
// Produção: envia por HTTPS (porta 443) pela API transacional do Brevo.
// Não usamos SMTP porque o Render Free bloqueia as portas 25, 465 e 587.
// Sem BREVO_API_KEY (desenvolvimento/testes), nada é enviado: a mensagem fica só em memória.
let testMessages: EmailMessage[] = []

const DEFAULT_BREVO_API_URL = 'https://api.brevo.com/v3'
const BREVO_TIMEOUT_MS = 15_000
const DEFAULT_SENDER = 'CidUp <no-reply@cidup.local>'

// O QUE FAZ: troca caracteres especiais por entidades HTML.
// Usado em todo valor dinâmico inserido no htmlContent (link, protocolo, status, observação).
export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// O QUE FAZ: separa "Nome <email>" em { name, email } para o campo sender do Brevo.
// Origem: SMTP_FROM (mantido para não mudar as variáveis do Render).
// Em produção, o e-mail do remetente PRECISA estar verificado no painel do Brevo.
function readSender() {
  const from = (process.env.SMTP_FROM ?? '').trim() || DEFAULT_SENDER
  const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from)
  if (match) return { name: match[1]!.trim() || 'CidUp', email: match[2]!.trim() }
  return { name: 'CidUp', email: from }
}

// O QUE FAZ: remove a chave da API de qualquer texto antes de ir para erro/log.
function redact(text: string, apiKey: string) {
  return apiKey ? text.split(apiKey).join('[redacted]') : text
}

// O QUE FAZ: chama POST {BREVO_API_URL}/smtp/email com timeout de 15 s.
// A chave vai só no header api-key; erros nunca incluem a chave.
async function sendWithBrevo(message: EmailMessage, apiKey: string) {
  const baseUrl = (process.env.BREVO_API_URL ?? '').trim().replace(/\/+$/, '') || DEFAULT_BREVO_API_URL
  const body = {
    sender: readSender(),
    to: [{ email: message.to }],
    subject: message.subject,
    textContent: message.text,
    htmlContent: message.html ?? `<p>${escapeHtml(message.text)}</p>`,
  }

  let response: Response
  try {
    response = await fetch(`${baseUrl}/smtp/email`, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(BREVO_TIMEOUT_MS),
    })
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new Error(`Brevo: tempo limite de ${BREVO_TIMEOUT_MS / 1000}s excedido.`)
    }
    const detail = error instanceof Error ? error.message : 'erro desconhecido'
    throw new Error(`Brevo: falha de conexão (${redact(detail, apiKey).slice(0, 200)}).`)
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    const summary = redact(detail.replace(/\s+/g, ' ').trim(), apiKey).slice(0, 300)
    throw new Error(`Brevo respondeu HTTP ${response.status}${summary ? `: ${summary}` : ''}`)
  }
}

// O QUE FAZ: envia um e-mail; EMAIL_DISABLED=true pula o envio.
// QUEM USA: as três funções sendXxxEmail abaixo.
// Com BREVO_API_KEY: envia pela API do Brevo. Sem ela: guarda em testMessages
// (sem envio real); em produção isso gera erro, registrado por notifySafely.
export async function sendEmail(message: EmailMessage) {
  if (process.env.EMAIL_DISABLED === 'true') return { skipped: true }
  const apiKey = (process.env.BREVO_API_KEY ?? '').trim()
  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('BREVO_API_KEY não configurada; e-mail não enviado.')
    }
    testMessages.push(message)
    return { skipped: false }
  }
  await sendWithBrevo(message, apiKey)
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
    text: `Recebemos uma solicitação para redefinir a senha da sua conta no CidUp.\n\nPara criar uma nova senha, acesse o link abaixo. Ele é válido por 30 minutos:\n${resetUrl}\n\nSe você não solicitou a redefinição, ignore este e-mail.`,
    html: `<p>Recebemos uma solicitação para redefinir a senha da sua conta no CidUp.</p><p>Para criar uma nova senha, acesse o link abaixo. Ele é válido por 30 minutos:</p><p><a href="${escapeHtml(resetUrl)}">Criar nova senha</a></p><p>Se você não solicitou a redefinição, ignore este e-mail.</p>`,
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
    html: `<p>Sua denúncia <strong>${escapeHtml(protocol)}</strong> foi recebida pelo CidUp.</p><p>Status atual: <strong>${escapeHtml(status)}</strong>.</p>`,
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
    html: `<p>A denúncia <strong>${escapeHtml(protocol)}</strong> foi atualizada para:</p><p><strong>${escapeHtml(status)}</strong></p>${observation ? `<p>Observação: ${escapeHtml(observation)}</p>` : ''}`,
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
