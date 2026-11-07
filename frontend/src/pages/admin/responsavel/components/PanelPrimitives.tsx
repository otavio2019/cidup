import type { ComplaintPriority, ComplaintStatus } from '../types'
import { priorityLabels } from '../utils'

// ===== RESPONSÁVEL: ELEMENTOS COMPARTILHADOS =====
// Usado pelas telas de denúncias, visão geral, relatórios e configurações.

export function PriorityBadge({ priority }: { priority: ComplaintPriority | null }) {
  if (!priority) return null
  return <span className={`rp-priority rp-priority-${priority.toLowerCase()}`}>Prioridade {priorityLabels[priority].toLowerCase()}</span>
}

export function StatusBadge({ status }: { status: ComplaintStatus }) {
  const className = status.toLocaleLowerCase('pt-BR').replaceAll(' ', '-')
  return <span className={`rp-status rp-status-${className}`}>{status}</span>
}

export function Metric({ label, value, note, color }: { label: string; value: string; note: string; color: string }) {
  return <article className={`rp-metric rp-metric-${color}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>
}

export function Info({ label, value }: { label: string; value: string }) {
  return <div className="rp-info-row"><dt>{label}</dt><dd>{value}</dd></div>
}
