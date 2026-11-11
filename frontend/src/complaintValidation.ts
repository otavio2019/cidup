import type { AiComplaintForm } from './aiComplaintDraft'

export type ComplaintErrors = Partial<Record<keyof AiComplaintForm | 'photo', string>>

export function validateComplaintForm(
  form: AiComplaintForm,
  photoError?: string,
): ComplaintErrors {
  const errors: ComplaintErrors = {}
  const description = form.description.trim()

  if (photoError) errors.photo = photoError

  if (form.categories.length === 0) {
    errors.type = 'Selecione ao menos uma ocorrência.'
  }

  if (!description) {
    errors.description = 'Descreva o problema encontrado.'
  } else if (description.length < 20) {
    errors.description = 'A descrição deve ter pelo menos 20 caracteres.'
  } else if (description.length > 1000) {
    errors.description = 'A descrição deve ter no máximo 1.000 caracteres.'
  }

  if (!form.address.trim()) {
    errors.address = 'Informe o nome da rua ou avenida.'
  }

  const normalizedNumber = form.number.trim().toUpperCase()
  const hasNoNumber = normalizedNumber === 'S/N'

  if (!normalizedNumber) {
    errors.number = 'Informe o número ou digite “S/N”.'
  }

  if (hasNoNumber && !form.complement.trim()) {
    errors.complement = 'Informe um ponto de referência quando o local não tiver número.'
  }

  if (!form.neighborhood.trim()) {
    errors.neighborhood = 'Informe o bairro.'
  }

  return errors
}
