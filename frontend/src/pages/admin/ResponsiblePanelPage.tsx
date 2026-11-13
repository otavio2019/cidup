import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { apiRequest } from '../../api'
import { ComplaintsSection } from './responsavel/components/ComplaintsSection'
import { ComplaintTypesSection } from './responsavel/components/ComplaintTypesSection'
import { DashboardSection } from './responsavel/components/DashboardSection'
import { PasswordRecoverySection } from './responsavel/components/PasswordRecoverySection'
import { ReportsSection } from './responsavel/components/ReportsSection'
import { ResponsiblePanelLayout } from './responsavel/components/ResponsiblePanelLayout'
import { SettingsSection } from './responsavel/components/SettingsSection'
import type {
  AdminComplaint,
  ApiComplaint,
  ComplaintStatus,
  Organization,
  PasswordRecoveryRequest,
  ResponsibleProfile,
} from './responsavel/types'
import { ALL_PERIODS, groupNearbyComplaints, labelToApiStatus, mapApiComplaint, monthKey } from './responsavel/utils'
import './ResponsiblePanelPage.css'

// ===== RESPONSÁVEL: CONTROLADOR DO PAINEL =====
// QUEM USA: rota /responsavel/* em App.tsx.
// API: denúncias, órgãos, sessão do responsável e solicitações de recuperação de senha.
// COMPONENTES: cada seção visual vive em responsavel/components.

const sectionHeadings: Record<string, string> = {
  dashboard: 'Painel',
  denuncias: 'Denúncias',
  'recuperacao-senha': 'Recuperação de senha',
  tipos: 'Tipos de ocorrência',
  relatorios: 'Relatórios',
  configuracoes: 'Configurações',
}

