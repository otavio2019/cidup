import { useEffect, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import { apiRequest } from '../../api'
import 'leaflet/dist/leaflet.css'

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
  const centro: [number, number] = [-7.23056, -35.88111]

  useEffect(() => {
    let ativo = true
    apiRequest<{ complaints: DenunciaPublica[] }>('/api/public/complaints')
      .then((data) => {
        if (ativo) setDenuncias(data.complaints)
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
        <span className="public-complaints-map-count">{denuncias.length} no mapa</span>
      </div>
      {erro && <p className="form-message" role="alert">{erro}</p>}
      <div className="public-complaints-map" aria-label="Mapa público das denúncias em aberto">
        <MapContainer center={centro} zoom={13} scrollWheelZoom className="public-complaints-map-canvas">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
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
    </section>
  )
}
