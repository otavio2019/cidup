/** Armazenamento de rascunhos de denúncia: lista persistente (localStorage) separada por usuário. */

export type DraftData = Record<string, unknown>

export type ComplaintDraftRecord = {
  id: string
  updatedAt: string
  data: DraftData
}

type StoredDraft = ComplaintDraftRecord & { owner: string }

const DRAFTS_KEY = 'cidup-drafts'
const ACTIVE_DRAFT_KEY = 'cidup-active-draft-id'
// Cópia de trabalho lida pelas páginas do fluxo de denúncia.
export const WORKING_DRAFT_KEY = 'cidup-complaint-draft'

// Identifica o dono pelo e-mail do perfil para que contas diferentes no mesmo navegador não vejam rascunhos alheios.
function currentOwner() {
  try {
    const profile = JSON.parse(localStorage.getItem('cidup-profile') ?? '{}') as { email?: unknown }
    return typeof profile.email === 'string' ? profile.email.trim().toLowerCase() : 'anon'
  } catch {
    return 'anon'
  }
}

function readAll(): StoredDraft[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(DRAFTS_KEY) ?? '[]') as unknown
    return Array.isArray(parsed) ? parsed as StoredDraft[] : []
  } catch {
    return []
  }
}

function writeAll(drafts: StoredDraft[]) {
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts))
    return true
  } catch {
    return false
  }
}

// Lista os rascunhos do usuário atual, do mais recente para o mais antigo.
export function listDrafts(): ComplaintDraftRecord[] {
  const owner = currentOwner()
  return readAll()
    .filter((draft) => draft.owner === owner)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(({ id, updatedAt, data }) => ({ id, updatedAt, data }))
}

export function getDraft(id: string): ComplaintDraftRecord | null {
  return listDrafts().find((draft) => draft.id === id) ?? null
}

// Cria ou atualiza um rascunho e devolve o id. A foto em base64 não é guardada para não estourar a cota do localStorage.
export function saveDraft(data: DraftData, id?: string | null): string {
  const owner = currentOwner()
  const persistable = { ...data }
  delete persistable.photoData
  const draftId = id ?? crypto.randomUUID()
  const record: StoredDraft = { id: draftId, owner, updatedAt: new Date().toISOString(), data: persistable }
  const others = readAll().filter((draft) => !(draft.id === draftId && draft.owner === owner))
  writeAll([record, ...others])
  setActiveDraftId(draftId)
  return draftId
}

export function deleteDraft(id: string) {
  const owner = currentOwner()
  writeAll(readAll().filter((draft) => !(draft.id === id && draft.owner === owner)))
  if (getActiveDraftId() === id) clearActiveDraft()
}

export function getActiveDraftId() {
  return sessionStorage.getItem(ACTIVE_DRAFT_KEY)
}

function setActiveDraftId(id: string) {
  sessionStorage.setItem(ACTIVE_DRAFT_KEY, id)
}

// Encerra a edição atual sem apagar o rascunho salvo.
export function clearActiveDraft() {
  sessionStorage.removeItem(ACTIVE_DRAFT_KEY)
  sessionStorage.removeItem(WORKING_DRAFT_KEY)
}

// Carrega um rascunho salvo como cópia de trabalho para continuar a denúncia.
export function resumeDraft(id: string) {
  const draft = getDraft(id)
  if (!draft) return false
  sessionStorage.setItem(WORKING_DRAFT_KEY, JSON.stringify(draft.data))
  setActiveDraftId(id)
  return true
}
