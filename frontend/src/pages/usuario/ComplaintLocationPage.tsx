import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
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
  latitude?: number
  longitude?: number
}

// Confirma endereço e coordenadas para compor o rascunho da denúncia.
function ComplaintLocationPage() {
  const navigate = useNavigate()
  const routeLocation = useLocation()
  const [error, setError] = useState('')

  // Recupera o rascunho da navegação ou da sessão e usa dados vazios se estiver inválido.
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
  const [isLocating, setIsLocating] = useState(false)
  const [isAddressLoading, setIsAddressLoading] = useState(false)
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(
    typeof complaint.latitude === 'number' && typeof complaint.longitude === 'number'
      ? { latitude: complaint.latitude, longitude: complaint.longitude }
      : null,
  )

  // Obtém as coordenadas do dispositivo e inicia a busca reversa do endereço.
  function requestLocation() {
    if (!navigator.geolocation) {
      setError('Este navegador não oferece geolocalização. Informe a localização manualmente.')
      return
    }

    setError('')
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nextCoordinates = { latitude: coords.latitude, longitude: coords.longitude }
        setCoordinates(nextCoordinates)
        setIsLocating(false)
        fillAddressFromCoordinates(nextCoordinates.latitude, nextCoordinates.longitude)
      },
      () => {
        setIsLocating(false)
        setError('Não foi possível obter sua localização. Autorize o acesso ou tente novamente.')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    )
  }

  // Consulta o serviço de geocodificação reversa para sugerir campos do endereço.
  async function fillAddressFromCoordinates(latitude: number, longitude: number) {
    setIsAddressLoading(true)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=pt-BR`,
        { headers: { Accept: 'application/json' } },
      )
      if (!response.ok) throw new Error('Não foi possível converter a localização em endereço.')

      const data = await response.json() as {
        display_name?: string
        address?: {
          road?: string
          pedestrian?: string
          residential?: string
          house_number?: string
          neighbourhood?: string
          suburb?: string
          city_district?: string
          city?: string
          town?: string
          village?: string
          postcode?: string
        }
      }
      const reverseAddress = data.address ?? {}
      const street = reverseAddress.road ?? reverseAddress.pedestrian ?? reverseAddress.residential
      const neighborhoodName = reverseAddress.neighbourhood ?? reverseAddress.suburb ?? reverseAddress.city_district
      if (street) setAddress(street)
      else if (address.includes(',')) setAddress('')
      if (reverseAddress.house_number) setNumber(reverseAddress.house_number)
      if (neighborhoodName) setNeighborhood(neighborhoodName)
      if (!street) setError('A localização foi obtida, mas o mapa retornou apenas a região. Informe a rua e o número manualmente.')
    } catch {
      setError('Localização obtida. Não foi possível preencher o endereço automaticamente; confira os campos.')
    } finally {
      setIsAddressLoading(false)
    }
  }

  // Solicita localização automaticamente quando a etapa ainda não tem coordenadas.
  useEffect(() => {
    if (coordinates) return
    const timer = window.setTimeout(() => {
      requestLocation()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [coordinates])

  // Valida os dados da localização e guarda a etapa seguinte no rascunho da sessão.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!address.trim()) {
      setError('Confirme o endereço da denúncia.')
      return
    }

    const normalizedNumber = number.trim().toUpperCase()
    const hasNoNumber = normalizedNumber === 'S/N'

    if (!normalizedNumber) {
      setError('Informe o número ou digite S/N.')
      return
    }

    if (hasNoNumber && !reference.trim()) {
      setError('Informe um ponto de referência quando o local não tiver número.')
      return
    }

    if (!neighborhood.trim()) {
      setError('Informe o bairro da denúncia.')
      return
    }
    if (!coordinates) {
      setError('Informe a localização pelo botão de geolocalização.')
      return
    }

    const locationData = {
      ...complaint,
      address: address.trim(),
      number: hasNoNumber ? 'S/N' : number.trim(),
      neighborhood: neighborhood.trim(),
      complement: reference.trim(),
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
              <label htmlFor="location-number">Número ou S/N <span>*</span></label>
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
              <label htmlFor="location-reference">Ponto de referência <small>{number.trim().toUpperCase() === 'S/N' ? '(obrigatório para S/N)' : '(opcional)'}</small></label>
              <input
                id="location-reference"
                type="text"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Ex.: Próximo à escola municipal"
              />
            </div>

            <div className="complaint-field">
              <label>Coordenadas <span>*</span></label>
              <button
                className="secondary-action"
                type="button"
                onClick={requestLocation}
                disabled={isLocating}
              >
                {isLocating ? 'Obtendo localização...' : coordinates ? 'Atualizar localização' : 'Obter localização atual'}
              </button>
              {isAddressLoading && <small>Preenchendo o endereço automaticamente...</small>}
              {coordinates && (
                <small>Localização obtida automaticamente: {coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)}. Você pode editar os campos acima.</small>
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
