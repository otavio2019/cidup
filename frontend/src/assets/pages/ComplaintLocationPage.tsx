import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import CitizenMobileNav from './CitizenMobileNav'
import '../../App.css'

type ComplaintData = {
  type?: string
  description?: string
  address?: string
  number?: string
  neighborhood?: string
  complement?: string
  photoName?: string | null
}

function ComplaintLocationPage() {
  const navigate = useNavigate()
  const routeLocation = useLocation()
  const [error, setError] = useState('')

  const complaint = useMemo(() => {
    const stateData = routeLocation.state as ComplaintData | null
    if (stateData) return stateData

    const savedData = sessionStorage.getItem('cidup-complaint-draft')
    if (!savedData) return {}

    try {
      return JSON.parse(savedData) as ComplaintData
    } catch {
      return {}
    }
  }, [routeLocation.state])

  const [address, setAddress] = useState(
    complaint.address ?? '',
  )
  const [number, setNumber] = useState(complaint.number ?? '')
  const [neighborhood, setNeighborhood] = useState(complaint.neighborhood ?? '')
  const [reference, setReference] = useState(complaint.complement ?? '')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!address.trim()) {
      setError('Confirme o endereço da denúncia.')
      return
    }

    if (!number.trim()) {
      setError('Informe o número ou digite S/N.')
      return
    }

    if (!neighborhood.trim()) {
      setError('Informe o bairro da denúncia.')
      return
    }

    const locationData = {
      ...complaint,
      address: address.trim(),
      number: number.trim(),
      neighborhood: neighborhood.trim(),
      complement: reference.trim(),
    }
    sessionStorage.setItem('cidup-complaint-draft', JSON.stringify(locationData))
    navigate('/denuncia/revisar', { state: locationData })
  }

  return (
    <main className="location-page">
      <header className="complaint-header">
        <Link className="complaint-brand" to="/dashboard" aria-label="Voltar ao Dashboard">
          <span className="complaint-brand-mark" aria-hidden="true">C</span>
          <span>CidUp</span>
        </Link>
        <span className="complaint-step">Etapa 2 de 4</span>
      </header>

      <section className="location-shell" aria-labelledby="location-title">
        <Link className="back-link" to="/registrar-denuncia">← Voltar para a denúncia</Link>

        <div className="location-heading">
          <p className="complaint-kicker">CONFIRME A LOCALIZAÇÃO</p>
          <h1 id="location-title">Confira onde aconteceu</h1>
          <p>
            Confirme o local do problema para que a equipe responsável consiga
            encontrar a ocorrência.
          </p>
        </div>

        <form className="location-form" onSubmit={handleSubmit}>
          <section className="location-card">
            <div className="form-section-title">
              <span>01</span>
              <div>
                <h2>Revise o endereço</h2>
                <p>Confira os dados para a equipe encontrar a ocorrência.</p>
              </div>
            </div>

            <div className="complaint-field">
              <label htmlFor="location-number">Número <span>*</span></label>
              <input
                id="location-number"
                type="text"
                value={number}
                onChange={(event) => {
                  setNumber(event.target.value)
                  setError('')
                }}
                placeholder="Ex.: 120 ou S/N"
              />
            </div>

            <div className="complaint-field">
              <label htmlFor="location-address">Rua ou avenida <span>*</span></label>
              <input
                id="location-address"
                type="text"
                value={address}
                onChange={(event) => {
                  setAddress(event.target.value)
                  setError('')
                }}
                placeholder="Ex.: Rua das Flores, 120"
              />
            </div>

            <div className="complaint-field">
              <label htmlFor="location-neighborhood">Bairro <span>*</span></label>
              <input
                id="location-neighborhood"
                type="text"
                value={neighborhood}
                onChange={(event) => {
                  setNeighborhood(event.target.value)
                  setError('')
                }}
                placeholder="Ex.: Centro"
              />
            </div>

            <div className="complaint-field">
              <label htmlFor="location-reference">Ponto de referência <small>(opcional)</small></label>
              <input
                id="location-reference"
                type="text"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Ex.: Próximo à escola municipal"
              />
            </div>
          </section>

          <section className="map-placeholder" aria-label="Mapa da localização">
            <div className="map-placeholder-icon" aria-hidden="true">⌖</div>
              <h2>Confira a denúncia</h2>
              <p>Na próxima etapa você revisa o relato completo antes de enviar.</p>
              <span className="map-status">Localização informada manualmente</span>
          </section>

          {error && <p className="form-message complaint-submit-error" role="alert">{error}</p>}

          <div className="complaint-actions">
            <Link className="secondary-action" to="/registrar-denuncia">Voltar</Link>
            <button className="primary-action" type="submit">
              Conferir denúncia <span aria-hidden="true">→</span>
            </button>
          </div>
        </form>
      </section>
      <CitizenMobileNav />
    </main>
  )
}

export default ComplaintLocationPage
