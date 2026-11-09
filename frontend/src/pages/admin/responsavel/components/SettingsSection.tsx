import type { ResponsibleProfile } from '../types'
import { Info } from './PanelPrimitives'

// ===== RESPONSÁVEL: CONFIGURAÇÕES DA CONTA =====
// QUEM USA: ResponsiblePanelPage.tsx. DADOS: sessão autenticada em /api/auth/session.

// Apresenta os dados da conta autenticada do responsável.
export function SettingsSection({ profile }: { profile: ResponsibleProfile | null }) {
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
      </div>
    </>
  )
}
