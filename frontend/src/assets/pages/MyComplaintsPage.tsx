import { useState } from 'react'
import { Link } from 'react-router-dom'
import CitizenMobileNav from './CitizenMobileNav'
import '../../App.css'

type Complaint = {
	protocol: string
	type?: string
	description?: string
	address?: string
	neighborhood?: string
	registeredAt?: string
	status?: string
}

const statusClasses: Record<string, string> = {
	Recebida: 'status-received',
	'Em análise': 'status-analysis',
	'Em atendimento': 'status-service',
	Resolvida: 'status-solved',
	Cancelada: 'status-canceled',
}

function readComplaints(): Complaint[] {
	try {
		const complaints = JSON.parse(
			localStorage.getItem('cidup-complaints') ?? '[]',
		) as Complaint[]
		return Array.isArray(complaints) ? complaints : []
	} catch {
		return []
	}
}

function formatDate(value?: string) {
	if (!value) return 'Data não informada'
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return 'Data não informada'
	return new Intl.DateTimeFormat('pt-BR').format(date)
}

function MyComplaintsPage() {
	const [complaints] = useState(readComplaints)

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

			<section className="complaints-page-content" aria-labelledby="my-complaints-title">
				<div className="my-complaints-heading">
					<div>
						<p className="complaint-kicker">ACOMPANHAMENTO</p>
						<h2 id="my-complaints-title">Minhas denúncias</h2>
						<p>Acompanhe o andamento dos registros feitos por você.</p>
					</div>
					<Link className="primary-action" to="/registrar-denuncia">
						Registrar denúncia
					</Link>
				</div>

				{complaints.length === 0 ? (
					<div className="complaints-empty-state">
						<span aria-hidden="true">▤</span>
						<h3>Nenhuma denúncia registrada</h3>
						<p>Quando você enviar uma denúncia, ela aparecerá aqui para acompanhamento.</p>
						<Link className="secondary-action" to="/registrar-denuncia">
							Fazer uma denúncia
						</Link>
					</div>
				) : (
					<div className="my-complaints-list">
						{complaints.map((complaint) => {
							const status = complaint.status ?? 'Recebida'
							const address = [complaint.address, complaint.neighborhood]
								.filter(Boolean)
								.join(' — ')

							return (
								<article className="my-complaint-item" key={complaint.protocol}>
									<div className="my-complaint-main">
										<span className="complaint-protocol">{complaint.protocol}</span>
										<h3>{complaint.type || 'Tipo não informado'}</h3>
										<p className="my-complaint-description">
											{complaint.description || 'Sem descrição.'}
										</p>
										<p className="my-complaint-address">
											<span aria-hidden="true">⌖</span>
											{address || 'Endereço não informado'}
										</p>
										<p className="my-complaint-date">
											Registrada em {formatDate(complaint.registeredAt)}
										</p>
									</div>
									<div className="my-complaint-actions">
										<span className={`status ${statusClasses[status] ?? 'status-received'}`}>
											{status}
										</span>
										<Link
											className="complaint-details-link"
											to={`/denuncias/${encodeURIComponent(complaint.protocol)}`}
										>
											Ver detalhes <span aria-hidden="true">→</span>
										</Link>
									</div>
								</article>
							)
						})}
					</div>
				)}
			</section>
			<CitizenMobileNav />
		</main>
	)
}

export default MyComplaintsPage
