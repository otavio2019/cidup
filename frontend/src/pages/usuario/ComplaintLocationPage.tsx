import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { apiRequest } from '../../api'
import CitizenMobileNav from '../../components/usuario/CitizenMobileNav'
import CitizenHeader from '../../components/usuario/CitizenHeader'
import '../../App.css'

type ComplaintData = {
  type?: string
  description?: string
  address?: string
  number?: string
  neighborhood?: string
  complement?: string
  photoName?: string | null
  id_orgao?: number
  latitude?: number
  longitude?: number
}

type Organization = { id_orgao: number; nome: string }

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
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [organizationId, setOrganizationId] = useState(complaint.id_orgao?.toString() ?? '')
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(
    typeof complaint.latitude === 'number' && typeof complaint.longitude === 'number'
      ? { latitude: complaint.latitude, longitude: complaint.longitude }
      : null,
  )

  useEffect(() => {
    let active = true
    apiRequest<{ orgaos: Organization[] }>('/api/orgaos')
      .then(({ orgaos }) => {
        if (active) setOrganizations(orgaos)
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os órgãos.')
      })

    return () => {
      active = false
    }
  }, [])

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
    if (!organizationId) {
      setError('Selecione o órgão responsável.')
      return
    }
    if (!coordinates) {
      setError('Informe a localização pelo botão de geolocalização.')
      return
    }

    const locationData = {
      ...complaint,
      address: address.trim(),
      number: number.trim(),
      neighborhood: neighborhood.trim(),
      complement: reference.trim(),
      id_orgao: Number(organizationId),
      ...coordinates,
    }
    sessionStorage.setItem('cidup-complaint-draft', JSON.stringify(locationData))
    navigate('/denuncia/revisar', { state: locationData })
  }

  return (
    <main className="location-page">
      <CitizenHeader active="create" />

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
                placeholder="Ex.: Rua das Flores"
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

            <div className="complaint-field">
              <label htmlFor="location-organization">Órgão responsável <span>*</span></label>
              <select
                id="location-organization"
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
              >
                <option value="">Selecione um órgão</option>
                {organizations.map((organization) => (
                  <option key={organization.id_orgao} value={organization.id_orgao}>
                    {organization.nome}
                  </option>
                ))}
              </select>
              {organizations.length === 0 && <small>Nenhum órgão público disponível no momento.</small>}
            </div>

            <div className="complaint-field">
              <label>Coordenadas <span>*</span></label>
              <button
                className="secondary-action"
                type="button"
                onClick={() => {
                  if (!navigator.geolocation) {
                    setError('Este navegador não oferece geolocalização.')
                    return
                  }
                  navigator.geolocation.getCurrentPosition(
                    ({ coords }) => {
                      setCoordinates({ latitude: coords.latitude, longitude: coords.longitude })
                      setError('')
                    },
                    () => setError('Não foi possível obter sua localização. Autorize a geolocalização e tente novamente.'),
                    { enableHighAccuracy: true, timeout: 10000 },
                  )
                }}
              >
                {coordinates ? 'Atualizar localização' : 'Obter localização atual'}
              </button>
              {coordinates && (
                <small>Localização informada: {coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)}</small>
              )}
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
