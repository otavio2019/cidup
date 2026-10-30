import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiRequest, type Complaint } from '../../api'
import CitizenMobileNav from '../../components/usuario/CitizenMobileNav'
import CitizenHeader from '../../components/usuario/CitizenHeader'
import '../../App.css'

/** Detalha uma denúncia autorizada e apresenta seu histórico de atendimento. */
type ComplaintStatus = 'Recebida' | 'Em análise' | 'Em atendimento' | 'Resolvida' | 'Negada' | 'Cancelada'
type RelatedComplaint = {
	id: number
	protocol: string
	categories: string[]
	status: string
	distanceMeters: number
}

const relatedStatusLabels: Record<string, string> = {
	RECEIVED: 'Recebida',
	IN_ANALYSIS: 'Em análise',
	FORWARDED: 'Encaminhada',
	IN_SERVICE: 'Em atendimento',
	RESOLVED: 'Resolvida',
	NOT_SERVED: 'Negada',
}

// ===== STATUS E ETAPAS DO ATENDIMENTO =====
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

	// ===== ESTADO E CONSULTA DE DETALHES =====
	// Usa o identificador da rota em GET /api/complaints/{id}; a lista de origem é MyComplaintsPage.
	// Carrega uma denúncia do protocolo informado e monta sua linha do tempo de status.
	function ComplaintDetailsPage() {
		const { protocol } = useParams()
		const [complaint, setComplaint] = useState<Complaint | null>(null)
		const [relatedComplaints, setRelatedComplaints] = useState<RelatedComplaint[]>([])
		const [relatedForId, setRelatedForId] = useState<number | null>(null)
		const [relatedError, setRelatedError] = useState('')
		const [loading, setLoading] = useState(true)
		const [error, setError] = useState('')
		const complaintId = Number(protocol)
		const hasValidProtocol = Number.isSafeInteger(complaintId) && complaintId > 0

		// Busca o registro somente para protocolos válidos e ignora respostas obsoletas.
		useEffect(() => {
			let active = true
			if (!hasValidProtocol) return () => { active = false }
			// GET /api/complaints/{id} retorna o registro e o histórico de atendimento.
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

		useEffect(() => {
			let active = true
			if (!complaint) return () => { active = false }
			apiRequest<{ related: RelatedComplaint[] }>(`/api/complaints/${complaint.id}/related`)
				.then(({ related }) => {
					if (active) {
						setRelatedComplaints(related)
						setRelatedError('')
						setRelatedForId(complaint.id)
					}
				})
				.catch((requestError: unknown) => {
					if (active) {
						setRelatedError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar denúncias relacionadas.')
						setRelatedForId(complaint.id)
					}
				})
			return () => { active = false }
		}, [complaint])
		const relatedLoading = Boolean(complaint && relatedForId !== complaint.id)

	// ===== STATUS ATUAL E PROGRESSO =====
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
									<p className="complaint-related-categories">{complaint.categories.join(', ')}</p>
								</div>
								<div className="complaint-detail-heading-actions">
									<span className={`status ${statusClasses[status] ?? 'status-received'}`}>{status}</span>
									<button className="secondary-action complaint-detail-print" type="button" onClick={() => window.print()}>
										Imprimir protocolo / Salvar em PDF
									</button>
								</div>
							</div>

						{/* Linha do tempo traduz o status retornado pela API em etapas visuais. */}
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
							<section className="complaint-observations" aria-labelledby="related-complaints-title">
								<h3 id="related-complaints-title">Ocorrências semelhantes próximas</h3>
								<p>Denúncias a até 50 metros, com ao menos uma categoria em comum. Cada uma mantém seu próprio protocolo.</p>
								{relatedLoading ? (
									<p aria-busy="true">Buscando ocorrências próximas...</p>
								) : relatedError ? (
									<p className="form-message" role="alert">{relatedError}</p>
								) : relatedComplaints.length === 0 ? (
									<p>Nenhuma ocorrência semelhante foi encontrada a até 50 metros.</p>
								) : (
									<div className="complaint-observation-list">
										{relatedComplaints.map((related) => (
											<article className="complaint-observation" key={related.id}>
												<strong>{related.protocol}</strong>
												<p>{related.categories.join(', ')} · {related.distanceMeters} m · {relatedStatusLabels[related.status] ?? related.status}</p>
											</article>
										))}
									</div>
								)}
							</section>
							{/* Atualizações exibem as observações incluídas no histórico do registro. */}
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
