import type { AdminComplaint, ApiComplaint, ComplaintStatus } from './types'

// ===== RESPONSÁVEL: REGRAS E CONVERSÕES DO PAINEL =====
// Centraliza conversões da API e cálculos compartilhados entre as seções administrativas.

export const ALL_PERIODS = 'all'
export const statusOptions: ComplaintStatus[] = ['Recebida', 'Em análise', 'Encaminhada', 'Em atendimento', 'Resolvida', 'Negada']

export const priorityLabels = { BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta' } as const

export function monthKey(isoDate: string) {
  const date = new Date(isoDate)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number)
  const label = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toLocaleUpperCase('pt-BR') + label.slice(1)
}

export function relativeTime(isoDate: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(isoDate).getTime()) / 60000))
  if (minutes < 60) return `há ${Math.max(minutes, 1)} min`
  if (minutes < 1440) return `há ${Math.floor(minutes / 60)} h`
  return `há ${Math.floor(minutes / 1440)} d`
}

export function percent(part: number, total: number) {
  return total === 0 ? 0 : (part / total) * 100
}

const NEARBY_RADIUS_METERS = 50

function distanceInMeters(first: AdminComplaint, second: AdminComplaint) {
  const earthRadius = 6371000
  const radians = (value: number) => value * Math.PI / 180
  const latitudeDelta = radians(second.latitude - first.latitude)
  const longitudeDelta = radians(second.longitude - first.longitude)
  const firstLatitude = radians(first.latitude)
  const secondLatitude = radians(second.latitude)
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2
  return 2 * earthRadius * Math.asin(Math.sqrt(value))
}

function shareCategory(first: AdminComplaint, second: AdminComplaint) {
  return first.categories.some((category) => second.categories.includes(category))
}

// Agrupa denúncias da mesma categoria que foram registradas em até 50 metros.
export function groupNearbyComplaints(records: AdminComplaint[]) {
  const groups: AdminComplaint[][] = []
  const assigned = new Set<number>()

  records.forEach((record, index) => {
    if (assigned.has(index)) return
    const group = [record]
    assigned.add(index)
    let changed = true
    while (changed) {
      changed = false
      records.forEach((candidate, candidateIndex) => {
        if (assigned.has(candidateIndex)) return
        if (group.some((member) => shareCategory(member, candidate)
          && distanceInMeters(member, candidate) <= NEARBY_RADIUS_METERS)) {
          group.push(candidate)
          assigned.add(candidateIndex)
          changed = true
        }
      })
    }
    groups.push(group)
  })

  return groups
}

export function apiStatusToLabel(status: string): ComplaintStatus {
  return ({
    RECEIVED: 'Recebida',
    IN_ANALYSIS: 'Em análise',
    FORWARDED: 'Encaminhada',
    IN_SERVICE: 'Em atendimento',
    RESOLVED: 'Resolvida',
    NOT_SERVED: 'Negada',
  } as Record<string, ComplaintStatus>)[status] ?? 'Recebida'
}

export function labelToApiStatus(status: ComplaintStatus) {
  return ({
    Recebida: 'RECEIVED',
    'Em análise': 'IN_ANALYSIS',
    Encaminhada: 'FORWARDED',
    'Em atendimento': 'IN_SERVICE',
    Resolvida: 'RESOLVED',
    Negada: 'NOT_SERVED',
  } as Record<ComplaintStatus, string>)[status]
}

// Converte o contrato da API para o modelo usado nas telas administrativas.
export function mapApiComplaint(complaint: ApiComplaint): AdminComplaint {
  return {
    id: complaint.id,
    protocol: complaint.protocol,
    title: complaint.title,
    description: complaint.description,
    neighborhood: '',
    date: new Date(complaint.createdAt).toLocaleDateString('pt-BR'),
    createdAt: complaint.createdAt,
    updatedAt: complaint.updatedAt ?? complaint.createdAt,
    status: apiStatusToLabel(complaint.status),
    category: complaint.type.name,
    categories: complaint.categories?.length ? complaint.categories : [complaint.type.name],
    responsibleOrganizations: complaint.responsibleOrganizations,
    address: complaint.address,
    latitude: complaint.latitude,
    longitude: complaint.longitude,
    photo: complaint.photo ?? null,
    priority: complaint.priority ?? null,
    citizen: complaint.citizen || 'Cidadão não informado',
    email: complaint.citizenEmail || 'E-mail não informado',
    phone: complaint.citizenPhone || 'Telefone não informado',
    cpf: complaint.citizenCpf || 'CPF não informado',
    citizenPhoto: complaint.citizenPhoto ?? null,
    sector: complaint.responsibleOrganizations?.length
      ? complaint.responsibleOrganizations.join(', ')
      : complaint.orgao?.nome ?? 'Não encaminhada',
    sectorId: complaint.orgao?.id_orgao,
    history: complaint.history ?? [],
  }
}
