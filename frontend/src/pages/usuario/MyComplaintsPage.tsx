import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest, type Complaint } from '../../api'
import CitizenMobileNav from '../../components/usuario/CitizenMobileNav'
import CitizenHeader from '../../components/usuario/CitizenHeader'
import '../../App.css'

const statusClasses: Record<string, string> = {
	'Recebida': 'status-received',
	'Em análise': 'status-analysis',
	'Em atendimento': 'status-service',
	'Resolvida': 'status-solved',
	'Não atendida': 'status-canceled',
	'Cancelada': 'status-canceled',
}

const statusLabels: Record<string, string> = {
	RECEIVED: 'Recebida',
	IN_ANALYSIS: 'Em análise',
	FORWARDED: 'Em atendimento',
	IN_SERVICE: 'Em atendimento',
	RESOLVED: 'Resolvida',
	NOT_SERVED: 'Não atendida',
}

// Formata datas para exibição local e oferece uma mensagem para valores inválidos.
function formatDate(value?: string) {
	if (!value) return 'Data não informada'
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return 'Data não informada'
	return new Intl.DateTimeFormat('pt-BR').format(date)
}

// Busca as denúncias do cidadão e apresenta estados de carregamento, erro e resultados.
function MyComplaintsPage() {
	const [complaints, setComplaints] = useState<Complaint[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	// Carrega a lista da API e impede atualizações de estado após sair da página.
	useEffect(() => {
		let active = true
		apiRequest<{ complaints: Complaint[] }>('/api/complaints')
			.then(({ complaints: records }) => {
				if (active) setComplaints(records)
			})
			.catch((requestError: unknown) => {
				if (active) setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar as denúncias.')
			})
			.finally(() => {
				if (active) setLoading(false)
			})
		return () => { active = false }
	}, [])

	return (
		<main className="my-complaints-page">
			<CitizenHeader active="complaints" />
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

				{loading ? (
					<p aria-busy="true">Carregando denúncias...</p>
				) : error ? (
					<p className="form-message" role="alert">{error}</p>
				) : complaints.length === 0 ? (
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
							const status = statusLabels[complaint.status] ?? complaint.status

							return (
								<article className="my-complaint-item" key={complaint.id}>
									<div className="my-complaint-main">
										<span className="complaint-protocol">{complaint.protocol}</span>
										<h3>{complaint.type.name || 'Tipo não informado'}</h3>
										<p className="my-complaint-description">
											{complaint.description || 'Sem descrição.'}
										</p>
										<p className="my-complaint-address">
											<span aria-hidden="true">⌖</span>
											{complaint.address || 'Endereço não informado'}
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
											to={`/denuncias/${complaint.id}`}
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
