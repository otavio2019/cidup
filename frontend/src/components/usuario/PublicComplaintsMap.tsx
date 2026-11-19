import { useEffect, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import { apiRequest } from '../../services/api'
import 'leaflet/dist/leaflet.css'
// Antonio - Atividade 13: corrige o mapa que carregava só em parte (área cinza) quando o container muda de tamanho.
import MapResizeFix from './MapResizeFix'

type DenunciaPublica = {
  id: number
  protocol: string
  title: string
  type: string
  categories: string[]
  status: string
  latitude: number
  longitude: number
  updatedAt: string
}

const rotulosStatus: Record<string, string> = {
  RECEIVED: 'Recebida',
  IN_ANALYSIS: 'Em análise',
  FORWARDED: 'Encaminhada',
  IN_SERVICE: 'Em atendimento',
}

const coresStatus: Record<string, string> = {
  RECEIVED: '#1564c0',
  IN_ANALYSIS: '#d98200',
  FORWARDED: '#7b3fb8',
  IN_SERVICE: '#18864b',
}

export default function PublicComplaintsMap() {
  const [denuncias, setDenuncias] = useState<DenunciaPublica[]>([])
  const [erro, setErro] = useState('')
  // Antonio - Atividade 13: só mostra a observação com o total depois que a lista carrega, para não exibir "0" durante o carregamento.
  const [carregado, setCarregado] = useState(false)
  const centro: [number, number] = [-7.23056, -35.88111]

  useEffect(() => {
    let ativo = true
    apiRequest<{ complaints: DenunciaPublica[] }>('/api/public/complaints')
      .then((data) => {
        // Antonio - Atividade 13: marca o carregamento como concluído (original: só setDenuncias).
        if (ativo) {
          setDenuncias(data.complaints)
          setCarregado(true)
        }
      })
      .catch(() => {
        if (ativo) setErro('Não foi possível carregar as denúncias no mapa.')
      })
    return () => { ativo = false }
  }, [])

  return (
    <section className="public-complaints-map-section" aria-labelledby="mapa-denuncias-title">
      <div className="public-complaints-map-heading">
        <div>
          <p className="complaint-kicker">MAPA DA CIDADE</p>
          <h2 id="mapa-denuncias-title">Denúncias em aberto</h2>
          <p>Veja ocorrências públicas até a etapa de atendimento. Os pontos são aproximados e não exibem dados pessoais.</p>
        </div>
        {/* Antonio - Atividade 13: removido o selo ao lado do título (original: <span className="public-complaints-map-count">{denuncias.length} no mapa</span>); o total agora aparece como observação abaixo da legenda. */}
      </div>
      {erro && <p className="form-message" role="alert">{erro}</p>}
      <div className="public-complaints-map" aria-label="Mapa público das denúncias em aberto">
        <MapContainer center={centro} zoom={13} scrollWheelZoom className="public-complaints-map-canvas">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {/* Antonio - Atividade 13: reajusta o tamanho do mapa após montar e a cada mudança do container. */}
          <MapResizeFix />
          {denuncias.map((denuncia) => (
            <CircleMarker
              key={denuncia.id}
              center={[denuncia.latitude, denuncia.longitude]}
              radius={8}
              pathOptions={{ color: coresStatus[denuncia.status] ?? '#1564c0', fillColor: coresStatus[denuncia.status] ?? '#1564c0', fillOpacity: 0.8 }}
            >
              <Popup>
                <strong>{denuncia.title || denuncia.type}</strong>
                <br />{denuncia.protocol}
                <br />Status: {rotulosStatus[denuncia.status] ?? denuncia.status}
                <br />Categorias: {denuncia.categories.join(', ')}
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      <div className="public-complaints-map-legend" aria-label="Legenda do mapa">
        {Object.entries(rotulosStatus).map(([status, rotulo]) => (
          <span key={status}><i style={{ backgroundColor: coresStatus[status] }} />{rotulo}</span>
        ))}
      </div>
      {/* Antonio - Atividade 13: total de denúncias em aberto como observação abaixo da legenda, no singular quando for 1. */}
      {carregado && !erro && (
        <p className="public-complaints-map-note">
          <strong>Observação:</strong> {denuncias.length} {denuncias.length === 1 ? 'denúncia' : 'denúncias'} em aberto
        </p>
      )}
    </section>
  )
}
