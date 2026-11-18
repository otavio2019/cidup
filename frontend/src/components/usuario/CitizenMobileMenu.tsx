import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { NotificationBell } from '../../pages/admin/responsavel/components/NotificationBell'
import { logoutCitizen } from '../../services/citizenSession'
import CitizenPushButton from './CitizenPushButton'

// Antonio - Atividade 10: menu ☰ do cabeçalho do cidadão no celular (até 980px). Reúne, nesta ordem, Meu perfil, Notificações (mesmo NotificationBell + "Ativar avisos"), Central de ajuda e Sair, que antes ficavam soltos no cabeçalho.
function CitizenMobileMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [logoutError, setLogoutError] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const location = useLocation()
  const navigate = useNavigate()

  // Antonio - Atividade 10: fecha o menu ao mudar de tela (rota ou âncora).
  const routeKey = `${location.pathname}${location.hash}`
  const [lastRouteKey, setLastRouteKey] = useState(routeKey)
  if (lastRouteKey !== routeKey) {
    setLastRouteKey(routeKey)
    setIsOpen(false)
  }

  // Antonio - Atividade 10: fecha ao tocar fora do menu ou ao apertar Esc (devolvendo o foco ao botão ☰).
  useEffect(() => {
    if (!isOpen) return undefined
    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // Antonio - Atividade 10: "Sair" usa o mesmo logout do perfil (logoutCitizen); em caso de erro o menu continua aberto mostrando a mensagem.
  async function handleLogout() {
    setLogoutError('')
    setIsLoggingOut(true)
    try {
      await logoutCitizen()
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : 'Não foi possível encerrar a sessão.')
      setIsLoggingOut(false)
      return
    }
    setIsOpen(false)
    navigate('/login', { replace: true })
  }

  const closeMenu = () => setIsOpen(false)
  const unreadLabel = unreadCount > 99 ? '99+' : String(unreadCount)

  return (
    <div className="citizen-menu" ref={menuRef}>
      {/* Antonio - Atividade 10: botão ☰ / ✕ com aria-label, aria-expanded e aria-controls; a bolinha mostra as notificações não lidas com o menu fechado. */}
      <button
        ref={buttonRef}
        className="citizen-menu-button"
        type="button"
        aria-label={isOpen ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((current) => !current)}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
          {isOpen
            ? <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            : <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
        </svg>
        {!isOpen && unreadCount > 0 && <span className="citizen-menu-count" aria-hidden="true">{unreadLabel}</span>}
      </button>

      {/* Antonio - Atividade 10: o painel fica sempre montado (só escondido via CSS) para as notificações continuarem atualizando e o aviso flutuante aparecer com o menu fechado. */}
      <div id={panelId} className={`citizen-menu-panel${isOpen ? ' is-open' : ''}`}>
        <Link className="citizen-menu-item" to="/perfil" onClick={closeMenu}>
          <span className="citizen-menu-icon" aria-hidden="true">●</span>
          Meu perfil
        </Link>

        <section className="citizen-menu-notifications" aria-label="Notificações">
          <div className="citizen-menu-item citizen-menu-heading">
            <span className="citizen-menu-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            Notificações
            {unreadCount > 0 && <span className="citizen-menu-unread">{unreadLabel} não lidas</span>}
          </div>
          <CitizenPushButton />
          <NotificationBell inline onUnreadCountChange={setUnreadCount} onToastOpen={() => setIsOpen(true)} />
        </section>

        <Link className="citizen-menu-item" to="/dashboard#ajuda" onClick={closeMenu}>
          <span className="citizen-menu-icon" aria-hidden="true">?</span>
          Central de ajuda
        </Link>

        <button className="citizen-menu-item citizen-menu-logout" type="button" onClick={() => void handleLogout()} disabled={isLoggingOut}>
          <span className="citizen-menu-icon" aria-hidden="true">↪</span>
          {isLoggingOut ? 'Saindo...' : 'Sair'}
        </button>
        {logoutError && <p className="form-message citizen-menu-error" role="alert">{logoutError}</p>}
      </div>
    </div>
  )
}

export default CitizenMobileMenu
