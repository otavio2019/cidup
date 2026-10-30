import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRequest, type Complaint } from '../../api'
import CitizenMobileNav from '../../components/usuario/CitizenMobileNav'
import CitizenHeader from '../../components/usuario/CitizenHeader'
import '../../App.css'

/** Painel do cidadão: indicadores, atalhos, denúncias recentes e rascunho opcional por IA. */
const complaintStatusLabels: Record<string, string> = {
  RECEIVED: 'Recebida',
  IN_ANALYSIS: 'Em análise',
  FORWARDED: 'Em atendimento',
  IN_SERVICE: 'Em atendimento',
  RESOLVED: 'Resolvida',
  NOT_SERVED: 'Negada',
  CANCELLED: 'Cancelada',
  CANCELED: 'Cancelada',
}

function readStoredCitizenName() {
  try {
    const profile = JSON.parse(localStorage.getItem('cidup-profile') ?? '{}') as { name?: unknown }
    return typeof profile.name === 'string' ? profile.name.trim().split(/\s+/)[0] : ''
  } catch {
    return ''
  }
}

  // Carrega o resumo das denúncias e reúne atalhos e recursos do painel cidadão.
function DashboardPage() {
  const navigate = useNavigate()
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [complaintMessage, setComplaintMessage] = useState('')
  const [logoutError, setLogoutError] = useState('')
  const [description, setDescription] = useState('')
  const [citizenName, setCitizenName] = useState(readStoredCitizenName)
  const [draft, setDraft] = useState<{
    title: string
    category: string
    priority: string
    summary: string
  } | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiMessage, setAiMessage] = useState('')
  const [utilityMessage, setUtilityMessage] = useState('')

  // Busca as denúncias da sessão para preencher os indicadores e a lista recente.
  useEffect(() => {
    apiRequest<{ complaints: Complaint[] }>('/api/complaints')
      .then((data) => setComplaints(data.complaints))
      .catch((error: unknown) => setComplaintMessage(error instanceof Error ? error.message : 'Não foi possível carregar as denúncias.'))
  }, [])

  useEffect(() => {
    apiRequest<{ user: { name?: string } }>('/api/auth/session')
      .then(({ user }) => {
        const name = user.name?.trim() ?? ''
        if (name) {
          setCitizenName(name.split(/\s+/)[0])
          localStorage.setItem('cidup-profile', JSON.stringify({ ...JSON.parse(localStorage.getItem('cidup-profile') ?? '{}'), name }))
        }
      })
      .catch(() => undefined)
  }, [])

  async function handleLogout() {
    setLogoutError('')
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : 'Não foi possível encerrar a sessão.')
      return
    }
    localStorage.removeItem('cidup-role')
    localStorage.removeItem('cidup-user-id')
    localStorage.removeItem('cidup-complaints')
    localStorage.removeItem('cidup-profile')
    sessionStorage.removeItem('cidup-complaint-draft')
    sessionStorage.removeItem('cidup-complaint-confirmation')
    navigate('/login', { replace: true })
  }

  function clearSavedDraft() {
    sessionStorage.removeItem('cidup-complaint-draft')
    setUtilityMessage('Rascunho local removido deste navegador.')
  }

  // Pede confirmação antes de excluir e remove da tela apenas após sucesso na API.
  async function removeComplaint(id: number) {
    if (!window.confirm('Excluir esta denúncia?')) return
    try {
      await apiRequest(`/api/complaints/${id}`, { method: 'DELETE' })
      setComplaints((current) => current.filter((complaint) => complaint.id !== id))
    } catch (error) {
      setComplaintMessage(error instanceof Error ? error.message : 'Não foi possível excluir a denúncia.')
    }
  }

  // Solicita um rascunho à IA e apresenta falhas sem perder o controle de carregamento.
  async function generateDraft() {
    setAiMessage('')
    setDraft(null)
    setIsGenerating(true)

    try {
      const data = await apiRequest<{
        title?: string
        category?: string
        priority?: string
        summary?: string
      }>('/api/ai/complaint-draft', {
        method: 'POST',
        body: JSON.stringify({ description }),
      })

      setDraft({
        title: data.title ?? '',
        category: data.category ?? '',
        priority: data.priority ?? '',
        summary: data.summary ?? '',
      })
    } catch (error) {
      setAiMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível gerar o rascunho.',
      )
    } finally {
      setIsGenerating(false)
    }
  }

  const countStatus = (status: string) => complaints.filter((complaint) => complaint.status === status).length
  const deniedCount = countStatus('NOT_SERVED') + countStatus('CANCELLED') + countStatus('CANCELED')

  return (
    <main className="dashboard-page">
      <CitizenHeader active="home" />

      <section className="dashboard-content">
        <div className="dashboard-main">
          <div className="welcome-section">
            <h2>Olá, {citizenName || 'cidadão'}</h2>
            <p>O que você deseja fazer hoje?</p>
          </div>

          <Link className="report-card" to="/registrar-denuncia">
            <div className="report-icon">!</div>

            <div>
              <h3>Registrar nova denúncia</h3>
              <p>Ajude sua cidade a ser um lugar melhor para todos.</p>
            </div>

            <span className="report-arrow">→</span>
          </Link>

          {/* O rascunho é solicitado a /api/ai/complaint-draft e deve ser revisado antes do fluxo de registro. */}
          <section className="ai-report-section" id="denuncia">
            <div className="section-heading">
              <div>
                <p className="ai-kicker">ASSISTENTE DE DENÚNCIA</p>
                <h3>Transforme seu relato em uma denúncia clara</h3>
              </div>
              <span className="ai-badge">IA</span>
            </div>

            <p className="ai-description">
              Conte o que aconteceu, onde foi e qualquer detalhe importante.
              A IA vai preparar um rascunho para você revisar.
            </p>
            <textarea
              className="ai-textarea"
              placeholder="Ex.: Há um buraco grande na Rua das Flores, perto da escola..."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
            />
            <button
              className="ai-button"
              type="button"
              onClick={generateDraft}
              disabled={isGenerating || description.trim().length < 10}
            >
              {isGenerating ? 'Preparando rascunho...' : 'Preparar denúncia'}
            </button>

            {aiMessage && <p className="ai-message">{aiMessage}</p>}

            {draft && (
              <div className="ai-draft" aria-live="polite">
                <span className="draft-label">RASCUNHO PARA REVISÃO</span>
                <h4>{draft.title}</h4>
                <div className="draft-meta">
                  <span>{draft.category}</span>
                  <span>{draft.priority}</span>
                </div>
                <p>{draft.summary}</p>
              </div>
            )}
          </section>

          {/* Os cartões resumem os status das denúncias carregadas de /api/complaints. */}
          <div className="summary-grid">
            <article className="summary-card progress-card">
              <span className="summary-icon">●</span>
              <p>Recebida</p>
              <strong>{countStatus('RECEIVED')}</strong>
              <span>Denúncias recebidas</span>
            </article>

            <article className="summary-card open-card">
              <span className="summary-icon">◷</span>
              <p>Em análise</p>
              <strong>{countStatus('IN_ANALYSIS')}</strong>
              <span>Aguardando avaliação</span>
            </article>

            <article className="summary-card yellow-card">
              <span className="summary-icon">◷</span>
              <p>Em atendimento</p>
              <strong>{countStatus('FORWARDED') + countStatus('IN_SERVICE')}</strong>
              <span>Em execução pelos órgãos</span>
            </article>

            <article className="summary-card green-card">
              <span className="summary-icon">✓</span>
              <p>Resolvida</p>
              <strong>{countStatus('RESOLVED')}</strong>
              <span>Problemas solucionados</span>
            </article>

            <article className="summary-card denied-card">
              <span className="summary-icon">!</span>
              <p>Negadas</p>
              <strong>{deniedCount}</strong>
              <span>Não seguirão para atendimento</span>
            </article>
          </div>

          <section className="complaints-section">
            <div className="section-heading">
              <h3>Acompanhe suas denúncias</h3>
              <Link to="/minhas-denuncias">Ver todas →</Link>
            </div>

            {complaintMessage && <p className="form-message" role="alert">{complaintMessage}</p>}
            {complaints.length === 0 && !complaintMessage && <p>Nenhuma denúncia registrada ainda.</p>}
            {complaints.slice(0, 5).map((complaint) => (
              <article className="complaint-item" key={complaint.id}>
                <div>
                  <strong>{complaint.protocol}</strong>
                  <p>{complaint.title}</p>
                  <small>Registrada em {new Date(complaint.createdAt).toLocaleDateString('pt-BR')}</small>
                </div>
                <span className={`status ${complaint.status === 'RESOLVED' ? 'status-solved' : ['NOT_SERVED', 'CANCELLED', 'CANCELED'].includes(complaint.status) ? 'status-canceled' : complaint.status === 'FORWARDED' || complaint.status === 'IN_SERVICE' ? 'status-service' : 'status-analysis'}`}>{complaintStatusLabels[complaint.status] ?? 'Em análise'}</span>
                <button className="dashboard-delete-button" type="button" onClick={() => removeComplaint(complaint.id)}>Excluir</button>
              </article>
            ))}
          </section>
        </div>

        <aside className="dashboard-sidebar">
          <div className="city-card">
            <h3>Juntos por cidades melhores</h3>
            <p>
              Sua participação faz a diferença. Denuncie, acompanhe e
              contribua para uma cidade mais segura, limpa e organizada.
            </p>
          </div>

          <div className="sidebar-menu">
            <Link to="/perfil">
              <span>●</span>
              <div>
                <strong>Meu perfil</strong>
                <small>Visualize e edite seus dados</small>
              </div>
              <b>›</b>
            </Link>

            <a href="#configuracoes">
              <span>⚙</span>
              <div>
                <strong>Configurações</strong>
              </div>
              <b>›</b>
            </a>

            <a href="#ajuda">
              <span>?</span>
              <div>
                <strong>Central de ajuda</strong>
              </div>
              <b>›</b>
            </a>

            <a
              href="#sair"
              onClick={(event) => {
                event.preventDefault()
                void handleLogout()
              }}
            >
              <span>↪</span>
              <div>
                <strong>Sair</strong>
              </div>
              <b>›</b>
            </a>
            {logoutError && <p className="form-message" role="alert">{logoutError}</p>}
          </div>
        </aside>
      </section>

      <section className="dashboard-utility-grid" aria-label="Ajuda e configurações">
        <section className="dashboard-utility-card" id="ajuda" aria-labelledby="ajuda-title">
          <p className="complaint-kicker">SUPORTE</p>
          <h2 id="ajuda-title">Central de ajuda</h2>
          <p>Encontre orientações rápidas para registrar e acompanhar uma denúncia.</p>
          <div className="help-list">
            <details>
              <summary>Como registrar uma denúncia?</summary>
              <p>Clique em “Registrar nova denúncia”, escolha o tipo do problema, descreva o ocorrido, informe o local e revise os dados antes de enviar.</p>
            </details>
            <details>
              <summary>Como acompanhar uma denúncia?</summary>
              <p>Acesse “Minhas denúncias” para consultar o protocolo, o status atual e as observações registradas pelo órgão responsável.</p>
            </details>
            <details>
              <summary>Posso anexar uma foto?</summary>
              <p>Sim. São aceitos arquivos PNG, JPG ou WEBP de até 2 MB. A foto é opcional e ajuda o órgão a entender o problema.</p>
            </details>
          </div>
        </section>

        <section className="dashboard-utility-card" id="configuracoes" aria-labelledby="configuracoes-title">
          <p className="complaint-kicker">CONTA</p>
          <h2 id="configuracoes-title">Configurações</h2>
          <p>Gerencie seus dados e o conteúdo salvo neste navegador.</p>
          <div className="settings-actions">
            <Link className="secondary-action" to="/perfil">Editar meu perfil</Link>
            <button className="secondary-action" type="button" onClick={clearSavedDraft}>Limpar rascunho local</button>
          </div>
          {utilityMessage && <p className="form-message" role="status">{utilityMessage}</p>}
          <small className="settings-note">O rascunho local fica apenas neste navegador e não é enviado até você confirmar a denúncia.</small>
        </section>
      </section>
      <CitizenMobileNav />
    </main>
  )
}

export default DashboardPage
