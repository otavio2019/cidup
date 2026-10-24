import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { apiRequest } from '../../api'
import './ResponsiblePanelPage.css'

type ComplaintStatus = 'Recebida' | 'Em análise' | 'Encaminhada' | 'Em atendimento' | 'Resolvida' | 'Não atendida'

type AdminComplaint = {
  id?: number
  protocol: string
  title: string
  description: string
  neighborhood: string
  date: string
  status: ComplaintStatus
  category: string
  address: string
  citizen: string
  email: string
  sector: string
  sectorId?: number
}

type ApiComplaint = {
  id: number
  protocol: string
  title: string
  description: string
  address: string
  status: string
  createdAt: string
  type: { name: string }
  orgao?: { id_orgao: number; nome: string } | null
  citizen?: string
  citizenEmail?: string
}

type Organization = { id_orgao: number; nome: string; descricao: string }

type OccurrenceType = {
  id: number
  name: string
  description: string
}

const initialTypes: OccurrenceType[] = [
  { id: 1, name: 'Infraestrutura urbana', description: 'Buracos, calçadas e vias públicas' },
  { id: 2, name: 'Iluminação pública', description: 'Lâmpadas queimadas e postes' },
  { id: 3, name: 'Limpeza urbana', description: 'Lixo, entulho e terrenos' },
  { id: 4, name: 'Saneamento', description: 'Vazamentos e esgoto' },
]

const statusOptions: ComplaintStatus[] = ['Recebida', 'Em análise', 'Encaminhada', 'Em atendimento', 'Resolvida', 'Não atendida']
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
    NOT_SERVED: 'Não atendida',
  } as Record<string, ComplaintStatus>)[status] ?? 'Recebida'
}

