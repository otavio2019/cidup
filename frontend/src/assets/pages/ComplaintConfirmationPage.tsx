import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import '../../App.css'

type ComplaintData = {
  type?: string
  description?: string
  address?: string
  neighborhood?: string
  complement?: string
  photoName?: string | null
}

function ComplaintConfirmationPage() {
  const location = useLocation()

  const complaint = useMemo(() => {
    const stateData = location.state as ComplaintData | null
    if (stateData) return stateData

    const savedData = sessionStorage.getItem('cidup-complaint-location')
    if (!savedData) return {}

    try {
      return JSON.parse(savedData) as ComplaintData
    } catch {
      return {}
    }
  }, [location.state])

  // TODO: substituir pelo protocolo gerado pela API e salvo no banco.
  const protocol = 'CIDUP-000001'

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
            <strong>{complaint.type || 'Não informado'}</strong>
          </div>
          <div className="summary-item">
            <span>Descrição</span>
            <strong>{complaint.description || 'Não informado'}</strong>
          </div>
          <div className="summary-item">
            <span>Local</span>
            <strong>{complaint.address || 'Não informado'}</strong>
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
          <Link className="primary-action" to="/dashboard">
            Acompanhar minhas denúncias
          </Link>
          <Link className="secondary-action" to="/dashboard">
            Voltar ao Dashboard
          </Link>
        </div>
      </section>
    </main>
  )
}

export default ComplaintConfirmationPage
