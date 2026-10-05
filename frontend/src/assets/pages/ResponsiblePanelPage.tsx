import { useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import './ResponsiblePanelPage.css'

type ComplaintStatus = 'Recebida' | 'Em análise' | 'Em atendimento' | 'Resolvida'

type AdminComplaint = {
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
}

type OccurrenceType = {
  id: number
  name: string
  description: string
}

const initialComplaints: AdminComplaint[] = [
  {
    protocol: 'CIDUP-000031',
    title: 'Buraco na via',
    description: 'Buraco grande próximo à faixa de pedestres.',
    neighborhood: 'Centro',
    date: '05/10/2026',
    status: 'Recebida',
    category: 'Infraestrutura urbana',
    address: 'Rua das Flores, 120 — Centro',
    citizen: 'João da Silva',
    email: 'joao@email.com',
    sector: 'Secretaria de Obras',
  },
  {
    protocol: 'CIDUP-000029',
    title: 'Lâmpada queimada',
    description: 'Poste sem iluminação há três noites.',
    neighborhood: 'Jardins',
    date: '04/10/2026',
    status: 'Em análise',
    category: 'Iluminação pública',
    address: 'Av. das Palmeiras, 84 — Jardins',
    citizen: 'Mariana Costa',
    email: 'mariana@email.com',
    sector: 'Secretaria de Serviços',
  },
  {
    protocol: 'CIDUP-000024',
    title: 'Lixo acumulado',
    description: 'Descarte irregular de resíduos na praça.',
    neighborhood: 'São José',
    date: '03/10/2026',
    status: 'Em atendimento',
    category: 'Limpeza urbana',
    address: 'Praça São José, s/n — São José',
    citizen: 'Pedro Almeida',
    email: 'pedro@email.com',
    sector: 'Secretaria de Serviços',
  },
  {
    protocol: 'CIDUP-000018',
    title: 'Vazamento de água',
    description: 'Água escorrendo pela calçada desde ontem.',
    neighborhood: 'Centro',
    date: '01/10/2026',
    status: 'Resolvida',
    category: 'Saneamento',
    address: 'Rua do Comércio, 42 — Centro',
    citizen: 'Ana Oliveira',
    email: 'ana@email.com',
    sector: 'Secretaria de Saneamento',
  },
  {
    protocol: 'CIDUP-000016',
    title: 'Calçada danificada',
    description: 'Piso solto dificulta a passagem de pedestres.',
    neighborhood: 'Vila Nova',
    date: '30/09/2026',
    status: 'Em atendimento',
    category: 'Infraestrutura urbana',
    address: 'Rua Aurora, 212 — Vila Nova',
    citizen: 'Lucas Martins',
    email: 'lucas@email.com',
    sector: 'Secretaria de Obras',
  },
]

const initialTypes: OccurrenceType[] = [
  { id: 1, name: 'Infraestrutura urbana', description: 'Buracos, calçadas e vias públicas' },
  { id: 2, name: 'Iluminação pública', description: 'Lâmpadas queimadas e postes' },
  { id: 3, name: 'Limpeza urbana', description: 'Lixo, entulho e terrenos' },
  { id: 4, name: 'Saneamento', description: 'Vazamentos e esgoto' },
]

const statusOptions: ComplaintStatus[] = ['Recebida', 'Em análise', 'Em atendimento', 'Resolvida']
const navigation = [
  { path: '/responsavel/dashboard', label: 'Dashboard' },
  { path: '/responsavel/denuncias', label: 'Denúncias' },
  { path: '/responsavel/tipos', label: 'Tipos de ocorrência' },
  { path: '/responsavel/relatorios', label: 'Relatórios' },
  { path: '/responsavel/configuracoes', label: 'Configurações' },
]

function StatusBadge({ status }: { status: ComplaintStatus }) {
  const className = status.toLocaleLowerCase('pt-BR').replaceAll(' ', '-')
  return <span className={`rp-status rp-status-${className}`}>{status}</span>
}

function ResponsiblePanelPage() {
  const location = useLocation()
  const section = location.pathname.split('/')[2] || 'dashboard'
  const [complaints, setComplaints] = useState(initialComplaints)
  const [types, setTypes] = useState(initialTypes)
  const [selectedProtocol, setSelectedProtocol] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [period, setPeriod] = useState('Outubro 2026')
  const [sector, setSector] = useState('Secretaria de Obras')
  const [observation, setObservation] = useState('')
  const [savedUpdate, setSavedUpdate] = useState(false)
  const [categoryDialog, setCategoryDialog] = useState(false)
  const [editingType, setEditingType] = useState<OccurrenceType | null>(null)
  const [typeName, setTypeName] = useState('')
  const [typeDescription, setTypeDescription] = useState('')
  const [configSaved, setConfigSaved] = useState(false)

  const selectedComplaint = complaints.find((complaint) => complaint.protocol === selectedProtocol)
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
    : navigation.find((item) => item.path.endsWith(section))?.label ?? 'Dashboard'

  function openTypeDialog(type?: OccurrenceType) {
    setEditingType(type ?? null)
    setTypeName(type?.name ?? '')
    setTypeDescription(type?.description ?? '')
    setCategoryDialog(true)
  }

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

  function saveComplaintUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedComplaint) return
    const formData = new FormData(event.currentTarget)
    const nextStatus = formData.get('status') as ComplaintStatus
    setComplaints((current) => current.map((complaint) => complaint.protocol === selectedComplaint.protocol
      ? { ...complaint, status: nextStatus, sector }
      : complaint))
    setSavedUpdate(true)
  }

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

  function renderDashboard() {
    return (
      <>
        <div className="rp-page-heading">
          <div><h1>Visão geral</h1><p>Acompanhe as denúncias da sua área.</p></div>
        </div>
        <section className="rp-metric-grid" aria-label="Indicadores do mês">
          <Metric label="Pendentes" value="24" note="Aguardando análise" color="blue" />
          <Metric label="Em atendimento" value="18" note="Em execução" color="gold" />
          <Metric label="Resolvidas" value="42" note="Neste mês" color="green" />
          <Metric label="Tempo médio" value="3,2 dias" note="Até a resolução" color="teal" />
        </section>
        <div className="rp-dashboard-grid">
          <section className="rp-panel rp-status-panel">
            <h2>Denúncias por status</h2>
            <div className="rp-status-bars">
              {[
                ['Recebidas', 24, 'blue'],
                ['Em análise', 18, 'gold'],
                ['Em atendimento', 18, 'sky'],
                ['Resolvidas', 42, 'green'],
              ].map(([label, count, color]) => (
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
              <label>Status atual<select name="status" defaultValue={selectedComplaint.status} onChange={() => setSavedUpdate(false)}>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></label>
              <label>Setor responsável<select value={sector} onChange={(event) => { setSector(event.target.value); setSavedUpdate(false) }}><option>Secretaria de Obras</option><option>Secretaria de Serviços</option><option>Secretaria de Saneamento</option><option>Secretaria de Meio Ambiente</option></select></label>
              <label>Observação<textarea value={observation} onChange={(event) => { setObservation(event.target.value); setSavedUpdate(false) }} placeholder="Inclua uma atualização para o cidadão acompanhar." rows={3} /></label>
              {savedUpdate && <p className="rp-success-message" role="status">Atualização salva nesta demonstração.</p>}
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
            <tbody>{visibleComplaints.map((complaint) => <tr key={complaint.protocol}><td className="rp-protocol">{complaint.protocol}</td><td><strong>{complaint.title}</strong><small>{complaint.category}</small></td><td>{complaint.neighborhood}</td><td>{complaint.date}</td><td><StatusBadge status={complaint.status} /></td><td><button className="rp-text-button" type="button" onClick={() => { setSelectedProtocol(complaint.protocol); setSector(complaint.sector); setSavedUpdate(false) }}>Ver detalhes <span aria-hidden="true">→</span></button></td></tr>)}</tbody>
          </table></div>
          {visibleComplaints.length === 0 && <p className="rp-empty-state">Nenhuma denúncia encontrada com esses filtros.</p>}
          <div className="rp-table-footer"><span>1–{visibleComplaints.length} de {complaints.length} denúncias</span><span className="rp-pagination">‹ <b>1</b> 2 3 ›</span></div>
        </section>
      </>
    )
  }

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
        <NavLink className="rp-brand" to="/responsavel/dashboard"><span className="rp-brand-mark">C</span><span><strong>CidUp</strong><small>Painel do responsável</small></span></NavLink>
        <nav className="rp-navigation" aria-label="Navegação do responsável">{navigation.map((item) => <NavLink key={item.path} to={item.path} className={({ isActive }) => `rp-nav-link${isActive && (item.path.endsWith('/' + section) || section === '' && item.path.endsWith('dashboard')) ? ' is-active' : ''}`} onClick={() => setSelectedProtocol(null)}>{item.label}</NavLink>)}</nav>
        <div className="rp-sidebar-footer"><strong>◉ Responsável</strong><span>Prefeitura Municipal</span></div>
      </aside>
      <div className="rp-main-column">
        <header className="rp-topbar"><h2>{heading}</h2><button type="button" className="rp-profile-button">Ajuda <span aria-hidden="true">·</span> Ana Souza <span aria-hidden="true">⌄</span></button></header>
        <main className="rp-content">{body}</main>
      </div>
      {categoryDialog && <div className="rp-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCategoryDialog(false) }}><form className="rp-modal" role="dialog" aria-modal="true" aria-labelledby="rp-category-dialog-title" onSubmit={saveType}><h2 id="rp-category-dialog-title">{editingType ? 'Editar categoria' : 'Nova categoria'}</h2><label>Nome da categoria<input autoFocus required value={typeName} onChange={(event) => setTypeName(event.target.value)} /></label><label>Descrição<textarea rows={3} value={typeDescription} onChange={(event) => setTypeDescription(event.target.value)} /></label><div className="rp-modal-actions"><button className="rp-outline-button" type="button" onClick={() => setCategoryDialog(false)}>Cancelar</button><button className="rp-primary-button" type="submit">Salvar categoria</button></div></form></div>}
    </div>
  )
}

function Metric({ label, value, note, color }: { label: string; value: string; note: string; color: string }) {
  return <article className={`rp-metric rp-metric-${color}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rp-info-row"><dt>{label}</dt><dd>{value}</dd></div>
}

export default ResponsiblePanelPage