function labelToApiStatus(status: ComplaintStatus) {
  return ({
    Recebida: 'RECEIVED',
    'Em análise': 'IN_ANALYSIS',
    Encaminhada: 'FORWARDED',
    'Em atendimento': 'IN_SERVICE',
    Resolvida: 'RESOLVED',
    'Não atendida': 'NOT_SERVED',
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
    status: apiStatusToLabel(complaint.status),
    category: complaint.type.name,
    address: complaint.address,
    citizen: complaint.citizen || 'Cidadão não informado',
    email: complaint.citizenEmail || 'E-mail não informado',
    sector: complaint.orgao?.nome ?? 'Não encaminhada',
    sectorId: complaint.orgao?.id_orgao,
  }
}

// Reúne o painel administrativo e mantém em estado local os filtros e dados demonstrativos.
function ResponsiblePanelPage() {
  const location = useLocation()
  const section = location.pathname.split('/')[2] || 'dashboard'
  const [complaints, setComplaints] = useState<AdminComplaint[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [types, setTypes] = useState(initialTypes)
  const [selectedProtocol, setSelectedProtocol] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [period, setPeriod] = useState('Outubro 2026')
  const [sector, setSector] = useState('Secretaria de Obras')
  const [status, setStatus] = useState<ComplaintStatus>('Recebida')
  const [observation, setObservation] = useState('')
  const [savedUpdate, setSavedUpdate] = useState(false)
  const [categoryDialog, setCategoryDialog] = useState(false)
  const [editingType, setEditingType] = useState<OccurrenceType | null>(null)
  const [typeName, setTypeName] = useState('')
  const [typeDescription, setTypeDescription] = useState('')
  const [configSaved, setConfigSaved] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([
      apiRequest<{ complaints: ApiComplaint[] }>('/api/complaints'),
      apiRequest<{ orgaos: Organization[] }>('/api/orgaos'),
    ])
      .then(([complaintData, organizationData]) => {
        if (!active) return
        setComplaints(complaintData.complaints.map(mapApiComplaint))
        setOrganizations(organizationData.orgaos)
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
  // Filtra denúncias pelo texto de busca e pelo status selecionado.
  const visibleComplaints = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')
    return complaints.filter((complaint) => {
      const matchesQuery = [complaint.protocol, complaint.title, complaint.neighborhood]
        .some((value) => value.toLocaleLowerCase('pt-BR').includes(normalizedQuery))
      return matchesQuery && (statusFilter === 'Todos' || complaint.status === statusFilter)
    })
  }, [complaints, query, statusFilter])

  const heading = selectedComplaint && section === 'denuncias'
    ? 'Detalhes da denúncia'
    : navigation.find((item) => item.path.endsWith(section))?.label ?? 'Painel'

  // Preenche o modal para criar uma categoria ou editar uma existente.
  function openTypeDialog(type?: OccurrenceType) {
    setEditingType(type ?? null)
    setTypeName(type?.name ?? '')
    setTypeDescription(type?.description ?? '')
    setCategoryDialog(true)
  }

  // Salva a categoria no estado local e atualiza suas referências em denúncias.
  function saveType(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = typeName.trim()
    const description = typeDescription.trim()
    if (!name) return
    if (editingType) {
      setTypes((current) => current.map((type) => type.id === editingType.id ? { ...type, name, description } : type))
      setComplaints((current) => current.map((complaint) => complaint.category === editingType.name ? { ...complaint, category: name } : complaint))
    } else {
      setTypes((current) => [...current, { id: Date.now(), name, description }])
    }
    setCategoryDialog(false)
  }

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
      setComplaints((current) => current.map((complaint) => complaint.protocol === selectedComplaint.protocol
        ? { ...complaint, status: nextStatus, sector, sectorId: selectedOrganization?.id_orgao ?? complaint.sectorId }
        : complaint))
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
      ...complaints.map((complaint) => [complaint.protocol, complaint.title, complaint.neighborhood, complaint.date, complaint.status, complaint.category]),
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
    const pendingCount = complaints.filter((complaint) => complaint.status === 'Recebida' || complaint.status === 'Em análise').length
    const inServiceCount = complaints.filter((complaint) => complaint.status === 'Em atendimento').length
    const resolvedCount = complaints.filter((complaint) => complaint.status === 'Resolvida').length
    const statusSummary: Array<[string, number, string]> = [
      ['Recebidas', complaints.filter((complaint) => complaint.status === 'Recebida').length, 'blue'],
      ['Em análise', complaints.filter((complaint) => complaint.status === 'Em análise').length, 'gold'],
      ['Em atendimento', inServiceCount, 'sky'],
      ['Resolvidas', resolvedCount, 'green'],
    ]
    return (
      <>
        <div className="rp-page-heading">
          <div><h1>Visão geral</h1><p>Acompanhe as denúncias da sua área.</p></div>
        </div>
        <section className="rp-metric-grid" aria-label="Indicadores do mês">
          <Metric label="Pendentes" value={String(pendingCount)} note="Aguardando análise" color="blue" />
          <Metric label="Em atendimento" value={String(inServiceCount)} note="Em execução" color="gold" />
          <Metric label="Resolvidas" value={String(resolvedCount)} note="Neste mês" color="green" />
          <Metric label="Total" value={String(complaints.length)} note="Denúncias carregadas" color="teal" />
        </section>
        <div className="rp-dashboard-grid">
          <section className="rp-panel rp-status-panel">
            <h2>Denúncias por status</h2>
            <div className="rp-status-bars">
              {statusSummary.map(([label, count, color]) => (
                <div className="rp-bar-row" key={label}>
                  <strong>{label}</strong><div className="rp-bar-track"><span className={`rp-bar-fill rp-fill-${color}`} style={{ width: `${Number(count) * 2.2}%` }} /></div><b>{count}</b>
                </div>
              ))}
            </div>
          </section>
          <section className="rp-panel rp-activity-panel">
            <h2>Atividade recente</h2>
            {[
              ['Nova denúncia recebida', 'CIDUP-000031 · há 1h'],
              ['Status alterado para resolvida', 'CIDUP-000029 · há 2h'],
              ['Denúncia encaminhada', 'CIDUP-000024 · há 3h'],
            ].map(([title, detail]) => (
              <div className="rp-activity-item" key={title}><span aria-hidden="true" /><div><strong>{title}</strong><small>{detail}</small></div></div>
            ))}
          </section>
        </div>
        <div className="rp-dashboard-footer"><span>Resumo de outubro</span><NavLink to="/responsavel/denuncias">Acessar denúncias <span aria-hidden="true">→</span></NavLink></div>
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
              <Info label="Cidadão" value={`${selectedComplaint.citizen} · ${selectedComplaint.email}`} />
              <Info label="Categoria" value={selectedComplaint.category} />
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
          <label className="rp-search-field"><span>Buscar por protocolo, bairro ou descrição</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Digite para buscar..." /></label>
          <label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>Todos</option>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label>Período<select value={period} onChange={(event) => setPeriod(event.target.value)}><option>Outubro 2026</option><option>Setembro 2026</option><option>Todos os períodos</option></select></label>
        </section>
        <section className="rp-panel rp-table-panel">
          <div className="rp-table-scroll"><table className="rp-table"><thead><tr><th>Protocolo</th><th>Descrição</th><th>Bairro</th><th>Data</th><th>Status</th><th>Ação</th></tr></thead>
              <tbody>{visibleComplaints.map((complaint) => <tr key={complaint.protocol}><td className="rp-protocol">{complaint.protocol}</td><td><strong>{complaint.title}</strong><small>{complaint.category}</small></td><td>{complaint.neighborhood}</td><td>{complaint.date}</td><td><StatusBadge status={complaint.status} /></td><td><button className="rp-text-button" type="button" onClick={() => { setSelectedProtocol(complaint.protocol); setStatus(complaint.status); setSector(complaint.sector); setSavedUpdate(false) }}>Ver detalhes <span aria-hidden="true">→</span></button></td></tr>)}</tbody>
          </table></div>
          {visibleComplaints.length === 0 && <p className="rp-empty-state">Nenhuma denúncia encontrada com esses filtros.</p>}
          <div className="rp-table-footer"><span>1–{visibleComplaints.length} de {complaints.length} denúncias</span><span className="rp-pagination">‹ <b>1</b> 2 3 ›</span></div>
        </section>
      </>
    )
  }

  // Exibe as categorias existentes com ações de cadastro, edição e exclusão.
  function renderTypes() {
    return (
      <>
        <div className="rp-page-heading rp-heading-with-action"><div><h1>Categorias de denúncia</h1><p>Organize os tipos disponíveis para os cidadãos.</p></div><button className="rp-primary-button rp-add-button" type="button" onClick={() => openTypeDialog()}>＋ Nova categoria</button></div>
        <section className="rp-panel rp-types-panel" aria-label="Categorias de denúncia">
          {types.map((type, index) => <div className="rp-type-row" key={type.id}><span className="rp-type-number">{index + 1}</span><div className="rp-type-copy"><strong>{type.name}</strong><small>{type.description || 'Sem descrição'}</small></div><span className="rp-type-count">{complaints.filter((complaint) => complaint.category === type.name).length + [12, 8, 15, 5][index % 4]} denúncias</span><button className="rp-text-button" type="button" onClick={() => openTypeDialog(type)}>Editar</button><button className="rp-delete-button" type="button" onClick={() => setTypes((current) => current.filter((item) => item.id !== type.id))}>Excluir</button></div>)}
          {types.length === 0 && <p className="rp-empty-state">Nenhuma categoria cadastrada.</p>}
        </section>
      </>
    )
  }

  // Apresenta indicadores e gráficos demonstrativos para o período escolhido.
  function renderReports() {
    return (
      <>
        <div className="rp-page-heading rp-heading-with-action"><div><h1>Relatórios e indicadores</h1><p>Acompanhe os resultados dos atendimentos.</p></div><label className="rp-period-select">Período<select value={period} onChange={(event) => setPeriod(event.target.value)}><option>Outubro 2026</option><option>Setembro 2026</option><option>Agosto 2026</option></select></label></div>
        <section className="rp-report-metrics"><Metric label="Total de denúncias" value="108" note="No período selecionado" color="blue" /><Metric label="Resolvidas" value="42" note="38,9% do total" color="green" /><Metric label="Em aberto" value="66" note="61,1% do total" color="gold" /><Metric label="Satisfação" value="86%" note="Avaliação dos cidadãos" color="teal" /></section>
        <div className="rp-report-grid">
          <section className="rp-panel rp-monthly-panel"><h2>Evolução mensal</h2><div className="rp-chart" aria-label="Gráfico de denúncias recebidas por semana"><div className="rp-chart-bars">{[44, 25, 59, 37, 72].map((height, index) => <div className="rp-chart-column" key={height}><span style={{ height: `${height}%` }} /><small>Sem {index + 1}</small></div>)}</div></div></section>
          <section className="rp-panel rp-category-panel"><h2>Distribuição por categoria</h2>{[['Infraestrutura', 42, 'blue'], ['Limpeza urbana', 28, 'green'], ['Iluminação', 20, 'gold'], ['Saneamento', 18, 'brick']].map(([label, value, color]) => <div className="rp-category-bar" key={label}><div><strong>{label}</strong><span>{value}</span></div><div className="rp-bar-track"><span className={`rp-bar-fill rp-fill-${color}`} style={{ width: `${Number(value) * 2}%` }} /></div></div>)}</section>
        </div>
        <button className="rp-outline-button rp-export-bottom" type="button" onClick={exportReport}>↓ Baixar dados do período</button>
      </>
    )
  }

  // Mostra as preferências de perfil e notificações do responsável.
  function renderSettings() {
    return (
      <>
        <div className="rp-page-heading"><div><h1>Configurações</h1><p>Gerencie os dados do painel e suas preferências.</p></div></div>
        <div className="rp-settings-grid">
          <form className="rp-panel rp-settings-panel" onSubmit={(event) => { event.preventDefault(); setConfigSaved(true) }}><h2>Perfil responsável</h2><label>Nome completo<input defaultValue="Ana Souza" onChange={() => setConfigSaved(false)} /></label><label>E-mail<input type="email" defaultValue="ana.souza@prefeitura.gov.br" onChange={() => setConfigSaved(false)} /></label><label>Secretaria<select defaultValue="Secretaria de Obras" onChange={() => setConfigSaved(false)}><option>Secretaria de Obras</option><option>Secretaria de Serviços</option><option>Secretaria de Saneamento</option></select></label><label>Município<input defaultValue="Prefeitura Municipal" onChange={() => setConfigSaved(false)} /></label>{configSaved && <p className="rp-success-message" role="status">Preferências salvas nesta demonstração.</p>}<button className="rp-primary-button" type="submit">Salvar configurações</button></form>
          <section className="rp-panel rp-preferences-panel"><h2>Notificações</h2><p>Escolha quais atualizações deseja receber.</p><label className="rp-toggle-row"><span><strong>Novas denúncias</strong><small>Quando um novo registro chegar</small></span><input type="checkbox" defaultChecked /></label><label className="rp-toggle-row"><span><strong>Atualizações de atendimento</strong><small>Mudanças de status e encaminhamentos</small></span><input type="checkbox" defaultChecked /></label><label className="rp-toggle-row"><span><strong>Resumo semanal</strong><small>Indicadores enviados toda segunda-feira</small></span><input type="checkbox" /></label></section>
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
        <div className="rp-sidebar-footer"><strong>◉ Responsável</strong><span>Prefeitura Municipal</span></div>
      </aside>
      <div className="rp-main-column">
        <header className="rp-topbar"><h2>{heading}</h2><button type="button" className="rp-profile-button">Ajuda <span aria-hidden="true">·</span> Ana Souza <span aria-hidden="true">⌄</span></button></header>
        <main className="rp-content">
          {loadError && <p className="rp-error-message" role="alert">{loadError}</p>}
          {loading ? <p className="rp-empty-state" aria-busy="true">Carregando dados do painel...</p> : body}
        </main>
      </div>
      {categoryDialog && <div className="rp-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCategoryDialog(false) }}><form className="rp-modal" role="dialog" aria-modal="true" aria-labelledby="rp-category-dialog-title" onSubmit={saveType}><h2 id="rp-category-dialog-title">{editingType ? 'Editar categoria' : 'Nova categoria'}</h2><label>Nome da categoria<input autoFocus required value={typeName} onChange={(event) => setTypeName(event.target.value)} /></label><label>Descrição<textarea rows={3} value={typeDescription} onChange={(event) => setTypeDescription(event.target.value)} /></label><div className="rp-modal-actions"><button className="rp-outline-button" type="button" onClick={() => setCategoryDialog(false)}>Cancelar</button><button className="rp-primary-button" type="submit">Salvar categoria</button></div></form></div>}
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
