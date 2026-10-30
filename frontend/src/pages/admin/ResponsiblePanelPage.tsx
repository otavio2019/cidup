import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { apiRequest } from '../../api'
import './ResponsiblePanelPage.css'

/** Área administrativa: consulta a API, atualiza denúncias e calcula relatórios locais. */
type ComplaintStatus = 'Recebida' | 'Em análise' | 'Encaminhada' | 'Em atendimento' | 'Resolvida' | 'Negada'

type AdminComplaint = {
  id?: number
  protocol: string
  title: string
  description: string
  neighborhood: string
  date: string
  createdAt: string
  status: ComplaintStatus
  category: string
  address: string
  photo?: string | null
  citizen: string
  email: string
  phone: string
  cpf: string
  citizenPhoto?: string | null
  sector: string
  sectorId?: number
  history: ComplaintHistory[]
}

type ComplaintHistory = {
  id: number
  description: string
  observation: string
}

type ApiComplaint = {
  id: number
  protocol: string
  title: string
  description: string
  address: string
  status: string
  createdAt: string
  photo?: string | null
  type: { name: string }
  orgao?: { id_orgao: number; nome: string } | null
  citizen?: string
  citizenEmail?: string
  citizenPhone?: string
  citizenCpf?: string
  citizenPhoto?: string | null
  history?: ComplaintHistory[]
}

type Organization = { id_orgao: number; nome: string; descricao: string }

type ResponsibleProfile = {
  name: string
  email: string
  phone: string
  orgao: { id_orgao: number; nome: string } | null
}

const ALL_PERIODS = 'all'

// Converte a data em uma chave AAAA-MM usada para agrupar por mês.
function monthKey(isoDate: string) {
  const date = new Date(isoDate)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number)
  const label = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toLocaleUpperCase('pt-BR') + label.slice(1)
}

function relativeTime(isoDate: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(isoDate).getTime()) / 60000))
  if (minutes < 60) return `há ${Math.max(minutes, 1)} min`
  if (minutes < 1440) return `há ${Math.floor(minutes / 60)} h`
  return `há ${Math.floor(minutes / 1440)} d`
}

function percent(part: number, total: number) {
  return total === 0 ? 0 : (part / total) * 100
}

const statusOptions: ComplaintStatus[] = ['Recebida', 'Em análise', 'Encaminhada', 'Em atendimento', 'Resolvida', 'Negada']
const navigation = [
  { path: '/responsavel/dashboard', label: 'Painel' },
  { path: '/responsavel/denuncias', label: 'Denúncias' },
  { path: '/responsavel/tipos', label: 'Tipos de ocorrência' },
  { path: '/responsavel/relatorios', label: 'Relatórios' },
  { path: '/responsavel/configuracoes', label: 'Configurações' },
]

// Converte o status em uma classe CSS e exibe o rótulo correspondente.
function StatusBadge({ status }: { status: ComplaintStatus }) {
  const className = status.toLocaleLowerCase('pt-BR').replaceAll(' ', '-')
  return <span className={`rp-status rp-status-${className}`}>{status}</span>
}

function apiStatusToLabel(status: string): ComplaintStatus {
  return ({
    RECEIVED: 'Recebida',
    IN_ANALYSIS: 'Em análise',
    FORWARDED: 'Encaminhada',
    IN_SERVICE: 'Em atendimento',
    RESOLVED: 'Resolvida',
    NOT_SERVED: 'Negada',
  } as Record<string, ComplaintStatus>)[status] ?? 'Recebida'
}

function labelToApiStatus(status: ComplaintStatus) {
  return ({
    Recebida: 'RECEIVED',
    'Em análise': 'IN_ANALYSIS',
    Encaminhada: 'FORWARDED',
    'Em atendimento': 'IN_SERVICE',
    Resolvida: 'RESOLVED',
    Negada: 'NOT_SERVED',
  } as Record<ComplaintStatus, string>)[status]
}

