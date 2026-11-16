import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

// ===== SENHAS E TOKENS DE RECUPERAÇÃO =====
const scrypt = promisify(scryptCallback)

// Armazena a senha como salt aleatório e derivação scrypt, nunca em texto puro.
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer
  return `${salt}:${derivedKey.toString('hex')}`
}

// Recalcula o hash e compara os bytes em tempo constante para validar uma senha.
export async function verifyPassword(password: string, storedHash: string) {
  const [salt, key] = storedHash.split(':')
  if (!salt || !/^[a-f0-9]{32}$/i.test(salt) || !key || !/^[a-f0-9]{128}$/i.test(key)) return false

  const derivedKey = (await scrypt(password, salt, 64)) as Buffer
  const storedKey = Buffer.from(key, 'hex')
  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey)
}

// Guarda só o hash SHA-256 do token de recuperação; o token original vai apenas no e-mail.
// QUEM USA: rotas de recuperação de senha (forgot-password e reset-password).
export function hashResetToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}
