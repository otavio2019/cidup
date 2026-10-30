import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { apiRequest } from '../../api'
import CitizenMobileNav from '../../components/usuario/CitizenMobileNav'
import CitizenHeader from '../../components/usuario/CitizenHeader'
import { deleteDraft, getActiveDraftId } from '../../drafts'
import '../../App.css'

/** Última etapa do cidadão: revisa o rascunho e cria a denúncia somente após confirmação. */

// ===== MODELO DO RASCUNHO E ORGANIZAÇÃO RESPONSÁVEL =====
type ComplaintDraft = {
  type?: string
  description?: string
  address?: string
  number?: string
  neighborhood?: string
  complement?: string
  photoName?: string | null
  photoData?: string | null
  latitude?: number
  longitude?: number
}

type Organization = { nome: string }

function normalizeText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
}

function findResponsibleOrganization(type: string, organizations: Organization[]) {
  const normalizedType = normalizeText(type)
  const rules = [
    { types: ['buraco', 'calcada', 'sinalizacao', 'pavimento'], organizations: ['obra', 'infraestrutura'] },
    { types: ['iluminacao', 'poste', 'lampada'], organizations: ['iluminacao'] },
    { types: ['lixo', 'descarte', 'entulho', 'limpeza'], organizations: ['limpeza'] },
    { types: ['arvore', 'area verde', 'meio ambiente'], organizations: ['meio ambiente', 'ambiental'] },
    { types: ['alagamento', 'drenagem', 'esgoto', 'saneamento'], organizations: ['saneamento', 'drenagem'] },
  ]
  const rule = rules.find(({ types }) => types.some((keyword) => normalizedType.includes(keyword)))
  return organizations.find(({ nome }) => {
    const normalizedName = normalizeText(nome)
    return (rule?.organizations ?? ['obra']).some((keyword) => normalizedName.includes(keyword))
  })?.nome
}

// Recupera o rascunho da navegação ou do armazenamento temporário da sessão.
function readDraft(state: ComplaintDraft | null): ComplaintDraft | null {
  if (state) return state
  try {
    const savedDraft = sessionStorage.getItem('cidup-complaint-draft')
    return savedDraft ? JSON.parse(savedDraft) as ComplaintDraft : null
  } catch {
    return null
  }
}

// ===== ESTADO E CONSULTA DE ÓRGÃOS =====
// Revisa a denúncia e só a envia à API após o cidadão confirmar os dados.
function ComplaintReviewPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const draft = useMemo(
    () => readDraft(location.state as ComplaintDraft | null),
    [location.state],
  )
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [organizationName, setOrganizationName] = useState('')

  useEffect(() => {
    if (!draft?.type) return undefined
    let active = true
    // Consulta GET /api/orgaos para exibir o órgão sugerido conforme o tipo da ocorrência.
    apiRequest<{ orgaos: Organization[] }>('/api/orgaos')
      .then(({ orgaos }) => {
        if (active) setOrganizationName(findResponsibleOrganization(draft.type!, orgaos) ?? '')
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [draft?.type])

  if (!draft?.type || !draft.description || !draft.address || !draft.number || !draft.neighborhood) {
    return <Navigate to="/registrar-denuncia" replace />
  }

  // ===== ENVIO E CONFIRMAÇÃO =====
  // Envia POST /api/complaints e, com o protocolo retornado, segue para ComplaintConfirmationPage.
  // Registra a denúncia, converte os dados recebidos e abre a tela de confirmação.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const data = await apiRequest<{
        complaint: {
          id: number
          protocol: string
          createdAt: string
          status: string
          type: { name: string }
        }
      }>('/api/complaints', {
        method: 'POST',
        body: JSON.stringify({ ...draft, photo: draft!.photoData ?? null }),
      })

      const registeredComplaint = {
        ...draft,
        type: data.complaint.type.name,
        protocol: data.complaint.protocol,
        registeredAt: data.complaint.createdAt,
        status: ({
          RECEIVED: 'Recebida',
          IN_ANALYSIS: 'Em análise',
          FORWARDED: 'Em atendimento',
          IN_SERVICE: 'Em atendimento',
          RESOLVED: 'Resolvida',
          NOT_SERVED: 'Negada',
        } as Record<string, string>)[data.complaint.status] ?? data.complaint.status,
        id: data.complaint.id,
      }
      sessionStorage.setItem('cidup-complaint-confirmation', JSON.stringify(registeredComplaint))
      const activeDraftId = getActiveDraftId()
      if (activeDraftId) deleteDraft(activeDraftId)
      sessionStorage.removeItem('cidup-complaint-draft')
      navigate('/denuncia/confirmacao', { state: registeredComplaint })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível enviar a denúncia.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="review-page">
      {/* ===== TELA (JSX): conferência do rascunho antes do POST /api/complaints. ===== */}
      <CitizenHeader active="create" />

      <section className="review-shell" aria-labelledby="review-title">
        <Link className="back-link" to="/registrar-denuncia/localizacao" state={draft}>← Voltar à localização</Link>
        <div className="location-heading">
          <p className="complaint-kicker">REVISÃO FINAL</p>
          <h1 id="review-title">Confira sua denúncia</h1>
          <p>Revise as informações abaixo. Depois de enviar, você receberá um protocolo para acompanhar o atendimento.</p>
        </div>

        <form className="review-form" onSubmit={handleSubmit}>
          {/* Resume relato e anexo recebidos da etapa de criação. */}
          <section className="review-card">
            <h2>Sobre o problema</h2>
            <ReviewField label="Tipo de ocorrência" value={draft.type} />
            <ReviewField label="Descrição" value={draft.description} />
            {draft.photoName && <ReviewField label="Foto anexada" value={draft.photoName} />}
          </section>

          {/* Exibe endereço, coordenadas e órgão sugerido pela consulta à API. */}
          <section className="review-card">
            <h2>Local da ocorrência</h2>
            <ReviewField label="Endereço" value={`${draft.address}, ${draft.number}`} />
            <ReviewField label="Bairro" value={draft.neighborhood} />
            {draft.complement && <ReviewField label="Ponto de referência" value={draft.complement} />}
            {typeof draft.latitude === 'number' && typeof draft.longitude === 'number' && (
              <ReviewField label="Coordenadas" value={`${draft.latitude.toFixed(5)}, ${draft.longitude.toFixed(5)}`} />
            )}
            <ReviewField label="Órgão responsável" value={organizationName || 'Encaminhamento automático conforme o tipo da ocorrência'} />
          </section>

          <section className="review-card review-photo-card">
            <h2>Foto anexada</h2>
            {draft.photoData ? (
              <img className="review-photo-preview" src={draft.photoData} alt={`Pré-visualização: ${draft.photoName ?? 'foto da denúncia'}`} />
            ) : (
              <p>Nenhuma foto foi anexada. Esse campo é opcional.</p>
            )}
          </section>

          {error && <p className="form-message complaint-submit-error" role="alert">{error}</p>}

          <div className="complaint-actions">
            <Link className="secondary-action" to="/registrar-denuncia" state={draft}>Editar denúncia</Link>
            <button className="primary-action" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Enviando...' : 'Enviar denúncia'} <span aria-hidden="true">→</span>
            </button>
          </div>
        </form>
      </section>
      <CitizenMobileNav />
    </main>
  )
}

// ===== CAMPO REUTILIZÁVEL DA REVISÃO =====
// Exibe um rótulo e seu valor como uma linha reutilizável da revisão.
function ReviewField({ label, value }: { label: string; value: string }) {
  return <div className="review-field"><dt>{label}</dt><dd>{value}</dd></div>
}

export default ComplaintReviewPage
