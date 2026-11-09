// ===== VALIDAÇÃO DE DADOS =====
// Funções pequenas e reutilizadas pelas rotas (routes/auth, routes/usuario e routes/admin).
// Converte um valor em inteiro positivo seguro, ou devolve null.
// QUEM USA: rotas com :id (ex.: /api/complaints/:id, /api/organizations/:id).
export function readPositiveInt(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

// Garante que um dado desconhecido seja um objeto simples antes de ler suas propriedades.
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Remove caracteres não numéricos para validar CPF, CEP e outros campos numéricos.
export function digits(value: unknown) {
  return typeof value === 'string' ? value.replace(/\D/g, '') : ''
}

// Confere o formato e os dígitos verificadores antes do cadastro ou da atualização do perfil.
export function isValidCpf(value: unknown) {
  const cpf = digits(value)
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false
  let sum = 0
  for (let index = 0; index < 9; index += 1) sum += Number(cpf[index]) * (10 - index)
  let digit = (sum * 10) % 11
  if (digit === 10) digit = 0
  if (digit !== Number(cpf[9])) return false
  sum = 0
  for (let index = 0; index < 10; index += 1) sum += Number(cpf[index]) * (11 - index)
  digit = (sum * 10) % 11
  if (digit === 10) digit = 0
  return digit === Number(cpf[10])
}

// Confere se o CEP informado pelo frontend contém exatamente oito dígitos.
export function isValidCep(value: unknown) {
  return /^\d{8}$/.test(digits(value))
}

// Tamanho máximo de foto: 2 MB (já decodificada de base64).
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024

// Valida o formato e o tamanho das imagens recebidas nas rotas de perfil e denúncia.
export function isValidImageData(value: unknown) {
  if (typeof value !== 'string') return false
  const match = value.match(/^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/)
  const encodedImage = match?.[1]
  if (!encodedImage) return false
  try {
    return Buffer.from(encodedImage, 'base64').length <= MAX_IMAGE_BYTES
  } catch {
    return false
  }
}
