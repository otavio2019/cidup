import test from 'node:test'
import assert from 'node:assert/strict'
import { clearTestEmails, getTestEmails, sendComplaintStatusEmail, sendPasswordResetEmail } from './email.js'

test('captura e-mails de recuperação sem SMTP real', async () => {
  delete process.env.SMTP_HOST
  delete process.env.EMAIL_DISABLED
  clearTestEmails()
  await sendPasswordResetEmail('cidadao@example.test', 'http://localhost:5173/recuperar-senha/nova?token=abc')
  const [message] = getTestEmails()
  assert.equal(message?.to, 'cidadao@example.test')
  assert.match(message?.subject ?? '', /Recuperação de senha/)
  assert.match(message?.text ?? '', /token=abc/)
})

test('não envia quando EMAIL_DISABLED está ativado', async () => {
  process.env.EMAIL_DISABLED = 'true'
  clearTestEmails()
  await sendComplaintStatusEmail('cidadao@example.test', 'CIDUP-1', 'RESOLVED')
  assert.equal(getTestEmails().length, 0)
  delete process.env.EMAIL_DISABLED
})
