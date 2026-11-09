// ===== REGRAS E FORMATO DAS DENÚNCIAS =====
// Categorias, prioridade, roteamento para órgãos, distância e adaptação para o frontend.
// QUEM USA: routes/usuario/complaints.ts e routes/usuario/aiDraft.ts.

// Normaliza texto para que a regra funcione com ou sem acentos e diferenças de caixa.
export function normalizeRoutingText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
}

// ----- Roteamento automático: tipo da denúncia -> órgão responsável -----
// Cada regra liga palavras do TIPO (typeKeywords)
// a palavras do NOME do órgão (organizationKeywords).
// QUEM USA: findOrganizationByComplaintType, chamada ao criar denúncia (POST /api/complaints).
const organizationRoutingRules = [
  { typeKeywords: ['buraco', 'calcada', 'sinalizacao', 'pavimento'], organizationKeywords: ['obra', 'infraestrutura'] },
  { typeKeywords: ['iluminacao', 'poste', 'lampada'], organizationKeywords: ['iluminacao'] },
  { typeKeywords: ['lixo', 'descarte', 'entulho', 'limpeza'], organizationKeywords: ['limpeza'] },
  { typeKeywords: ['arvore', 'area verde', 'meio ambiente'], organizationKeywords: ['meio ambiente', 'ambiental'] },
  { typeKeywords: ['alagamento', 'drenagem', 'esgoto', 'saneamento'], organizationKeywords: ['saneamento', 'drenagem'] },
]
// Categorias aceitas em denúncias e na sugestão da IA.
// Mantenha igual à lista de categorias do frontend (CreateComplaintPage.tsx).
export const supportedComplaintCategories = [
  'Buraco ou problema na via',
  'Iluminação pública',
  'Lixo ou descarte irregular',
  'Calçada ou acessibilidade',
  'Árvore ou área verde',
  'Alagamento ou drenagem',
  'Sinalização de trânsito',
  'Outro problema urbano',
]
// Prioridade sugerida pela IA: gravada como código e exibida com acento.
export const complaintPriorityLabels = { BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta' } as const
export type ComplaintPriority = keyof typeof complaintPriorityLabels

// Aceita "Alta", "média", "MEDIA" etc. e devolve o código, ou null se não for uma prioridade válida.
export function normalizePriority(value: unknown): ComplaintPriority | null {
  if (typeof value !== 'string') return null
  const code = value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase()
  return code in complaintPriorityLabels ? code as ComplaintPriority : null
}

// Raio (em metros) para considerar duas denúncias como "próximas".
export const NEARBY_COMPLAINT_RADIUS_METERS = 50
// Raio médio da Terra, usado na fórmula de distância (distanceInMeters).
const EARTH_RADIUS_METERS = 6_371_000

// Encontra o órgão responsável exclusivamente com base no tipo informado pelo cidadão.
export function findOrganizationByComplaintType(type: string, organizations: Array<{ id_orgao: number; nome: string }>) {
  const normalizedType = normalizeRoutingText(type)
  const rule = organizationRoutingRules.find(({ typeKeywords }) =>
    typeKeywords.some((keyword) => normalizedType.includes(keyword)),
  )
  if (!rule) return organizations.find(({ nome }) => normalizeRoutingText(nome).includes('obra'))
  return organizations.find(({ nome }) => {
    const normalizedName = normalizeRoutingText(nome)
    return rule.organizationKeywords.some((keyword) => normalizedName.includes(keyword))
  })
}

// Adapta os campos do banco (português) ao formato de denúncia usado pelo frontend (inglês).
// QUEM USA: todas as rotas /api/complaints e /api/history que devolvem denúncia.
// Exemplo: id_denuncia vira id e protocol ("CIDUP-<id>").
export function complaintResponse(complaint: {
  id_denuncia: number
  titulo: string
  descricao: string
  tipo: string
  categorias?: string[]
  status: string
  data_registro: Date
  atualizada_em?: Date
  endereco: string
  latitude: number
  longitude: number
  foto?: string | null
  prioridade?: string | null
  id_usuario: number
  id_orgao: number
  orgao?: { id_orgao: number; nome: string } | null
  orgaos_extras?: Array<{ id_orgao: number; nome: string }>
  usuario?: { id_usuario: number; nome: string; email: string; telefone?: string | null; cpf?: string | null; foto?: string | null } | null
  historico?: Array<{ id_historico: number; descricao: string; observacao: string; foto?: string; data_criacao?: Date }>
}) {
  // 1) "Atualizada em" = a data mais recente entre registro, edição e histórico.
  const updatedAtValues = [
    complaint.data_registro,
    complaint.atualizada_em,
    ...(complaint.historico ?? []).map((item) => item.data_criacao),
  ].filter((date): date is Date => date instanceof Date && Number.isFinite(date.getTime()))
  const updatedAt = new Date(Math.max(...updatedAtValues.map((date) => date.getTime()))).toISOString()
  // 2) Devolve os campos originais + os nomes em inglês que o frontend espera.
  return {
    ...complaint,
    id: complaint.id_denuncia,
    protocol: `CIDUP-${complaint.id_denuncia}`,
    title: complaint.titulo,
    description: complaint.descricao,
    address: complaint.endereco,
    photo: complaint.foto ?? null,
    priority: normalizePriority(complaint.prioridade),
    neighborhood: '',
    number: '',
    complement: '',
    createdAt: complaint.data_registro.toISOString(),
    registeredAt: complaint.data_registro.toISOString(),
    type: { name: complaint.tipo },
    categories: complaint.categorias?.length ? complaint.categorias : [complaint.tipo],
    responsibleOrganizations: [
      ...(complaint.orgao ? [complaint.orgao.nome] : []),
      ...(complaint.orgaos_extras ?? []).map((organization) => organization.nome),
    ],
    latitude: complaint.latitude,
    longitude: complaint.longitude,
    updatedAt,
    citizen: complaint.usuario?.nome ?? '',
    citizenEmail: complaint.usuario?.email ?? '',
    citizenPhone: complaint.usuario?.telefone ?? '',
    citizenCpf: complaint.usuario?.cpf ?? '',
    citizenPhoto: complaint.usuario?.foto ?? null,
    history: (complaint.historico ?? []).map((item) => ({
      id: item.id_historico,
      description: item.descricao,
      observation: item.observacao,
      photo: item.foto ?? '',
      createdAt: item.data_criacao?.toISOString() ?? complaint.data_registro.toISOString(),
    })),
  }
}

// Calcula a distância em metros entre dois pontos de GPS (fórmula de Haversine).
// QUEM USA: busca de denúncias próximas (NEARBY_COMPLAINT_RADIUS_METERS), na criação da denúncia.
export function distanceInMeters(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number) {
  // Converte graus para radianos antes do cálculo da distância.
  const toRadians = (degrees: number) => degrees * Math.PI / 180
  const latitudeDelta = toRadians(latitudeB - latitudeA)
  const longitudeDelta = toRadians(longitudeB - longitudeA)
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(latitudeA)) * Math.cos(toRadians(latitudeB)) * Math.sin(longitudeDelta / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine))
}
