import { lazy, Suspense } from 'react'
import CitizenHeader from '../../components/usuario/CitizenHeader'
import CitizenMobileNav from '../../components/usuario/CitizenMobileNav'
import '../../App.css'

const PublicComplaintsMap = lazy(() => import('../../components/usuario/PublicComplaintsMap'))

export default function PublicMapPage() {
  return (
    <main className="my-complaints-page public-map-page">
      <CitizenHeader active="map" />
      <section className="complaints-page-content" aria-labelledby="public-map-title">
        <div className="my-complaints-heading">
          <div>
            <p className="complaint-kicker">MAPA PÚBLICO</p>
            <h2 id="public-map-title">Denúncias em aberto</h2>
            <p>Acompanhe no mapa as ocorrências recebidas, em análise, encaminhadas e em atendimento.</p>
          </div>
        </div>
        <Suspense fallback={<section className="public-complaints-map-section" aria-busy="true">Carregando mapa das denúncias...</section>}>
          <PublicComplaintsMap />
        </Suspense>
      </section>
      <CitizenMobileNav />
    </main>
  )
}
