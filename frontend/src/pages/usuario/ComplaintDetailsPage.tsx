import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiRequest, type Complaint } from '../../api'
import CitizenMobileNav from '../../components/usuario/CitizenMobileNav'
import CitizenHeader from '../../components/usuario/CitizenHeader'
import '../../App.css'

type ComplaintStatus = 'Recebida' | 'Em análise' | 'Em atendimento' | 'Resolvida' | 'Negada' | 'Cancelada'

const statusSteps: ComplaintStatus[] = ['Recebida', 'Em análise', 'Em atendimento', 'Resolvida']
const statusClasses: Record<ComplaintStatus, string> = {
	Recebida: 'status-received',
	'Em análise': 'status-analysis',
	'Em atendimento': 'status-service',
	Resolvida: 'status-solved',
	Negada: 'status-canceled',
	Cancelada: 'status-canceled',
}
const statusLabels: Record<string, ComplaintStatus> = {
	RECEIVED: 'Recebida',
	IN_ANALYSIS: 'Em análise',
	FORWARDED: 'Em atendimento',
	IN_SERVICE: 'Em atendimento',
	RESOLVED: 'Resolvida',
	NOT_SERVED: 'Negada',
}

// Apresenta uma data localizada ou um texto alternativo para valores ausentes/inválidos.
function formatDate(value?: string) {
	if (!value) return 'Data não informada'
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return 'Data não informada'
	return new Intl.DateTimeFormat('pt-BR').format(date)
}

// Reutiliza o cabeçalho da área de acompanhamento.
function Header() {
	return <CitizenHeader active="complaints" />
}

	// Carrega uma denúncia do protocolo informado e monta sua linha do tempo de status.
	function ComplaintDetailsPage() {
		const { protocol } = useParams()
		const [complaint, setComplaint] = useState<Complaint | null>(null)
		const [loading, setLoading] = useState(true)
		const [error, setError] = useState('')
		const complaintId = Number(protocol)
		const hasValidProtocol = Number.isSafeInteger(complaintId) && complaintId > 0

		// Busca o registro somente para protocolos válidos e ignora respostas obsoletas.
		useEffect(() => {
			let active = true
			if (!hasValidProtocol) return () => { active = false }
			apiRequest<{ complaint: Complaint }>(`/api/complaints/${complaintId}`)
				.then(({ complaint: record }) => {
					if (active) setComplaint(record)
				})
				.catch((requestError: unknown) => {
					if (active) setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar a denúncia.')
				})
				.finally(() => {
					if (active) setLoading(false)
				})
			return () => { active = false }
		}, [complaintId, hasValidProtocol])

	const status = complaint
		? statusLabels[complaint.status] ?? complaint.status as ComplaintStatus
		: 'Recebida'
		const currentStep = status === 'Cancelada' || status === 'Negada'
		? -1
		: statusSteps.indexOf(status)

	return (
		<main className="my-complaints-page">
			<Header />
			<section className="complaints-page-content" aria-labelledby="complaint-details-title">
				<Link className="complaints-back-link" to="/minhas-denuncias">← Voltar para minhas denúncias</Link>
					{loading && hasValidProtocol ? (
					<p aria-busy="true">Carregando denúncia...</p>
					) : !hasValidProtocol || error || !complaint ? (
					<div className="complaints-empty-state">
						<h2>Denúncia não encontrada</h2>
						<p>{error || 'Esta denúncia não está disponível para sua conta.'}</p>
						<Link className="secondary-action" to="/minhas-denuncias">Ver minhas denúncias</Link>
					</div>
				) : (
					<article className="complaint-detail-panel">
						<div className="complaint-detail-heading">
							<div>
								<p className="complaint-kicker">DETALHES DA DENÚNCIA</p>
								<h2 id="complaint-details-title">{complaint.type.name || 'Denúncia'}</h2>
								<span className="complaint-protocol">{complaint.protocol}</span>
							</div>
							<span className={`status ${statusClasses[status] ?? 'status-received'}`}>{status}</span>
						</div>

						<section className="complaint-timeline" aria-labelledby="timeline-title">
							<h3 id="timeline-title">Acompanhamento</h3>
							{currentStep === -1 ? (
								<div className="timeline-canceled">
									<span className="timeline-marker">!</span>
									<div>
										<strong>Denúncia {status.toLowerCase()}</strong>
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
								<div><dt>Endereço</dt><dd>{complaint.address || 'Não informado'}</dd></div>
								<div><dt>Data de registro</dt><dd>{formatDate(complaint.registeredAt)}</dd></div>
							</dl>
							<section className="complaint-observations" aria-labelledby="observations-title">
								<h3 id="observations-title">Atualizações da prefeitura</h3>
								{complaint.history.length === 0 ? (
									<p>Nenhuma observação foi registrada ainda.</p>
								) : (
									<div className="complaint-observation-list">
										{complaint.history.map((item) => (
											<article className="complaint-observation" key={item.id}>
												<strong>{item.description}</strong>
												<p>{item.observation}</p>
											</article>
										))}
									</div>
								)}
							</section>
						</article>
				)}
			</section>
			<CitizenMobileNav />
		</main>
	)
}

export default ComplaintDetailsPage