// Carrega os dados administrativos e coordena as seções do painel.
function ResponsiblePanelPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const section = location.pathname.split('/')[2] || 'dashboard'
  const [complaints, setComplaints] = useState<AdminComplaint[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [logoutError, setLogoutError] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [profile, setProfile] = useState<ResponsibleProfile | null>(null)
  const [recoveryRequests, setRecoveryRequests] = useState<PasswordRecoveryRequest[]>([])
  const [temporaryPasswords, setTemporaryPasswords] = useState<Record<number, string>>({})
  const [recoveryMessage, setRecoveryMessage] = useState('')
  const [selectedProtocol, setSelectedProtocol] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [period, setPeriod] = useState(ALL_PERIODS)
  const [sector, setSector] = useState('')
  const [status, setStatus] = useState<ComplaintStatus>('Recebida')
  const [observation, setObservation] = useState('')
  const [savedUpdate, setSavedUpdate] = useState(false)

  // Encerra a sessão no servidor e remove os dados locais antes de voltar ao login.
  async function handleLogout() {
    setLogoutError('')
    setIsLoggingOut(true)
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : 'Não foi possível encerrar a sessão.')
      setIsLoggingOut(false)
      return
    }

    localStorage.removeItem('cidup-role')
    localStorage.removeItem('cidup-user-id')
    localStorage.removeItem('cidup-complaints')
    localStorage.removeItem('cidup-profile')
    sessionStorage.removeItem('cidup-complaint-draft')
    sessionStorage.removeItem('cidup-complaint-confirmation')
    sessionStorage.removeItem('cidup-active-draft-id')
    navigate('/login', { replace: true })
  }

  // Carrega os dados administrativos e repete a consulta para manter cards e atividade atualizados.
  useEffect(() => {
    let active = true
    const loadPanelData = async () => {
      try {
        const [complaintData, organizationData, sessionData, recoveryData] = await Promise.all([
          apiRequest<{ complaints: ApiComplaint[] }>('/api/complaints'),
          apiRequest<{ orgaos: Organization[] }>('/api/orgaos'),
          apiRequest<{ user: ResponsibleProfile }>('/api/auth/session'),
          apiRequest<{ requests: PasswordRecoveryRequest[] }>('/api/admin/password-recovery-requests'),
        ])
        if (!active) return
        setComplaints(complaintData.complaints.map(mapApiComplaint))
        setOrganizations(organizationData.orgaos)
        setProfile(sessionData.user)
        setRecoveryRequests(recoveryData.requests)
        setLoadError('')
      } catch (error) {
        if (!active) return
        setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar os dados.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadPanelData()
    const interval = window.setInterval(() => { void loadPanelData() }, 15000)
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void loadPanelData()
    }
    document.addEventListener('visibilitychange', refreshWhenVisible)
    window.addEventListener('focus', refreshWhenVisible)
    return () => {
      active = false
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      window.removeEventListener('focus', refreshWhenVisible)
    }
  }, [])

  const selectedComplaint = complaints.find((complaint) => complaint.protocol === selectedProtocol)
  // Monta a lista de meses disponíveis para o filtro do painel.
  const periodOptions = useMemo(
    () => [...new Set(complaints.map((complaint) => monthKey(complaint.createdAt)))].sort().reverse(),
    [complaints],
  )
  const periodComplaints = useMemo(
    () => period === ALL_PERIODS ? complaints : complaints.filter((complaint) => monthKey(complaint.createdAt) === period),
    [complaints, period],
  )
  // Conta as categorias presentes nas denúncias do período selecionado.
  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    periodComplaints.forEach((complaint) => {
      complaint.categories.forEach((category) => counts.set(category, (counts.get(category) ?? 0) + 1))
    })
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [periodComplaints])
  // Filtra denúncias pelo texto, status e período escolhidos no painel.
  const visibleComplaints = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')
    return periodComplaints.filter((complaint) => {
      const matchesQuery = [
        complaint.protocol,
        complaint.title,
        complaint.description,
        complaint.neighborhood,
        complaint.address,
        complaint.citizen,
        complaint.email,
        complaint.phone,
        complaint.cpf,
      ]
        .some((value) => value.toLocaleLowerCase('pt-BR').includes(normalizedQuery))
      return matchesQuery && (statusFilter === 'Todos' || complaint.status === statusFilter)
    })
  }, [periodComplaints, query, statusFilter])
  const visibleComplaintGroups = useMemo(
    () => groupNearbyComplaints(visibleComplaints),
    [visibleComplaints],
  )

  const heading = selectedComplaint && section === 'denuncias'
    ? 'Detalhes da denúncia'
    : sectionHeadings[section] ?? 'Painel'

  // Salva status e órgão da denúncia e registra a observação quando informada.
  async function saveComplaintUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedComplaint?.id) return
    const formData = new FormData(event.currentTarget)
    const nextStatus = formData.get('status') as ComplaintStatus
    const selectedOrganization = organizations.find((organization) => organization.nome === sector)
    try {
      await apiRequest(`/api/complaints/${selectedComplaint.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: labelToApiStatus(nextStatus),
          ...(selectedOrganization?.id_orgao ? { id_orgao: selectedOrganization.id_orgao } : {}),
        }),
      })
      if (observation.trim()) {
        await apiRequest('/api/historicos', {
          method: 'POST',
          body: JSON.stringify({
            id_denuncia: selectedComplaint.id,
            descricao: `Atualização de atendimento: ${nextStatus}`,
            foto: 'sem-foto',
            observacao: observation.trim(),
          }),
        })
      }
      const refreshed = await apiRequest<{ complaints: ApiComplaint[] }>('/api/complaints')
      setComplaints(refreshed.complaints.map(mapApiComplaint))
      setStatus(nextStatus)
      setObservation('')
      setSavedUpdate(true)
    } catch (error) {
      setSavedUpdate(false)
      setLoadError(error instanceof Error ? error.message : 'Não foi possível salvar a atualização.')
    }
  }

  // Define a senha temporária e atualiza as solicitações pendentes.
  async function setTemporaryPassword(event: FormEvent<HTMLFormElement>, requestId: number) {
    event.preventDefault()
    setRecoveryMessage('')
    try {
      await apiRequest(`/api/admin/password-recovery-requests/${requestId}/temporary-password`, {
        method: 'POST',
        body: JSON.stringify({ temporaryPassword: temporaryPasswords[requestId] ?? '' }),
      })
      const refreshed = await apiRequest<{ requests: PasswordRecoveryRequest[] }>('/api/admin/password-recovery-requests')
      setRecoveryRequests(refreshed.requests)
      setTemporaryPasswords((current) => {
        const next = { ...current }
        delete next[requestId]
        return next
      })
      setRecoveryMessage('Senha temporária definida. Entregue-a ao cidadão por um canal confiável.')
    } catch (error) {
      setRecoveryMessage(error instanceof Error ? error.message : 'Não foi possível definir a senha temporária.')
    }
  }

  // Exporta para CSV o conjunto de denúncias do período selecionado.
  function exportReport() {
    const rows = [
      [
        'Protocolo', 'Denúncia', 'Nome do cidadão', 'CPF', 'E-mail', 'Telefone',
        'Descrição completa', 'Endereço', 'Latitude', 'Longitude', 'Órgão responsável',
        'Status', 'Categorias', 'Histórico e observações', 'Data da última atualização', 'Foto / link',
      ],
      ...periodComplaints.map((complaint) => [
        complaint.protocol,
        complaint.title,
        complaint.citizen,
        complaint.cpf,
        complaint.email,
        complaint.phone,
        complaint.description,
        complaint.address,
        String(complaint.latitude),
        String(complaint.longitude),
        complaint.sector,
        complaint.status,
        complaint.categories.join(', '),
        complaint.history.map((item) => [
          new Date(item.createdAt).toLocaleString('pt-BR'),
          item.description,
          item.observation,
          item.photo && item.photo !== 'sem-foto' ? `Foto: ${item.photo}` : '',
        ].filter(Boolean).join(' — ')).join('\n'),
        new Date(complaint.updatedAt).toLocaleString('pt-BR'),
        complaint.photo ?? '',
      ]),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(';')).join('\n')
    const file = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = 'relatorio-cidup.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  // Entrega às telas filhas apenas os dados e ações que cada seção precisa.
  const body = section === 'denuncias'
    ? (
      <ComplaintsSection
        selectedComplaint={selectedComplaint}
        visibleComplaints={visibleComplaints}
        visibleComplaintGroups={visibleComplaintGroups}
        organizations={organizations}
        status={status}
        statusFilter={statusFilter}
        query={query}
        period={period}
        periodOptions={periodOptions}
        sector={sector}
        observation={observation}
        savedUpdate={savedUpdate}
        onSelectComplaint={(complaint) => {
          setSelectedProtocol(complaint.protocol)
          setStatus(complaint.status)
          setSector(complaint.sectorId ? complaint.sector : '')
          setSavedUpdate(false)
        }}
        onBack={() => { setSelectedProtocol(null); setSavedUpdate(false) }}
        onStatusChange={(nextStatus) => { setStatus(nextStatus); setSavedUpdate(false) }}
        onStatusFilterChange={setStatusFilter}
        onQueryChange={setQuery}
        onPeriodChange={setPeriod}
        onSectorChange={(nextSector) => { setSector(nextSector); setSavedUpdate(false) }}
        onObservationChange={(nextObservation) => { setObservation(nextObservation); setSavedUpdate(false) }}
        onSave={saveComplaintUpdate}
        onExport={exportReport}
      />
    )
    : section === 'recuperacao-senha'
      ? (
        <PasswordRecoverySection
          requests={recoveryRequests}
          temporaryPasswords={temporaryPasswords}
          message={recoveryMessage}
          onPasswordChange={(requestId, password) => setTemporaryPasswords((current) => ({ ...current, [requestId]: password }))}
          onSubmit={setTemporaryPassword}
        />
      )
      : section === 'tipos'
        ? <ComplaintTypesSection categories={categories} />
        : section === 'relatorios'
          ? <ReportsSection complaints={periodComplaints} categories={categories} period={period} periodOptions={periodOptions} onPeriodChange={setPeriod} onExport={exportReport} />
          : section === 'configuracoes'
            ? <SettingsSection profile={profile} />
            : <DashboardSection complaints={complaints} />

  return (
    <ResponsiblePanelLayout
      section={section}
      heading={heading}
      profileName={profile?.name ?? ''}
      organizationName={profile?.orgao?.nome ?? ''}
      isLoggingOut={isLoggingOut}
      logoutError={logoutError}
      loadError={loadError}
      onLogout={() => void handleLogout()}
      onNavigate={() => setSelectedProtocol(null)}
    >
      {loading ? <p className="rp-empty-state" aria-busy="true">Carregando dados do painel...</p> : body}
    </ResponsiblePanelLayout>
  )
}

export default ResponsiblePanelPage
