import { useState } from 'react'
import { Link } from 'react-router-dom'
import '../../App.css'

// TODO: substituir os números e denúncias simulados pelos dados da API.
// TODO: conectar os links às telas de registrar denúncia e detalhes.
function DashboardPage() {
  const [description, setDescription] = useState('')
  const [draft, setDraft] = useState<{
    title: string
    category: string
    priority: string
    summary: string
  } | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiMessage, setAiMessage] = useState('')

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
          <a href="#minhas-denuncias">Minhas denúncias</a>
          <a href="#perfil">Perfil</a>
        </nav>

        <button className="profile-button" type="button">
          <span className="profile-icon">●</span>
          Meu perfil
        </button>
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
              <strong>12</strong>
              <span>Aguardando análise</span>
            </article>

            <article className="summary-card yellow-card">
              <span className="summary-icon">◷</span>
              <p>Em atendimento</p>
              <strong>8</strong>
              <span>Em análise pelos órgãos</span>
            </article>

            <article className="summary-card green-card">
              <span className="summary-icon">✓</span>
              <p>Resolvidas</p>
              <strong>24</strong>
              <span>Problemas solucionados</span>
            </article>
          </div>

          <section className="complaints-section">
            <div className="section-heading">
              <h3>Acompanhe suas denúncias</h3>
              <a href="#todas">Ver todas →</a>
            </div>

            <article className="complaint-item">
              <div>
                <strong>#2024-001234</strong>
                <p>Buraco na via pública</p>
                <small>Registrada em 12/04/2024</small>
              </div>

              <span className="status status-analysis">Em análise</span>

              <a href="#detalhes">Ver detalhes →</a>
            </article>

            <article className="complaint-item">
              <div>
                <strong>#2024-000987</strong>
                <p>Lâmpada queimada</p>
                <small>Registrada em 03/04/2024</small>
              </div>

              <span className="status status-solved">Resolvida</span>

              <a href="#detalhes">Ver detalhes →</a>
            </article>
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
            <a href="#perfil">
              <span>●</span>
              <div>
                <strong>Meu perfil</strong>
                <small>Visualize e edite seus dados</small>
              </div>
              <b>›</b>
            </a>

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