function mapApiComplaint(complaint: ApiComplaint): AdminComplaint {
  return {
    id: complaint.id,
    protocol: complaint.protocol,
    title: complaint.title,
    description: complaint.description,
    neighborhood: '',
    date: new Date(complaint.createdAt).toLocaleDateString('pt-BR'),
    createdAt: complaint.createdAt,
    status: apiStatusToLabel(complaint.status),
    category: complaint.type.name,
    address: complaint.address,
    photo: complaint.photo ?? null,
    citizen: complaint.citizen || 'Cidadão não informado',
    email: complaint.citizenEmail || 'E-mail não informado',
    phone: complaint.citizenPhone || 'Telefone não informado',
    cpf: complaint.citizenCpf || 'CPF não informado',
    citizenPhoto: complaint.citizenPhoto ?? null,
    sector: complaint.orgao?.nome ?? 'Não encaminhada',
    sectorId: complaint.orgao?.id_orgao,
    history: complaint.history ?? [],
  }
}

// Reúne o painel administrativo e mantém em estado local os filtros e dados carregados da API.
function ResponsiblePanelPage() {
  const location = useLocation()
  const section = location.pathname.split('/')[2] || 'dashboard'
  const [complaints, setComplaints] = useState<AdminComplaint[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [profile, setProfile] = useState<ResponsibleProfile | null>(null)
  const [selectedProtocol, setSelectedProtocol] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [period, setPeriod] = useState(ALL_PERIODS)
  const [sector, setSector] = useState('')
  const [status, setStatus] = useState<ComplaintStatus>('Recebida')
  const [observation, setObservation] = useState('')
  const [savedUpdate, setSavedUpdate] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([
      apiRequest<{ complaints: ApiComplaint[] }>('/api/complaints'),
      apiRequest<{ orgaos: Organization[] }>('/api/orgaos'),
      apiRequest<{ user: ResponsibleProfile }>('/api/auth/session'),
    ])
      .then(([complaintData, organizationData, sessionData]) => {
        if (!active) return
        setComplaints(complaintData.complaints.map(mapApiComplaint))
        setOrganizations(organizationData.orgaos)
        setProfile(sessionData.user)
      })
      .catch((error) => {
        if (!active) return
        setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar os dados.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const selectedComplaint = complaints.find((complaint) => complaint.protocol === selectedProtocol)
  const periodOptions = useMemo(
    () => [...new Set(complaints.map((complaint) => monthKey(complaint.createdAt)))].sort().reverse(),
    [complaints],
  )
  const periodComplaints = useMemo(
    () => period === ALL_PERIODS ? complaints : complaints.filter((complaint) => monthKey(complaint.createdAt) === period),
    [complaints, period],
  )
  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    periodComplaints.forEach((complaint) => counts.set(complaint.category, (counts.get(complaint.category) ?? 0) + 1))
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [periodComplaints])
  // Filtra denúncias pelo texto de busca, pelo status e pelo período selecionados.
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

  const heading = selectedComplaint && section === 'denuncias'
    ? 'Detalhes da denúncia'
    : navigation.find((item) => item.path.endsWith(section))?.label ?? 'Painel'

  // Persiste o status, o encaminhamento e a observação da denúncia na API.
  async function saveComplaintUpdate(event: React.FormEvent<HTMLFormElement>) {
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

  // Gera um arquivo CSV com os dados atualmente disponíveis na lista.
  function exportReport() {
    const rows = [
      ['Protocolo', 'Denúncia', 'Bairro', 'Data', 'Status', 'Categoria'],
      ...periodComplaints.map((complaint) => [complaint.protocol, complaint.title, complaint.neighborhood, complaint.date, complaint.status, complaint.category]),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(';')).join('\n')
    const file = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = 'relatorio-cidup.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  // Monta o resumo visual com métricas e atividade recente do painel.
  function renderDashboard() {
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
        <div className="rp-page-heading">
          <div><h1>Visão geral</h1><p>Acompanhe as denúncias recebidas.</p></div>
        </div>
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
                  <strong>{label}</strong><div className="rp-bar-track"><span className={`rp-bar-fill rp-fill-${color}`} style={{ width: `${percent(Number(count), total)}%` }} /></div><b>{count}</b>
                </div>
              ))}
            </div>
          </section>
          <section className="rp-panel rp-activity-panel">
            <h2>Atividade recente</h2>
            {recentComplaints.length === 0 && <p className="rp-empty-state">Nenhuma denúncia registrada.</p>}
            {recentComplaints.map((complaint) => (
              <div className="rp-activity-item" key={complaint.protocol}><span aria-hidden="true" /><div><strong>{complaint.title}</strong><small>{complaint.protocol} · {complaint.status} · {relativeTime(complaint.createdAt)}</small></div></div>
            ))}
          </section>
        </div>
        <div className="rp-dashboard-footer"><span>Atualizado em {new Date().toLocaleDateString('pt-BR')}</span><NavLink to="/responsavel/denuncias">Acessar denúncias <span aria-hidden="true">→</span></NavLink></div>
      </>
    )
  }

  // Exibe a listagem filtrável ou os detalhes e controles da denúncia selecionada.
  function renderComplaints() {
    if (selectedComplaint) {
      return (
        <>
          <button className="rp-back-link" type="button" onClick={() => { setSelectedProtocol(null); setSavedUpdate(false) }}>← Voltar para denúncias</button>
          <div className="rp-detail-heading">
            <div><h1>{selectedComplaint.title}</h1><p>{selectedComplaint.protocol} · recebido em {selectedComplaint.date}</p></div>
            <StatusBadge status={selectedComplaint.status} />
          </div>
          <div className="rp-detail-grid">
            <section className="rp-panel rp-information-panel">
              <h2>Informações da denúncia</h2>
              <Info label="Descrição" value={selectedComplaint.description} />
              <Info label="Endereço" value={selectedComplaint.address} />
              <Info label="Cidadão" value={selectedComplaint.citizen} />
              <Info label="E-mail" value={selectedComplaint.email} />
              <Info label="Telefone" value={selectedComplaint.phone} />
              <Info label="CPF" value={selectedComplaint.cpf} />
              <Info label="Categoria" value={selectedComplaint.category} />
              {selectedComplaint.photo && <div className="rp-photo-field"><strong>Foto anexada</strong><img src={selectedComplaint.photo} alt="Foto anexada pelo cidadão à denúncia" /></div>}
            </section>
            <form className="rp-panel rp-update-panel" onSubmit={saveComplaintUpdate}>
              <h2>Atualizar atendimento</h2>
              <label>Status atual<select name="status" value={status} onChange={(event) => { setStatus(event.target.value as ComplaintStatus); setSavedUpdate(false) }}>{statusOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
              <label>Setor responsável<select value={sector} onChange={(event) => { setSector(event.target.value); setSavedUpdate(false) }}><option value="">Não encaminhada</option>{organizations.map((organization) => <option key={organization.id_orgao} value={organization.nome}>{organization.nome}</option>)}</select></label>
              <label>Observação<textarea value={observation} onChange={(event) => { setObservation(event.target.value); setSavedUpdate(false) }} placeholder="Inclua uma atualização para o cidadão acompanhar." rows={3} /></label>
              {savedUpdate && <p className="rp-success-message" role="status">Atualização salva com sucesso.</p>}
              <button className="rp-primary-button" type="submit">Salvar atualização</button>
            </form>
          </div>
          <section className="rp-panel rp-history-panel" aria-labelledby="responsible-history-title">
            <h2 id="responsible-history-title">Observações e histórico</h2>
            {selectedComplaint.history.length === 0 ? (
              <p className="rp-empty-state">Nenhuma observação registrada para esta denúncia.</p>
            ) : (
              <div className="rp-history-list">
                {selectedComplaint.history.map((item) => (
                  <article className="rp-history-item" key={item.id}>
                    <strong>{item.description}</strong>
                    <p>{item.observation}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )
    }

    return (
      <>
        <div className="rp-page-heading rp-heading-with-action">
          <div><h1>Todas as denúncias</h1><p>Gerencie os registros recebidos pela prefeitura.</p></div>
          <button className="rp-outline-button" type="button" onClick={exportReport}>↓ Exportar relatório</button>
        </div>
        <section className="rp-filter-bar" aria-label="Filtros de denúncias">
          <label className="rp-search-field"><span>Buscar por protocolo, CPF, nome, e-mail ou telefone</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Digite para buscar..." /></label>
          <label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>Todos</option>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label>Período<select value={period} onChange={(event) => setPeriod(event.target.value)}><option value={ALL_PERIODS}>Todos os períodos</option>{periodOptions.map((key) => <option key={key} value={key}>{monthLabel(key)}</option>)}</select></label>
        </section>
        <section className="rp-panel rp-table-panel">
          <div className="rp-table-scroll"><table className="rp-table"><thead><tr><th>Protocolo</th><th>Descrição</th><th>Bairro</th><th>Data</th><th>Status</th><th>Ação</th></tr></thead>
              <tbody>{visibleComplaints.map((complaint) => <tr key={complaint.protocol}><td className="rp-protocol">{complaint.protocol}</td><td><strong>{complaint.title}</strong><small>{complaint.category}</small></td><td>{complaint.neighborhood || '—'}</td><td>{complaint.date}</td><td><StatusBadge status={complaint.status} /></td><td><button className="rp-text-button" type="button" onClick={() => { setSelectedProtocol(complaint.protocol); setStatus(complaint.status); setSector(complaint.sectorId ? complaint.sector : ''); setSavedUpdate(false) }}>Ver detalhes <span aria-hidden="true">→</span></button></td></tr>)}</tbody>
          </table></div>
          {visibleComplaints.length === 0 && <p className="rp-empty-state">Nenhuma denúncia encontrada com esses filtros.</p>}
          <div className="rp-table-footer"><span>{visibleComplaints.length} de {complaints.length} denúncias</span></div>
        </section>
      </>
    )
  }

  // Exibe as categorias encontradas nas denúncias reais, com a contagem de cada uma.
  function renderTypes() {
    return (
      <>
        <div className="rp-page-heading"><div><h1>Categorias de denúncia</h1><p>Tipos de ocorrência registrados pelos cidadãos.</p></div></div>
        <section className="rp-panel rp-types-panel" aria-label="Categorias de denúncia">
          {categories.map(([name, count], index) => <div className="rp-type-row" key={name}><span className="rp-type-number">{index + 1}</span><div className="rp-type-copy"><strong>{name}</strong></div><span className="rp-type-count">{count} {count === 1 ? 'denúncia' : 'denúncias'}</span></div>)}
          {categories.length === 0 && <p className="rp-empty-state">Nenhuma denúncia registrada ainda.</p>}
        </section>
      </>
    )
  }

  // Calcula indicadores e gráficos a partir das denúncias do período escolhido.
  function renderReports() {
    const total = periodComplaints.length
    const resolved = periodComplaints.filter((complaint) => complaint.status === 'Resolvida').length
    const open = total - resolved
    const weekCounts = [0, 0, 0, 0, 0]
    periodComplaints.forEach((complaint) => {
      weekCounts[Math.min(Math.floor((new Date(complaint.createdAt).getDate() - 1) / 7), 4)] += 1
    })
    const maxWeek = Math.max(...weekCounts, 1)
    const maxCategory = Math.max(...categories.map(([, count]) => count), 1)
    const format = (value: number) => `${value.toFixed(1).replace('.', ',')}%`
    return (
      <>
        <div className="rp-page-heading rp-heading-with-action"><div><h1>Relatórios e indicadores</h1><p>Acompanhe os resultados dos atendimentos.</p></div><label className="rp-period-select">Período<select value={period} onChange={(event) => setPeriod(event.target.value)}><option value={ALL_PERIODS}>Todos os períodos</option>{periodOptions.map((key) => <option key={key} value={key}>{monthLabel(key)}</option>)}</select></label></div>
        <section className="rp-report-metrics"><Metric label="Total de denúncias" value={String(total)} note="No período selecionado" color="blue" /><Metric label="Resolvidas" value={String(resolved)} note={`${format(percent(resolved, total))} do total`} color="green" /><Metric label="Em aberto" value={String(open)} note={`${format(percent(open, total))} do total`} color="gold" /></section>
        <div className="rp-report-grid">
          <section className="rp-panel rp-monthly-panel"><h2>Denúncias por semana do mês</h2><div className="rp-chart" aria-label="Gráfico de denúncias recebidas por semana"><div className="rp-chart-bars">{weekCounts.map((count, index) => <div className="rp-chart-column" key={index}><span style={{ height: `${percent(count, maxWeek)}%`, ...(count === 0 && { minHeight: 0 }) }} title={`${count} denúncias`} /><small>Sem {index + 1} ({count})</small></div>)}</div></div></section>
          <section className="rp-panel rp-category-panel"><h2>Distribuição por categoria</h2>{categories.length === 0 && <p className="rp-empty-state">Sem denúncias no período.</p>}{categories.map(([label, value]) => <div className="rp-category-bar" key={label}><div><strong>{label}</strong><span>{value}</span></div><div className="rp-bar-track"><span className="rp-bar-fill rp-fill-blue" style={{ width: `${percent(value, maxCategory)}%` }} /></div></div>)}</section>
        </div>
        <button className="rp-outline-button rp-export-bottom" type="button" onClick={exportReport}>↓ Baixar dados do período</button>
      </>
    )
  }

  // Mostra os dados reais da conta do responsável autenticado.
  function renderSettings() {
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

  const body = section === 'denuncias' ? renderComplaints()
    : section === 'tipos' ? renderTypes()
      : section === 'relatorios' ? renderReports()
        : section === 'configuracoes' ? renderSettings()
          : renderDashboard()

  return (
    <div className="rp-shell">
      <aside className="rp-sidebar">
        <NavLink className="rp-brand" to="/responsavel/dashboard"><img className="rp-brand-logo" src={`${import.meta.env.BASE_URL}cidup-logo.png`} alt="CidUp" /><span><small>Painel do responsável</small></span></NavLink>
        <nav className="rp-navigation" aria-label="Navegação do responsável">{navigation.map((item) => <NavLink key={item.path} to={item.path} className={({ isActive }) => `rp-nav-link${isActive && (item.path.endsWith('/' + section) || section === '' && item.path.endsWith('dashboard')) ? ' is-active' : ''}`} onClick={() => setSelectedProtocol(null)}>{item.label}</NavLink>)}</nav>
        <div className="rp-sidebar-footer"><strong>◉ Responsável</strong><span>{profile?.orgao?.nome ?? ''}</span></div>
      </aside>
      <div className="rp-main-column">
        <header className="rp-topbar"><h2>{heading}</h2><button type="button" className="rp-profile-button">{profile?.name ?? ''}</button></header>
        <main className="rp-content">
          {loadError && <p className="rp-error-message" role="alert">{loadError}</p>}
          {loading ? <p className="rp-empty-state" aria-busy="true">Carregando dados do painel...</p> : body}
        </main>
      </div>
    </div>
  )
}

// Apresenta uma métrica com sua descrição e variação visual de cor.
function Metric({ label, value, note, color }: { label: string; value: string; note: string; color: string }) {
  return <article className={`rp-metric rp-metric-${color}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>
}

// Exibe um par de rótulo e valor nas informações de uma denúncia.
function Info({ label, value }: { label: string; value: string }) {
  return <div className="rp-info-row"><dt>{label}</dt><dd>{value}</dd></div>
}

export default ResponsiblePanelPage
