import { NavLink, useLocation } from 'react-router-dom'
import './CitizenMobileNav.css'

function CitizenMobileNav() {
  const location = useLocation()
  const isNewComplaint = location.pathname.startsWith('/registrar-denuncia')
    || location.pathname.startsWith('/denuncia/')

  return (
    <nav className="citizen-mobile-nav" aria-label="Navegação mobile">
      <NavLink to="/dashboard" end className={({ isActive }) => `citizen-mobile-link${isActive ? ' is-active' : ''}`}>
        <span className="citizen-mobile-icon" aria-hidden="true">⌂</span>
        <span>Início</span>
      </NavLink>
      <NavLink to="/minhas-denuncias" className={({ isActive }) => `citizen-mobile-link${isActive ? ' is-active' : ''}`}>
        <span className="citizen-mobile-icon" aria-hidden="true">▤</span>
        <span>Denúncias</span>
      </NavLink>
      <NavLink to="/registrar-denuncia" className={`citizen-mobile-link citizen-mobile-create${isNewComplaint ? ' is-active' : ''}`} aria-label="Registrar denúncia">
        <span aria-hidden="true">＋</span>
      </NavLink>
      <NavLink to="/perfil" className={({ isActive }) => `citizen-mobile-link${isActive ? ' is-active' : ''}`}>
        <span className="citizen-mobile-icon" aria-hidden="true">♙</span>
        <span>Perfil</span>
      </NavLink>
    </nav>
  )
}

export default CitizenMobileNav