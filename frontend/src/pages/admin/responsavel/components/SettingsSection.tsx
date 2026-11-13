import { useState } from 'react'
import type { ResponsibleProfile } from '../types'
import { Info } from './PanelPrimitives'
import { ativarNotificacoesPush } from '../../../../pushNotifications'

// ===== RESPONSÁVEL: CONFIGURAÇÕES DA CONTA =====
// QUEM USA: ResponsiblePanelPage.tsx. DADOS: sessão autenticada em /api/auth/session.

// Apresenta os dados da conta autenticada do responsável.
export function SettingsSection({ profile }: { profile: ResponsibleProfile | null }) {
  const [message, setMessage] = useState('')
  const [isActivating, setIsActivating] = useState(false)

  async function enableNotifications() {
    setIsActivating(true)
    setMessage('Ativando notificações...')
    try {
      await ativarNotificacoesPush()
      setMessage('Notificações ativadas. Você receberá avisos mesmo com o painel fechado.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível ativar as notificações.')
    } finally {
      setIsActivating(false)
    }
  }

  return (
    <>
      <div className="rp-page-heading"><div><h1>Configurações</h1><p>Dados da conta do responsável.</p></div></div>
      <div className="rp-settings-grid">
        <section className="rp-panel rp-settings-panel"><h2>Perfil responsável</h2><dl>
          <Info label="Nome" value={profile?.name ?? '—'} />
          <Info label="E-mail" value={profile?.email ?? '—'} />
          <Info label="Telefone" value={profile?.phone ?? '—'} />
          <Info label="Órgão" value={profile?.orgao?.nome ?? 'Não vinculado'} />
        </dl></section>
        <section className="rp-panel rp-settings-panel">
          <h2>Notificações do navegador</h2>
          <p>Receba avisos de novas denúncias e recuperações de senha mesmo quando o painel estiver fechado.</p>
          <button type="button" className="primary-action" onClick={() => void enableNotifications()} disabled={isActivating}>
            {isActivating ? 'Ativando...' : 'Ativar notificações'}
          </button>
          {message && <p role="status" className="rp-settings-feedback">{message}</p>}
        </section>
      </div>
    </>
  )
}
