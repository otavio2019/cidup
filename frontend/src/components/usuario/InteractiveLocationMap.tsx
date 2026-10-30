import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L, { type LatLngLiteral } from 'leaflet'
import 'leaflet/dist/leaflet.css'

type InteractiveLocationMapProps = {
  coordinates: LatLngLiteral | null
  onPositionChange: (coordinates: LatLngLiteral) => void
  onRequestLocation?: () => void
  isLocating?: boolean
}

function MapCenterUpdater({ coordinates }: { coordinates: LatLngLiteral }) {
  const map = useMap()

  useEffect(() => {
    map.setView(coordinates, Math.max(map.getZoom(), 17), { animate: true })
  }, [coordinates, map])

  return null
}

function MapClickHandler({ onPositionChange }: { onPositionChange: (coordinates: LatLngLiteral) => void }) {
  useMapEvents({
    click: (event) => onPositionChange({ lat: event.latlng.lat, lng: event.latlng.lng }),
  })
  return null
}

function InteractiveLocationMap({ coordinates, onPositionChange, onRequestLocation, isLocating = false }: InteractiveLocationMapProps) {
  const defaultCenter = useMemo<LatLngLiteral>(() => ({ lat: -7.23056, lng: -35.88111 }), [])
  const markerIcon = useMemo(() => L.divIcon({
    className: 'cidup-map-marker',
    html: '<span aria-hidden="true">⌖</span>',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -34],
  }), [])
  const center = coordinates ?? defaultCenter

  return (
    <div className="interactive-location-map" aria-label="Mapa interativo da localização da denúncia">
      <MapContainer center={center} zoom={coordinates ? 17 : 13} scrollWheelZoom className="location-map-canvas">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapCenterUpdater coordinates={center} />
        <MapClickHandler onPositionChange={onPositionChange} />
        {coordinates && (
          <Marker
            position={coordinates}
            icon={markerIcon}
            draggable
            eventHandlers={{
              dragend: (event) => {
                const marker = event.target as L.Marker
                const position = marker.getLatLng()
                onPositionChange({ lat: position.lat, lng: position.lng })
              },
            }}
          >
            <Popup>Local da denúncia. Arraste o marcador ou clique no mapa para ajustar.</Popup>
          </Marker>
        )}
      </MapContainer>
      {onRequestLocation && (
        <button className="map-location-button" type="button" onClick={onRequestLocation} disabled={isLocating}>
          {isLocating ? 'Obtendo localização...' : 'Usar minha localização atual'}
        </button>
      )}
      <p className="location-map-help">Clique no mapa ou arraste o marcador para ajustar o ponto exato da ocorrência.</p>
    </div>
  )
}

export default InteractiveLocationMap
