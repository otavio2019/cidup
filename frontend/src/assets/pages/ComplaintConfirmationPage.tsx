import { useMemo } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import CitizenMobileNav from './CitizenMobileNav'
import '../../App.css'

type ComplaintData = {
  protocol?: string
  registeredAt?: string
  status?: string
  description?: string
  address?: string
  neighborhood?: string
  complement?: string
  photoName?: string | null
  number?: string
  type?: string | { name: string }
}

function ComplaintConfirmationPage() {
  const location = useLocation()

  const complaint = useMemo(() => {
    const stateData = location.state as ComplaintData | null
    if (stateData) return stateData

    const savedData = sessionStorage.getItem('cidup-complaint-confirmation')
    if (!savedData) return null

    try {
      return JSON.parse(savedData) as ComplaintData
    } catch {
      return null
    }
  }, [location.state])

  if (!complaint?.protocol) return <Navigate to="/dashboard" replace />

  const protocol = complaint.protocol
  const complaintType = typeof complaint.type === 'string'
    ? complaint.type
    : complaint.type?.name ?? 'Não informado'

  return (
    <main className="confirmation-page">
      <section className="confirmation-card" aria-labelledby="confirmation-title">
        <div className="success-icon" aria-hidden="true">✓</div>
        <p className="confirmation-kicker">DENÚNCIA REGISTRADA</p>
        <h1 id="confirmation-title">Obrigado por ajudar a cuidar da cidade!</h1>
        <p className="confirmation-description">
          Sua denúncia foi registrada e será encaminhada para o órgão responsável.
        </p>

        <div className="protocol-box">
          <span>Seu protocolo</span>
          <strong>{protocol}</strong>
        </div>

        <div className="complaint-summary">
          <h2>Resumo da denúncia</h2>
          <div className="summary-item">
            <span>Tipo</span>
            <strong>{complaintType}</strong>
          </div>
          <div className="summary-item">
            <span>Descrição</span>
            <strong>{complaint.description || 'Não informado'}</strong>
          </div>
          <div className="summary-item">
            <span>Local</span>
            <strong>{[complaint.address, complaint.number].filter(Boolean).join(', ') || 'Não informado'}</strong>
          </div>
          <div className="summary-item">
            <span>Bairro</span>
            <strong>{complaint.neighborhood || 'Não informado'}</strong>
          </div>
          {complaint.complement && (
            <div className="summary-item">
              <span>Ponto de referência</span>
              <strong>{complaint.complement}</strong>
            </div>
          )}
        </div>

        <div className="confirmation-actions">
          <Link className="primary-action" to="/minhas-denuncias">
            Acompanhar minhas denúncias
          </Link>
          <Link className="secondary-action" to="/dashboard">
            Voltar ao Dashboard
          </Link>
        </div>
      </section>
      <CitizenMobileNav />
    </main>
  )
}

export default ComplaintConfirmationPage
