import { Link } from 'react-router-dom'

type CitizenSection = 'home' | 'create' | 'complaints' | 'profile'

// Renderiza a navegação principal do cidadão e destaca a seção em que ele está.
function CitizenHeader({ active }: { active: CitizenSection }) {
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
      </nav>

      <Link className={`profile-button${active === 'profile' ? ' is-current' : ''}`} to="/perfil">
        <span className="profile-icon" aria-hidden="true">●</span>
        Meu perfil
      </Link>
    </header>
  )
}

export default CitizenHeader
