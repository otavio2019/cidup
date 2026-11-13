import type { AdminComplaint } from '../types'
import { NavLink } from 'react-router-dom'
import { percent, relativeTime } from '../utils'
import { Metric } from './PanelPrimitives'

// ===== RESPONSÁVEL: VISÃO GERAL =====
// QUEM USA: ResponsiblePanelPage.tsx. DADOS: denúncias carregadas de /api/complaints.

// Resume o volume, os status e as denúncias recentes do painel.
export function DashboardSection({ complaints }: { complaints: AdminComplaint[] }) {
  const total = complaints.length
  const pendingCount = complaints.filter((complaint) => complaint.status === 'Recebida' || complaint.status === 'Em análise').length
  const inServiceCount = complaints.filter((complaint) => complaint.status === 'Em atendimento').length
  const resolvedCount = complaints.filter((complaint) => complaint.status === 'Resolvida').length
  const statusSummary: Array<[string, number, string]> = [
    ['Recebidas', complaints.filter((complaint) => complaint.status === 'Recebida').length, 'blue'],
    ['Em análise', complaints.filter((complaint) => complaint.status === 'Em análise').length, 'gold'],
    ['Em atendimento', inServiceCount, 'sky'],
    ['Resolvidas', resolvedCount, 'green'],
  ]
  const recentComplaints = [...complaints]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  return (
    <>
      <div className="rp-page-heading"><div><h1>Visão geral</h1><p>Acompanhe as denúncias recebidas.</p></div></div>
      <section className="rp-metric-grid" aria-label="Indicadores gerais">
        <Metric label="Pendentes" value={String(pendingCount)} note="Aguardando análise" color="blue" />
        <Metric label="Em atendimento" value={String(inServiceCount)} note="Em execução" color="gold" />
        <Metric label="Resolvidas" value={String(resolvedCount)} note="Total resolvido" color="green" />
        <Metric label="Total" value={String(total)} note="Denúncias registradas" color="teal" />
      </section>
      <div className="rp-dashboard-grid">
        <section className="rp-panel rp-status-panel">
          <h2>Denúncias por status</h2>
          <div className="rp-status-bars">
            {statusSummary.map(([label, count, color]) => (
              <div className="rp-bar-row" key={label}>
                <strong>{label}</strong>
                <div className="rp-bar-track"><span className={`rp-bar-fill rp-fill-${color}`} style={{ width: `${percent(count, total)}%` }} /></div>
                <b>{count}</b>
              </div>
            ))}
          </div>
        </section>
        <section className="rp-panel rp-activity-panel">
          <h2>Atividade recente</h2>
          {recentComplaints.length === 0 && <p className="rp-empty-state">Nenhuma denúncia registrada.</p>}
          {recentComplaints.map((complaint) => (
            <div className="rp-activity-item" key={complaint.protocol}>
              <span aria-hidden="true" />
              <div><strong>{complaint.title}</strong><small>{complaint.protocol} · {complaint.status} · {relativeTime(complaint.createdAt)}</small></div>
            </div>
          ))}
        </section>
      </div>
      <div className="rp-dashboard-footer"><span>Atualizado em {new Date().toLocaleDateString('pt-BR')}</span><NavLink to="/responsavel/denuncias">Acessar denúncias <span aria-hidden="true">→</span></NavLink></div>
    </>
  )
}
