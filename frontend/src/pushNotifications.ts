import { apiRequest } from './api'

function converterChavePublica(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const base64Corrigido = (base64 + padding).replaceAll('-', '+').replaceAll('_', '/')
  const dados = window.atob(base64Corrigido)
  return Uint8Array.from([...dados].map((caractere) => caractere.charCodeAt(0)))
}

export async function ativarNotificacoesPush() {
  const chavePublica = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!('serviceWorker' in navigator)) throw new Error('Este navegador não oferece Service Worker.')
  if (!('PushManager' in window)) throw new Error('Este navegador não oferece notificações Push.')
  if (!('Notification' in window)) throw new Error('Este navegador não oferece notificações.')
  if (!chavePublica) throw new Error('A chave pública das notificações ainda não foi configurada.')

  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') {
    throw new Error('Permissão para notificações não concedida. Altere essa opção nas configurações do navegador.')
  }

  const registro = await navigator.serviceWorker.register('/sw.js')
  const existente = await registro.pushManager.getSubscription()
  const inscricao = existente ?? await registro.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: converterChavePublica(chavePublica),
  })

  await apiRequest('/api/push-subscriptions', {
    method: 'POST',
    body: JSON.stringify(inscricao.toJSON()),
  })
  return inscricao
}
