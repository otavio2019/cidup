import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { apiRequest } from '../../api'
import CitizenMobileNav from './CitizenMobileNav'
import '../../App.css'

type ComplaintDraft = {
  type?: string
  description?: string
  address?: string
  number?: string
  neighborhood?: string
  complement?: string
  photoName?: string | null
}

function readDraft(state: ComplaintDraft | null): ComplaintDraft | null {
  if (state) return state
  try {
    const savedDraft = sessionStorage.getItem('cidup-complaint-draft')
    return savedDraft ? JSON.parse(savedDraft) as ComplaintDraft : null
  } catch {
    return null
  }
}

function ComplaintReviewPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const draft = useMemo(
    () => readDraft(location.state as ComplaintDraft | null),
    [location.state],
  )
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!draft?.type || !draft.description || !draft.address || !draft.number || !draft.neighborhood) {
    return <Navigate to="/registrar-denuncia" replace />
  }

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
        body: JSON.stringify(draft),
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
          NOT_SERVED: 'Não atendida',
        } as Record<string, string>)[data.complaint.status] ?? data.complaint.status,
        id: data.complaint.id,
      }
      sessionStorage.setItem('cidup-complaint-confirmation', JSON.stringify(registeredComplaint))
      try {
        const storedComplaints = JSON.parse(localStorage.getItem('cidup-complaints') ?? '[]') as typeof registeredComplaint[]
        const localComplaints = Array.isArray(storedComplaints) ? storedComplaints : []
        localStorage.setItem('cidup-complaints', JSON.stringify([...localComplaints, registeredComplaint]))
      } catch {
        localStorage.setItem('cidup-complaints', JSON.stringify([registeredComplaint]))
      }
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
      <header className="complaint-header">
        <Link className="complaint-brand" to="/dashboard" aria-label="Voltar ao Dashboard">
          <span className="complaint-brand-mark" aria-hidden="true">C</span>
          <span>CidUp</span>
        </Link>
        <span className="complaint-step">Etapa 3 de 4</span>
      </header>

      <section className="review-shell" aria-labelledby="review-title">
        <Link className="back-link" to="/registrar-denuncia/localizacao" state={draft}>← Voltar à localização</Link>
        <div className="location-heading">
          <p className="complaint-kicker">REVISÃO FINAL</p>
          <h1 id="review-title">Confira sua denúncia</h1>
          <p>Revise as informações abaixo. Depois de enviar, você receberá um protocolo para acompanhar o atendimento.</p>
        </div>

        <form className="review-form" onSubmit={handleSubmit}>
          <section className="review-card">
            <h2>Sobre o problema</h2>
            <ReviewField label="Tipo de ocorrência" value={draft.type} />
            <ReviewField label="Descrição" value={draft.description} />
            {draft.photoName && <ReviewField label="Foto anexada" value={draft.photoName} />}
          </section>

          <section className="review-card">
            <h2>Local da ocorrência</h2>
            <ReviewField label="Endereço" value={`${draft.address}, ${draft.number}`} />
            <ReviewField label="Bairro" value={draft.neighborhood} />
            {draft.complement && <ReviewField label="Ponto de referência" value={draft.complement} />}
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

function ReviewField({ label, value }: { label: string; value: string }) {
  return <div className="review-field"><dt>{label}</dt><dd>{value}</dd></div>
}

export default ComplaintReviewPage