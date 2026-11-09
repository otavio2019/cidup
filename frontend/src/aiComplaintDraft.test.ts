import { describe, expect, it } from 'vitest'
import { applyAiComplaintDraft, type AiComplaintForm } from './aiComplaintDraft'

const emptyForm: AiComplaintForm = {
  title: '', type: '', categories: [], description: 'Relato original completo.',
  address: '', number: '', neighborhood: '', complement: '', priority: '',
}

describe('mapeamento do rascunho de IA', () => {
  it('preenche os campos de localização e mantém a descrição original', () => {
    expect(applyAiComplaintDraft(emptyForm, {
      title: 'Buraco na avenida',
      categories: ['Buraco ou problema na via'],
      description: 'Texto reescrito',
      improvedDescription: 'Resumo incompleto',
      street: 'Avenida Solon de Lucena',
      number: '55',
      neighborhood: 'Centro',
      referencePoint: 'próximo à praça',
      priority: 'Alta',
    })).toEqual({
      ...emptyForm, title: 'Buraco na avenida', type: 'Buraco ou problema na via',
      categories: ['Buraco ou problema na via'], address: 'Avenida Solon de Lucena',
      number: '55', neighborhood: 'Centro', complement: 'próximo à praça', priority: 'Alta',
    })
  })

  it('não apaga dados existentes e aceita o formato legado', () => {
    const existing = { ...emptyForm, address: 'Rua existente', number: '10', neighborhood: 'Catolé', complement: 'perto da escola' }
    expect(applyAiComplaintDraft(existing, {
      category: 'Iluminação pública', summary: 'Resumo legado', street: null, number: null,
      neighborhood: 'Centro', referencePoint: null,
    })).toEqual({
      ...existing, type: 'Iluminação pública', categories: ['Iluminação pública'],
    })
  })

  it('preenche somente a referência quando o restante está ausente', () => {
    expect(applyAiComplaintDraft(emptyForm, {
      street: null, number: null, neighborhood: null, referencePoint: 'próximo ao mercado municipal',
    })).toEqual({ ...emptyForm, complement: 'próximo ao mercado municipal' })
  })

  it('substitui uma sugestão automática de GPS, mas não uma edição manual', () => {
    const form = { ...emptyForm, address: 'Rua do GPS', number: '10', neighborhood: 'Centro' }
    expect(applyAiComplaintDraft(form, {
      street: 'Estrada Velha', number: '42', neighborhood: 'Catolé',
    }, { address: 'Rua do GPS', number: '10', neighborhood: 'Bairro antigo' })).toEqual({
      ...form, address: 'Estrada Velha', number: '42',
    })
  })
})
