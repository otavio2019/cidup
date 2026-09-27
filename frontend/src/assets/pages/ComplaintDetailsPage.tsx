import { Link, useParams } from 'react-router-dom'
import '../../App.css'

type ComplaintStatus = 'Recebida' | 'Em análise' | 'Em atendimento' | 'Resolvida' | 'Cancelada'

type Complaint = {
  protocol: string
  type?: string
  description?: string
  address?: string
  neighborhood?: string
  complement?: string
  registeredAt?: string
  status?: ComplaintStatus
}

const statusSteps: ComplaintStatus[] = ['Recebida', 'Em análise', 'Em atendimento', 'Resolvida']
const statusClasses: Record<ComplaintStatus, string> = {
  Recebida: 'status-received',
  'Em análise': 'status-analysis',
  'Em atendimento': 'status-service',
  Resolvida: 'status-solved',
  Cancelada: 'status-canceled',
}

function readComplaint(protocol?: string): Complaint | undefined {
  if (!protocol) return undefined
  try {
    const complaints = JSON.parse(localStorage.getItem('cidup-complaints') ?? '[]') as Complaint[]
    return Array.isArray(complaints)
      ? complaints.find((complaint) => complaint.protocol === protocol)
      : undefined
  } catch {
    return undefined
  }
}

function formatDate(value?: string) {
  if (!value) return 'Data não informada'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Data não informada'
  return new Intl.DateTimeFormat('pt-BR').format(date)
}

function Header() {
  return (
    <header className="dashboard-header">
      <Link className="dashboard-brand complaints-brand" to="/dashboard">
        <h1>CidUp</h1>
        <p>Cidades melhores começam com você</p>
      </Link>
      <nav className="dashboard-nav" aria-label="Navegação principal">
        <Link to="/dashboard">Início</Link>
        <Link to="/registrar-denuncia">Registrar denúncia</Link>
        <Link className="active" to="/minhas-denuncias">Minhas denúncias</Link>
      </nav>
      <Link className="profile-button" to="/perfil">Meu perfil</Link>
    </header>
  )
}

function ComplaintDetailsPage() {
  const { protocol } = useParams()
  const complaint = readComplaint(protocol ? decodeURIComponent(protocol) : undefined)

  if (!complaint) {
    return (
      <main className="my-complaints-page">
        <Header />
        <section className="complaints-page-content">
          <Link className="complaints-back-link" to="/minhas-denuncias">← Voltar para minhas denúncias</Link>
          <div className="complaints-empty-state">
            <h2>Denúncia não encontrada</h2>
            <p>Este protocolo não está disponível neste dispositivo.</p>
            <Link className="secondary-action" to="/minhas-denuncias">Ver minhas denúncias</Link>
          </div>
        </section>
      </main>
    )
  }

  const status = complaint.status ?? 'Recebida'
  const currentStep = status === 'Cancelada' ? -1 : statusSteps.indexOf(status)

  return (
    <main className="my-complaints-page">
      <Header />
      <section className="complaints-page-content" aria-labelledby="complaint-details-title">
        <Link className="complaints-back-link" to="/minhas-denuncias">← Voltar para minhas denúncias</Link>
        <article className="complaint-detail-panel">
          <div className="complaint-detail-heading">
            <div>
              <p className="complaint-kicker">DETALHES DA DENÚNCIA</p>
              <h2 id="complaint-details-title">{complaint.type || 'Denúncia'}</h2>
              <span className="complaint-protocol">{complaint.protocol}</span>
            </div>
            <span className={`status ${statusClasses[status]}`}>{status}</span>
          </div>

          <section className="complaint-timeline" aria-labelledby="timeline-title">
            <h3 id="timeline-title">Acompanhamento</h3>
            {status === 'Cancelada' ? (
              <div className="timeline-canceled">
                <span className="timeline-marker">!</span>
                <div>
                  <strong>Denúncia cancelada</strong>
                  <p>Este registro não seguirá para atendimento.</p>
                </div>
              </div>
            ) : (
              <ol className="timeline-list">
                {statusSteps.map((step, index) => {
                  const isCompleted = index <= currentStep
                  const isCurrent = index === currentStep
                  return (
                    <li className={`${isCompleted ? 'is-completed' : ''} ${isCurrent ? 'is-current' : ''}`} key={step}>
                      <span className="timeline-marker" aria-hidden="true">{isCompleted ? '✓' : index + 1}</span>
                      <div>
                        <strong>{step}</strong>
                        <p>
                          {isCurrent ? 'Status atual da sua denúncia.' : isCompleted ? 'Etapa concluída.' : 'Aguardando esta etapa.'}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>

          <dl className="complaint-detail-list">
            <div><dt>Descrição</dt><dd>{complaint.description || 'Não informada'}</dd></div>
            <div>
              <dt>Endereço</dt>
              <dd>{[complaint.address, complaint.neighborhood].filter(Boolean).join(' — ') || 'Não informado'}</dd>
            </div>
            {complaint.complement && <div><dt>Ponto de referência</dt><dd>{complaint.complement}</dd></div>}
            <div><dt>Data de registro</dt><dd>{formatDate(complaint.registeredAt)}</dd></div>
          </dl>
        </article>
      </section>
    </main>
  )
}

export default ComplaintDetailsPage
