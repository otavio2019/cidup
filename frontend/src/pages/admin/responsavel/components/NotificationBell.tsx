import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../../../../services/api'
import { sincronizarNotificacoesPush } from '../../../../services/pushNotifications'

// Notificação entregue pelo endpoint /api/notifications.
type NotificationItem = {
  id: number
  title: string
  message: string
  type: string
  read: boolean
  createdAt: string
  complaintId: number | null
}

type NotificationResponse = {
  notifications: NotificationItem[]
  unreadCount: number
}

// Antonio - Atividade 10: props opcionais para reutilizar o componente dentro do menu ☰ do cidadão no celular. Sem props (como no painel do responsável e no desktop do cidadão), o comportamento é exatamente o original.
type NotificationBellProps = {
  // inline: mostra a lista direto (sem o botão do sino nem o painel suspenso).
  inline?: boolean
  // Informa o total de não lidas a quem usa o componente (ex.: contador no botão ☰).
  onUnreadCountChange?: (count: number) => void
  // Chamado ao tocar no aviso flutuante no modo inline (ex.: abrir o menu ☰).
  onToastOpen?: () => void
}

// Consulta as notificações do responsável e permite marcar cada item ou todos como lidos.
// Antonio - Atividade 10: assinatura passou a aceitar NotificationBellProps (original: NotificationBell() sem parâmetros).
export function NotificationBell({ inline = false, onUnreadCountChange, onToastOpen }: NotificationBellProps = {}) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [toast, setToast] = useState<NotificationItem | null>(null)
  const knownIds = useRef<Set<number> | null>(null)
  const toastTimer = useRef<number | null>(null)

  async function loadNotifications() {
    try {
      const data = await apiRequest<NotificationResponse>('/api/notifications')
      const incoming = knownIds.current
        ? data.notifications.find((item) => !item.read && !knownIds.current?.has(item.id))
        : null
      if (incoming) {
        setToast(incoming)
        if (toastTimer.current) window.clearTimeout(toastTimer.current)
        toastTimer.current = window.setTimeout(() => setToast(null), 8000)
      }
      knownIds.current = new Set(data.notifications.map((item) => item.id))
      // O painel exibe somente notificações pendentes. As lidas continuam
      // salvas no banco, mas não reaparecem na lista do sino.
      setNotifications(data.notifications.filter((item) => !item.read))
      setUnreadCount(data.unreadCount)
    } catch {
      // A falha da área de notificações não deve impedir o uso do painel.
    }
  }

  useEffect(() => {
    void loadNotifications()
    void sincronizarNotificacoesPush().catch(() => undefined)
    const interval = window.setInterval(() => { void loadNotifications() }, 10000)
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void loadNotifications()
    }
    document.addEventListener('visibilitychange', refreshWhenVisible)
    window.addEventListener('focus', refreshWhenVisible)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      window.removeEventListener('focus', refreshWhenVisible)
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
  }, [])

  // Antonio - Atividade 10: repassa o contador de não lidas quando onUnreadCountChange é informado (só no menu ☰).
  useEffect(() => {
    onUnreadCountChange?.(unreadCount)
  }, [unreadCount, onUnreadCountChange])

  async function markAsRead(id: number) {
    try {
      await apiRequest(`/api/notifications/${id}/read`, { method: 'PATCH' })
      setNotifications((current) => current.filter((item) => item.id !== id))
      setUnreadCount((current) => Math.max(0, current - 1))
    } catch {
      // Mantém o item não lido se a API falhar.
    }
  }

  async function markAllAsRead() {
    try {
      await apiRequest('/api/notifications/read-all', { method: 'PATCH' })
      setNotifications([])
      setUnreadCount(0)
    } catch {
      // Mantém o contador se a API falhar.
    }
  }

  return (
    <div className="rp-notification-wrap">
      {toast && (
        <div className="rp-notification-toast" role="alert" aria-live="assertive">
          <button
            type="button"
            className="rp-notification-toast-content"
            onClick={() => {
              // Antonio - Atividade 10: no modo inline avisa quem usa o componente para abrir o menu (original: só setIsOpen(true)).
              if (inline) onToastOpen?.()
              setIsOpen(true)
              void markAsRead(toast.id)
              setToast(null)
            }}
          >
            <strong>{toast.title}</strong>
            <span>{toast.message}</span>
            <small>Clique para visualizar</small>
          </button>
          <button type="button" className="rp-notification-toast-close" aria-label="Fechar aviso" onClick={() => setToast(null)}>×</button>
        </div>
      )}
      {/* Antonio - Atividade 10: o botão do sino só aparece fora do modo inline (original: sempre exibido). */}
      {!inline && (
        <button
          className="rp-notification-button"
          type="button"
          aria-label={unreadCount > 0 ? `Notificações, ${unreadCount} não lidas` : 'Notificações'}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
        >
          <svg aria-hidden="true" className="rp-notification-icon" viewBox="0 0 24 24" fill="none">
            <path
              d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {unreadCount > 0 && <span className="rp-notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
        </button>
      )}

      {/* Antonio - Atividade 10: no modo inline a lista fica sempre visível e recebe a classe extra rp-notification-panel-inline (original: só quando isOpen, como painel suspenso). */}
      {(inline || isOpen) && (
        <section className={inline ? 'rp-notification-panel rp-notification-panel-inline' : 'rp-notification-panel'} aria-label="Notificações">
          <div className="rp-notification-heading">
            <strong>Notificações</strong>
            {unreadCount > 0 && <button type="button" onClick={() => void markAllAsRead()}>Marcar todas como lidas</button>}
          </div>
          {notifications.length === 0 ? (
            <p className="rp-notification-empty">Nenhuma notificação recebida.</p>
          ) : (
            <ul className="rp-notification-list">
              {notifications.map((item) => (
                <li key={item.id} className={`rp-notification-item${item.read ? '' : ' is-unread'}`}>
                  <button type="button" onClick={() => !item.read && void markAsRead(item.id)}>
                    <strong>{item.title}</strong>
                    <span>{item.message}</span>
                    <small>{new Date(item.createdAt).toLocaleString('pt-BR')}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
