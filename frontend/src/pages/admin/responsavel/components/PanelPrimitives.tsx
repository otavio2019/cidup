import type { ComplaintPriority, ComplaintStatus } from '../types'
import { priorityLabels } from '../utils'

// ===== RESPONSÁVEL: ELEMENTOS COMPARTILHADOS =====
// Usado pelas telas de denúncias, visão geral, relatórios e configurações.

// Exibe a prioridade da denúncia ou nada quando ela não foi definida.
export function PriorityBadge({ priority }: { priority: ComplaintPriority | null }) {
  if (!priority) return null
  return <span className={`rp-priority rp-priority-${priority.toLowerCase()}`}>Prioridade {priorityLabels[priority].toLowerCase()}</span>
}

// Exibe o status da denúncia com uma classe visual correspondente.
export function StatusBadge({ status }: { status: ComplaintStatus }) {
  const className = status.toLocaleLowerCase('pt-BR').replaceAll(' ', '-')
  return <span className={`rp-status rp-status-${className}`}>{status}</span>
}

// Apresenta um indicador com valor, descrição e cor.
export function Metric({ label, value, note, color }: { label: string; value: string; note: string; color: string }) {
  return <article className={`rp-metric rp-metric-${color}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>
}

// Organiza um rótulo e seu valor em uma linha de detalhes.
export function Info({ label, value }: { label: string; value: string }) {
  return <div className="rp-info-row"><dt>{label}</dt><dd>{value}</dd></div>
}
