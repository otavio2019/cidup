import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

// ===== RESPONSÁVEL: ESTRUTURA E NAVEGAÇÃO =====
// QUEM USA: ResponsiblePanelPage.tsx. DADOS: perfil autenticado e ações da sessão.

const navigation = [
  { path: '/responsavel/dashboard', label: 'Painel' },
  { path: '/responsavel/denuncias', label: 'Denúncias' },
  { path: '/responsavel/recuperacao-senha', label: 'Recuperação de senha' },
  { path: '/responsavel/tipos', label: 'Tipos de ocorrência' },
  { path: '/responsavel/relatorios', label: 'Relatórios' },
  { path: '/responsavel/configuracoes', label: 'Configurações' },
]

type ResponsiblePanelLayoutProps = {
  children: ReactNode
  section: string
  heading: string
  profileName: string
  organizationName: string
  isLoggingOut: boolean
  logoutError: string
  loadError: string
  onLogout: () => void
  onNavigate: () => void
}

// Monta a navegação, o cabeçalho e a área de conteúdo do painel responsável.
export function ResponsiblePanelLayout({
  children,
  section,
  heading,
  profileName,
  organizationName,
  isLoggingOut,
  logoutError,
  loadError,
  onLogout,
  onNavigate,
}: ResponsiblePanelLayoutProps) {
  return (
    <div className="rp-shell">
      <aside className="rp-sidebar">
        <NavLink className="rp-brand" to="/responsavel/dashboard">
          <img className="rp-brand-logo" src={`${import.meta.env.BASE_URL}cidup-logo.png`} alt="CidUp" />
          <span><small>Painel do responsável</small></span>
        </NavLink>
        <nav className="rp-navigation" aria-label="Navegação do responsável">
          {navigation.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `rp-nav-link${isActive && (item.path.endsWith('/' + section) || section === '' && item.path.endsWith('dashboard')) ? ' is-active' : ''}`}
              onClick={onNavigate}
            >
              {item.label}
            </NavLink>
          ))}
          <button
            className="rp-nav-link rp-logout-button"
            type="button"
            onClick={onLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? 'Saindo...' : 'Sair'}
          </button>
        </nav>
        <div className="rp-sidebar-footer"><strong>◉ Responsável</strong><span>{organizationName}</span></div>
      </aside>
      <div className="rp-main-column">
        <header className="rp-topbar">
          <h2>{heading}</h2>
          <div className="rp-topbar-actions">
            <span className="rp-profile-button">{profileName}</span>
          </div>
        </header>
        <main className="rp-content">
          {logoutError && <p className="rp-error-message" role="alert">{logoutError}</p>}
          {loadError && <p className="rp-error-message" role="alert">{loadError}</p>}
          {children}
        </main>
      </div>
    </div>
  )
}
