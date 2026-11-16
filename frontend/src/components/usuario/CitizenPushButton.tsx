import { useEffect, useState } from 'react'
import { ativarNotificacoesPush, sincronizarNotificacoesPush } from '../../pushNotifications'

export default function CitizenPushButton() {
  const [ativado, setAtivado] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    void sincronizarNotificacoesPush().then((resultado) => setAtivado(resultado)).catch(() => undefined)
  }, [])

  async function ativar() {
    setCarregando(true)
    setMensagem('')
    try {
      await ativarNotificacoesPush()
      setAtivado(true)
      setMensagem('Avisos ativados')
      window.setTimeout(() => setMensagem(''), 4000)
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Não foi possível ativar os avisos.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="citizen-push-action">
      <button
        className="citizen-push-button"
        type="button"
        onClick={() => void ativar()}
        disabled={carregando || ativado}
        aria-label={ativado ? 'Notificações do navegador ativadas' : 'Ativar notificações do navegador'}
        title={ativado ? 'Notificações ativadas' : 'Receber avisos mesmo com o site fechado'}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{ativado ? 'Avisos ativos' : carregando ? 'Ativando...' : 'Ativar avisos'}</span>
      </button>
      {mensagem && <span className="citizen-push-message" role="status">{mensagem}</span>}
    </div>
  )
}
