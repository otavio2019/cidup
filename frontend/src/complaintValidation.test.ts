import { describe, expect, it } from 'vitest'
import type { AiComplaintForm } from './aiComplaintDraft'
import { validateComplaintForm } from './complaintValidation'

const validForm: AiComplaintForm = {
  title: 'Buraco na rua',
  type: 'Buraco ou problema na via',
  categories: ['Buraco ou problema na via'],
  description: 'A descrição contém pelo menos vinte caracteres.',
  address: 'Rua das Flores',
  number: '42',
  neighborhood: 'Centro',
  complement: '',
  priority: '',
}

describe('validação do formulário de denúncia', () => {
  it('aceita uma denúncia completa', () => {
    expect(validateComplaintForm(validForm)).toEqual({})
  })

  it.each([
    ['categoria ausente', 'categories', [], 'type', 'Selecione ao menos uma ocorrência.'],
    ['descrição vazia', 'description', '   ', 'description', 'Descreva o problema encontrado.'],
    ['endereço vazio', 'address', '   ', 'address', 'Informe o nome da rua ou avenida.'],
    ['número vazio', 'number', '   ', 'number', 'Informe o número ou digite “S/N”.'],
    ['bairro vazio', 'neighborhood', '   ', 'neighborhood', 'Informe o bairro.'],
  ] as Array<[string, keyof AiComplaintForm, string | string[], keyof AiComplaintForm, string]>)(
    'rejeita %s com a mensagem esperada',
    (_label, field, value, errorField, expectedMessage) => {
      const form = { ...validForm, [field]: value } as AiComplaintForm
      expect(validateComplaintForm(form)).toEqual({ [errorField]: expectedMessage })
    },
  )

  it.each([
    ['19 caracteres', 'x'.repeat(19), 'A descrição deve ter pelo menos 20 caracteres.'],
    ['20 caracteres', 'x'.repeat(20), undefined],
    ['1.000 caracteres', 'x'.repeat(1000), undefined],
    ['1.001 caracteres', 'x'.repeat(1001), 'A descrição deve ter no máximo 1.000 caracteres.'],
  ])('valida o limite da descrição em %s', (_label, description, expectedError) => {
    const errors = validateComplaintForm({ ...validForm, description })
    if (expectedError) {
      expect(errors).toEqual({ description: expectedError })
    } else {
      expect(errors).toEqual({})
    }
  })

  it('exige ponto de referência para número ausente e aceita S/N com referência', () => {
    const withoutReference = validateComplaintForm({ ...validForm, number: ' s/n ', complement: ' ' })
    expect(withoutReference.complement).toBe(
      'Informe um ponto de referência quando o local não tiver número.',
    )

    expect(validateComplaintForm({
      ...validForm,
      number: ' s/n ',
      complement: 'Próximo à praça',
    })).toEqual({})
  })

  it('preserva uma mensagem de validação de foto fornecida pela seleção do arquivo', () => {
    expect(validateComplaintForm(validForm, 'Selecione um arquivo de imagem válido.')).toEqual({
      photo: 'Selecione um arquivo de imagem válido.',
    })
  })
})
