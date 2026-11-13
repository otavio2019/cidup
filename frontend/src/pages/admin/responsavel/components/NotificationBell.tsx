import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../../../../api'
import { sincronizarNotificacoesPush } from '../../../../pushNotifications'

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

// Consulta as notificações do responsável e permite marcar cada item ou todos como lidos.
export function NotificationBell() {
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
      <button
        className="rp-notification-button"
        type="button"
        aria-label={unreadCount > 0 ? `Notificações, ${unreadCount} não lidas` : 'Notificações'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span aria-hidden="true" className="rp-notification-icon">!</span>
        {unreadCount > 0 && <span className="rp-notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {isOpen && (
        <section className="rp-notification-panel" aria-label="Notificações">
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
