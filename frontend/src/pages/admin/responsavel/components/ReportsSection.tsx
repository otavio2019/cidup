import type { AdminComplaint } from '../types'
import { ALL_PERIODS, monthLabel, percent } from '../utils'
import { Metric } from './PanelPrimitives'

// ===== RESPONSÁVEL: RELATÓRIOS E INDICADORES =====
// QUEM USA: ResponsiblePanelPage.tsx. DADOS: denúncias filtradas pelo período selecionado.

type ReportsSectionProps = {
  complaints: AdminComplaint[]
  categories: Array<[string, number]>
  period: string
  periodOptions: string[]
  onPeriodChange: (period: string) => void
  onExport: () => void
}

// Exibe métricas e gráficos das denúncias no período selecionado.
export function ReportsSection({ complaints, categories, period, periodOptions, onPeriodChange, onExport }: ReportsSectionProps) {
  const total = complaints.length
  const resolved = complaints.filter((complaint) => complaint.status === 'Resolvida').length
  const open = total - resolved
  const weekCounts = [0, 0, 0, 0, 0]
  complaints.forEach((complaint) => {
    weekCounts[Math.min(Math.floor((new Date(complaint.createdAt).getDate() - 1) / 7), 4)] += 1
  })
  const maxWeek = Math.max(...weekCounts, 1)
  const maxCategory = Math.max(...categories.map(([, count]) => count), 1)
  // Formata percentuais com uma casa decimal e vírgula.
  const format = (value: number) => `${value.toFixed(1).replace('.', ',')}%`

  return (
    <>
      <div className="rp-page-heading rp-heading-with-action">
        <div><h1>Relatórios e indicadores</h1><p>Acompanhe os resultados dos atendimentos.</p></div>
        <label className="rp-period-select">
          Período
          <select value={period} onChange={(event) => onPeriodChange(event.target.value)}>
            <option value={ALL_PERIODS}>Todos os períodos</option>
            {periodOptions.map((key) => <option key={key} value={key}>{monthLabel(key)}</option>)}
          </select>
        </label>
      </div>
      <section className="rp-report-metrics">
        <Metric label="Total de denúncias" value={String(total)} note="No período selecionado" color="blue" />
        <Metric label="Resolvidas" value={String(resolved)} note={`${format(percent(resolved, total))} do total`} color="green" />
        <Metric label="Em aberto" value={String(open)} note={`${format(percent(open, total))} do total`} color="gold" />
      </section>
      <div className="rp-report-grid">
        <section className="rp-panel rp-monthly-panel">
          <h2>Denúncias por semana do mês</h2>
          <div className="rp-chart" aria-label="Gráfico de denúncias recebidas por semana">
            <div className="rp-chart-bars">
              {weekCounts.map((count, index) => (
                <div className="rp-chart-column" key={index}>
                  <span
                    style={{ height: `${percent(count, maxWeek)}%`, ...(count === 0 && { minHeight: 0 }) }}
                    title={`${count} denúncias`}
                  />
                  <small>Sem {index + 1} ({count})</small>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="rp-panel rp-category-panel">
          <h2>Distribuição por categoria</h2>
          {categories.length === 0 && <p className="rp-empty-state">Sem denúncias no período.</p>}
          {categories.map(([label, value]) => (
            <div className="rp-category-bar" key={label}>
              <div><strong>{label}</strong><span>{value}</span></div>
              <div className="rp-bar-track"><span className="rp-bar-fill rp-fill-blue" style={{ width: `${percent(value, maxCategory)}%` }} /></div>
            </div>
          ))}
        </section>
      </div>
      <button className="rp-outline-button rp-export-bottom" type="button" onClick={onExport}>↓ Baixar dados do período</button>
    </>
  )
}
