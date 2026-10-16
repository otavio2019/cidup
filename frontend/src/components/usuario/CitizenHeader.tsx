import { Link } from 'react-router-dom'

type CitizenSection = 'home' | 'create' | 'complaints' | 'profile'

function CitizenHeader({ active }: { active: CitizenSection }) {
  return (
    <header className="dashboard-header citizen-header">
      <Link className="dashboard-brand complaints-brand" to="/dashboard" aria-label="CidUp, início">
        <span className="citizen-brand-mark" aria-hidden="true">C</span>
        <span className="citizen-brand-copy">
          <strong>CidUp</strong>
          <small>Cidades melhores começam com você</small>
        </span>
      </Link>

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
