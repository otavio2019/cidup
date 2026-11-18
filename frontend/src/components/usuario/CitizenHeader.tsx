import { useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { NotificationBell } from '../../pages/admin/responsavel/components/NotificationBell'
import CitizenPushButton from './CitizenPushButton'
// Antonio - Atividade 10: menu ☰ usado no lugar de "Ativar avisos", sino e "Meu perfil" até 980px.
import CitizenMobileMenu from './CitizenMobileMenu'

type CitizenSection = 'home' | 'create' | 'complaints' | 'map' | 'profile'

// Antonio - Atividade 10: detecta telas de até 980px para renderizar só um dos dois blocos (desktop ou menu ☰) e não montar o sino de notificações duas vezes (o que duplicaria as consultas e os avisos). Sem matchMedia (ex.: testes), assume desktop.
const COMPACT_HEADER_QUERY = '(max-width: 980px)'

function subscribeCompactHeader(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => undefined
  const media = window.matchMedia(COMPACT_HEADER_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function getCompactHeader() {
  return typeof window.matchMedia === 'function' && window.matchMedia(COMPACT_HEADER_QUERY).matches
}

// Renderiza a navegação principal do cidadão e destaca a seção em que ele está.
function CitizenHeader({ active }: { active: CitizenSection }) {
  // Antonio - Atividade 10: true até 980px (celular/tablet), false no desktop.
  const isCompact = useSyncExternalStore(subscribeCompactHeader, getCompactHeader, () => false)

  return (
    <header className="dashboard-header citizen-header">
      <Link className="dashboard-brand complaints-brand" to="/dashboard" aria-label="CidUp, início">
        <img className="citizen-brand-logo" src={`${import.meta.env.BASE_URL}cidup-logo.png`} alt="CidUp" />
        <span className="citizen-brand-copy">
          <small>Cidades melhores começam com você</small>
        </span>
      </Link>

      {/* Atalhos para dashboard, criação e listagem de denúncias; o perfil tem acesso próprio ao lado. */}
      <nav className="dashboard-nav" aria-label="Navegação principal">
        <Link className={active === 'home' ? 'active' : undefined} to="/dashboard">Início</Link>
        <Link className={active === 'create' ? 'active' : undefined} to="/registrar-denuncia">Registrar denúncia</Link>
        <Link className={active === 'complaints' ? 'active' : undefined} to="/minhas-denuncias">Minhas denúncias</Link>
        <Link className={active === 'map' ? 'active' : undefined} to="/mapa">Mapa</Link>
      </nav>

      {/* Antonio - Atividade 10: até 980px mostra o menu ☰; acima disso, o bloco original ("Ativar avisos", sino e "Meu perfil") sem nenhuma mudança. */}
      {isCompact ? <CitizenMobileMenu /> : (
        <div className="citizen-header-actions">
          <CitizenPushButton />
          <NotificationBell />
          <Link className={`profile-button${active === 'profile' ? ' is-current' : ''}`} to="/perfil">
            <span className="profile-icon" aria-hidden="true">●</span>
            Meu perfil
          </Link>
        </div>
      )}
    </header>
  )
}

export default CitizenHeader
