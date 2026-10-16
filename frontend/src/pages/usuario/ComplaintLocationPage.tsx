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
  ids_orgaos?: number[]
  latitude?: number
  longitude?: number
}

type Organization = { id_orgao: number; nome: string }

const organizationRules = [
  { types: ['buraco', 'calcada', 'sinalizacao'], organizations: ['obra', 'infraestrutura', 'via'] },
  { types: ['iluminacao'], organizations: ['iluminacao', 'servico'] },
  { types: ['lixo', 'descarte'], organizations: ['limpeza', 'servico'] },
  { types: ['arvore', 'area verde'], organizations: ['meio ambiente', 'ambiental', 'verde'] },
  { types: ['alagamento', 'drenagem'], organizations: ['saneamento', 'drenagem', 'obra'] },
]

function normalizeText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
}

function findResponsibleOrganization(type: string | undefined, availableOrganizations: Organization[]) {
  const normalizedType = normalizeText(type ?? '')
  const rule = organizationRules.find(({ types }) => types.some((keyword) => normalizedType.includes(keyword)))
  const matchingOrganization = rule
    ? availableOrganizations.find((organization) => {
      const normalizedName = normalizeText(organization.nome)
      return rule.organizations.some((keyword) => normalizedName.includes(keyword))
    })
    : undefined

  return matchingOrganization ?? (availableOrganizations.length === 1 ? availableOrganizations[0] : undefined)
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
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [organizationIds, setOrganizationIds] = useState<string[]>(
    complaint.ids_orgaos?.map(String) ?? (complaint.id_orgao ? [String(complaint.id_orgao)] : []),
  )
  const [isLocating, setIsLocating] = useState(false)
  const [isAddressLoading, setIsAddressLoading] = useState(false)
  const hadSavedOrganizations = organizationIds.length > 0
  const complaintType = complaint.type
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(
    typeof complaint.latitude === 'number' && typeof complaint.longitude === 'number'
      ? { latitude: complaint.latitude, longitude: complaint.longitude }
      : null,
  )

  useEffect(() => {
    let active = true
    apiRequest<{ orgaos: Organization[] }>('/api/orgaos')
      .then(({ orgaos }) => {
        if (!active) return
        setOrganizations(orgaos)
        if (!hadSavedOrganizations) {
          const responsibleOrganization = findResponsibleOrganization(complaintType, orgaos)
          if (responsibleOrganization) setOrganizationIds([String(responsibleOrganization.id_orgao)])
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os órgãos.')
      })

    return () => {
      active = false
    }
  }, [complaintType, hadSavedOrganizations])

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
        }
      }
      const reverseAddress = data.address ?? {}
      const street = reverseAddress.road ?? reverseAddress.pedestrian ?? reverseAddress.residential
      const neighborhoodName = reverseAddress.neighbourhood ?? reverseAddress.suburb ?? reverseAddress.city_district
      if (street) setAddress(street)
      if (reverseAddress.house_number) setNumber(reverseAddress.house_number)
      if (neighborhoodName) setNeighborhood(neighborhoodName)
      if (!street && data.display_name) setAddress(data.display_name)
      if (!street && !data.display_name) setError('Localização obtida, mas não foi possível preencher o endereço automaticamente.')
    } catch {
      setError('Localização obtida. Não foi possível preencher o endereço automaticamente; confira os campos.')
    } finally {
      setIsAddressLoading(false)
    }
  }

  useEffect(() => {
    if (coordinates) return
    const timer = window.setTimeout(() => {
      requestLocation()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [coordinates])

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
    if (organizationIds.length === 0) {
      setError('Selecione pelo menos um órgão responsável.')
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
      id_orgao: Number(organizationIds[0]),
      ids_orgaos: organizationIds.map(Number),
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

            <fieldset className="complaint-field">
              <legend>Órgãos responsáveis <span>*</span></legend>
              {organizations.map((organization) => {
                const value = String(organization.id_orgao)
                return (
                  <label key={organization.id_orgao} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontWeight: 400 }}>
                    <input
                      type="checkbox"
                      checked={organizationIds.includes(value)}
                      onChange={(event) => {
                        setError('')
                        setOrganizationIds((current) => event.target.checked
                          ? [...current, value]
                          : current.filter((id) => id !== value))
                      }}
                    />
                    {organization.nome}
                  </label>
                )
              })}
              <small>Você pode marcar mais de um órgão. O sugerido para o tipo do problema já vem marcado.</small>
              {organizations.length === 0 && <small>Nenhum órgão público disponível no momento.</small>}
            </fieldset>

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
