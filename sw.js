self.addEventListener('push', (event) => {
  let dados = {
    id: null,
    title: 'CidUp',
    message: 'Você recebeu uma nova notificação.',
    url: '/responsavel/dashboard',
    complaintId: null,
  }

  if (event.data) {
    try {
      dados = { ...dados, ...event.data.json() }
    } catch {
      dados.message = event.data.text()
    }
  }

  event.waitUntil(
    self.registration.showNotification(dados.title, {
      body: dados.message,
      icon: '/cidup-logo.png',
      badge: '/cidup-logo.png',
      tag: `cidup-${dados.id ?? Date.now()}`,
      renotify: true,
      data: { url: dados.url, complaintId: dados.complaintId },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/responsavel/dashboard'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      const janelaCidup = janelas.find((janela) => 'focus' in janela)
      if (janelaCidup) {
        janelaCidup.navigate(url)
        return janelaCidup.focus()
      }
      return clients.openWindow(url)
    }),
  )
})
