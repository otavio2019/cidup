import { Link, useParams } from 'react-router-dom'
import '../../App.css'

type Complaint = {
	protocol: string
	type?: string
	description?: string
	address?: string
	neighborhood?: string
	complement?: string
	registeredAt?: string
	status?: string
}

function readComplaint(protocol?: string): Complaint | undefined {
	if (!protocol) return undefined
	try {
		const complaints = JSON.parse(
			localStorage.getItem('cidup-complaints') ?? '[]',
		) as Complaint[]
		return Array.isArray(complaints)
			? complaints.find((complaint) => complaint.protocol === protocol)
			: undefined
	} catch {
		return undefined
	}
}

function ComplaintDetailsPage() {
	const { protocol } = useParams()
	const complaint = readComplaint(protocol ? decodeURIComponent(protocol) : undefined)

	return (
		<main className="my-complaints-page">
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
				<Link className="profile-button" to="/dashboard">Meu perfil</Link>
			</header>

			<section className="complaints-page-content" aria-labelledby="complaint-details-title">
				<Link className="complaints-back-link" to="/minhas-denuncias">
					← Voltar para minhas denúncias
				</Link>

				{!complaint ? (
					<div className="complaints-empty-state">
						<h2>Denúncia não encontrada</h2>
						<p>Este protocolo não está disponível neste dispositivo.</p>
						<Link className="secondary-action" to="/minhas-denuncias">
							Ver minhas denúncias
						</Link>
					</div>
				) : (
					<article className="complaint-detail-panel">
						<div className="complaint-detail-heading">
							<div>
								<p className="complaint-kicker">DETALHES DA DENÚNCIA</p>
								<h2 id="complaint-details-title">{complaint.type || 'Denúncia'}</h2>
								<span className="complaint-protocol">{complaint.protocol}</span>
							</div>
							<span className="status status-received">{complaint.status ?? 'Recebida'}</span>
						</div>
						<dl className="complaint-detail-list">
							<div>
								<dt>Descrição</dt>
								<dd>{complaint.description || 'Não informada'}</dd>
							</div>
							<div>
								<dt>Endereço</dt>
								<dd>
									{[complaint.address, complaint.neighborhood]
										.filter(Boolean)
										.join(' — ') || 'Não informado'}
								</dd>
							</div>
							{complaint.complement && (
								<div>
									<dt>Ponto de referência</dt>
									<dd>{complaint.complement}</dd>
								</div>
							)}
							<div>
								<dt>Data de registro</dt>
								<dd>
									{complaint.registeredAt
										? new Intl.DateTimeFormat('pt-BR').format(new Date(complaint.registeredAt))
										: 'Não informada'}
								</dd>
							</div>
						</dl>
					</article>
				)}
			</section>
		</main>
	)
}

export default ComplaintDetailsPage
