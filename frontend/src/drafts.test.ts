import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearActiveDraft,
  deleteDraft,
  getActiveDraftId,
  getDraft,
  listDrafts,
  resumeDraft,
  saveDraft,
  WORKING_DRAFT_KEY,
} from './drafts'

function createStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  }
}

describe('rascunhos de denúncia', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage())
    vi.stubGlobal('sessionStorage', createStorage())
    vi.stubGlobal('crypto', { randomUUID: () => 'draft-1' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('salva e atualiza rascunhos sem persistir a foto em base64', () => {
    const id = saveDraft({ description: 'Primeiro relato', photoData: 'data:image/png;base64,abc' })
    saveDraft({ description: 'Relato atualizado' }, id)

    expect(listDrafts()).toEqual([
      expect.objectContaining({ id, data: { description: 'Relato atualizado' } }),
    ])
    expect(getDraft(id)?.data).not.toHaveProperty('photoData')
    expect(getActiveDraftId()).toBe(id)
  })

  it('isola a lista de rascunhos por conta no mesmo navegador', () => {
    localStorage.setItem('cidup-profile', JSON.stringify({ email: 'cidadao@example.com' }))
    const id = saveDraft({ description: 'Relato privado' })

    localStorage.setItem('cidup-profile', JSON.stringify({ email: 'outra@example.com' }))
    expect(listDrafts()).toEqual([])
    expect(getDraft(id)).toBeNull()

    localStorage.setItem('cidup-profile', JSON.stringify({ email: ' CIDADAO@example.com ' }))
    expect(getDraft(id)?.data.description).toBe('Relato privado')
  })

  it('retoma o rascunho na sessão atual e limpa os dados de edição ao excluir', () => {
    const id = saveDraft({ description: 'Relato para continuar' })

    expect(resumeDraft(id)).toBe(true)
    expect(getActiveDraftId()).toBe(id)
    expect(JSON.parse(sessionStorage.getItem(WORKING_DRAFT_KEY) ?? 'null')).toEqual({
      description: 'Relato para continuar',
    })

    deleteDraft(id)
    expect(getDraft(id)).toBeNull()
    expect(getActiveDraftId()).toBeNull()
    expect(sessionStorage.getItem(WORKING_DRAFT_KEY)).toBeNull()
  })

  it('retorna false ao tentar retomar um rascunho inexistente e limpa a edição ativa', () => {
    sessionStorage.setItem(WORKING_DRAFT_KEY, '{"description":"temporário"}')
    sessionStorage.setItem('cidup-active-draft-id', 'missing')

    expect(resumeDraft('missing')).toBe(false)
    clearActiveDraft()
    expect(getActiveDraftId()).toBeNull()
    expect(sessionStorage.getItem(WORKING_DRAFT_KEY)).toBeNull()
  })
})
