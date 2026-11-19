import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

// Antonio - Atividade 13: o Leaflet mede o container só ao montar e quando a JANELA muda de tamanho. Se o container muda depois (Suspense, mensagem de erro, barra de rolagem, barra de endereço do celular), o mapa fica com área cinza e só um pedaço desenhado. Este componente chama map.invalidateSize() logo após montar e sempre que o container mudar de tamanho (ResizeObserver nativo). Não altera centro, zoom nem marcadores. Usado em PublicComplaintsMap e InteractiveLocationMap.
function MapResizeFix() {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()
    const refresh = () => map.invalidateSize()
    const frame = window.requestAnimationFrame(refresh)
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(refresh) : null
    observer?.observe(container)
    return () => {
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [map])

  return null
}

export default MapResizeFix
