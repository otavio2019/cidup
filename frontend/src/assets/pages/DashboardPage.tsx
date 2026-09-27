import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest, type Complaint } from '../../api'
import '../../App.css'

// TODO: substituir os números e denúncias simulados pelos dados da API.
// TODO: conectar os links às telas de registrar denúncia e detalhes.
function DashboardPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [complaintMessage, setComplaintMessage] = useState('')
  const [description, setDescription] = useState('')
  const [draft, setDraft] = useState<{
    title: string
    category: string
    priority: string
    summary: string
  } | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiMessage, setAiMessage] = useState('')

  useEffect(() => {
    apiRequest<{ complaints: Complaint[] }>('/api/complaints')
      .then((data) => setComplaints(data.complaints))
      .catch((error: unknown) => setComplaintMessage(error instanceof Error ? error.message : 'Não foi possível carregar as denúncias.'))
  }, [])

  async function removeComplaint(id: number) {
    if (!window.confirm('Excluir esta denúncia?')) return
    try {
      await apiRequest(`/api/complaints/${id}`, { method: 'DELETE' })
      setComplaints((current) => current.filter((complaint) => complaint.id !== id))
    } catch (error) {
      setComplaintMessage(error instanceof Error ? error.message : 'Não foi possível excluir a denúncia.')
    }
  }

  async function generateDraft() {
    setAiMessage('')
    setDraft(null)
    setIsGenerating(true)

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/ai/complaint-draft`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description }),
        },
      )
      const data = (await response.json()) as {
        error?: string
        title?: string
        category?: string
        priority?: string
        summary?: string
      }

      if (!response.ok) {
        throw new Error(data.error ?? 'Não foi possível gerar o rascunho.')
      }

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

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-brand">
          <h1>CidUp</h1>
          <p>Cidades melhores começam com você</p>
        </div>

        <nav className="dashboard-nav" aria-label="Navegação principal">
          <a className="active" href="#inicio">
            Início
          </a>

          <a href="#denuncia">Registrar denúncia</a>
          <Link to="/minhas-denuncias">Minhas denúncias</Link>
          <Link to="/perfil">Perfil</Link>
        </nav>

        <Link className="profile-button" to="/perfil">
          <span className="profile-icon">●</span>
          Meu perfil
        </Link>
      </header>

      <section className="dashboard-content">
        <div className="dashboard-main">
          <div className="welcome-section">
            <h2>Olá, cidadão</h2>
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

          <div className="summary-grid">
            <article className="summary-card blue-card">
              <span className="summary-icon">▣</span>
              <p>Denúncias abertas</p>
              <strong>{complaints.filter((complaint) => complaint.status === 'RECEIVED' || complaint.status === 'IN_ANALYSIS').length}</strong>
              <span>Aguardando análise</span>
            </article>

            <article className="summary-card yellow-card">
              <span className="summary-icon">◷</span>
              <p>Em atendimento</p>
              <strong>{complaints.filter((complaint) => complaint.status === 'FORWARDED' || complaint.status === 'IN_SERVICE').length}</strong>
              <span>Em análise pelos órgãos</span>
            </article>

            <article className="summary-card green-card">
              <span className="summary-icon">✓</span>
              <p>Resolvidas</p>
              <strong>{complaints.filter((complaint) => complaint.status === 'RESOLVED').length}</strong>
              <span>Problemas solucionados</span>
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
                <span className={`status ${complaint.status === 'RESOLVED' ? 'status-solved' : 'status-analysis'}`}>{complaint.status}</span>
                <button type="button" onClick={() => removeComplaint(complaint.id)}>Excluir</button>
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

            <a href="#sair">
              <span>↪</span>
              <div>
                <strong>Sair</strong>
              </div>
              <b>›</b>
            </a>
          </div>
        </aside>
      </section>
    </main>
  )
}

export default DashboardPage
