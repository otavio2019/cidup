// ===== RESPONSÁVEL: TIPOS DO PAINEL =====
// Compartilhados pela página administrativa e seus componentes de apresentação.

export type ComplaintStatus = 'Recebida' | 'Em análise' | 'Encaminhada' | 'Em atendimento' | 'Resolvida' | 'Negada'
export type ComplaintPriority = 'BAIXA' | 'MEDIA' | 'ALTA'

export type ComplaintHistory = {
  id: number
  description: string
  observation: string
  createdAt: string
  photo: string
}

export type AdminComplaint = {
  id?: number
  protocol: string
  title: string
  description: string
  neighborhood: string
  date: string
  createdAt: string
  status: ComplaintStatus
  category: string
  categories: string[]
  responsibleOrganizations?: string[]
  address: string
  latitude: number
  longitude: number
  updatedAt: string
  photo?: string | null
  priority: ComplaintPriority | null
  citizen: string
  email: string
  phone: string
  cpf: string
  citizenPhoto?: string | null
  sector: string
  sectorId?: number
  history: ComplaintHistory[]
}

export type ApiComplaint = {
  id: number
  protocol: string
  title: string
  description: string
  address: string
  status: string
  createdAt: string
  updatedAt: string
  latitude: number
  longitude: number
  photo?: string | null
  priority?: ComplaintPriority | null
  type: { name: string }
  categories: string[]
  responsibleOrganizations?: string[]
  orgao?: { id_orgao: number; nome: string } | null
  citizen?: string
  citizenEmail?: string
  citizenPhone?: string
  citizenCpf?: string
  citizenPhoto?: string | null
  history?: ComplaintHistory[]
}

export type Organization = { id_orgao: number; nome: string; descricao: string }

export type PasswordRecoveryRequest = {
  id: number
  requestedAt: string
  citizen: string
  email: string
  phone: string | null
  cpf: string | null
}

export type ResponsibleProfile = {
  name: string
  email: string
  phone: string
  orgao: { id_orgao: number; nome: string } | null
}
