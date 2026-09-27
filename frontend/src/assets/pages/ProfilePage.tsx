import { Link, useNavigate } from 'react-router-dom'
import '../../App.css'

type CitizenProfile = {
	name?: string
	email?: string
	phone?: string
	registeredAt?: string
}

function readProfile(): CitizenProfile {
	try {
		const storedProfile = localStorage.getItem('cidup-profile')
		if (!storedProfile) return {}

		const profile: unknown = JSON.parse(storedProfile)
		return profile && typeof profile === 'object'
			? (profile as CitizenProfile)
			: {}
	} catch {
		return {}
	}
}

function formatRegistrationDate(value?: string) {
	if (!value) return 'Não informada'
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return 'Não informada'
	return new Intl.DateTimeFormat('pt-BR').format(date)
}

function ProfilePage() {
	const navigate = useNavigate()
	const profile = readProfile()

	function handleLogout() {
		localStorage.removeItem('cidup-authenticated')
		navigate('/login', { replace: true })
	}

	return (
		<main className="profile-page">
			<header className="dashboard-header">
				<Link className="dashboard-brand complaints-brand" to="/dashboard">
					<h1>CidUp</h1>
					<p>Cidades melhores começam com você</p>
				</Link>
				<nav className="dashboard-nav" aria-label="Navegação principal">
					<Link to="/dashboard">Início</Link>
					<Link to="/registrar-denuncia">Registrar denúncia</Link>
					<Link to="/minhas-denuncias">Minhas denúncias</Link>
					<Link className="active" to="/perfil">Perfil</Link>
				</nav>
			</header>

			<section className="profile-content" aria-labelledby="profile-title">
				<div className="profile-heading">
					<p className="complaint-kicker">SUA CONTA</p>
					<h2 id="profile-title">Meu perfil</h2>
				</div>

				<div className="profile-panel">
					<dl className="profile-fields">
						<div className="profile-field">
							<dt>Nome</dt>
							<dd>{profile.name || 'Não informado'}</dd>
						</div>
						<div className="profile-field">
							<dt>E-mail</dt>
							<dd>{profile.email || 'Não informado'}</dd>
						</div>
						<div className="profile-field">
							<dt>Telefone</dt>
							<dd>{profile.phone || 'Não informado'}</dd>
						</div>
						<div className="profile-field">
							<dt>Data de cadastro</dt>
							<dd>{formatRegistrationDate(profile.registeredAt)}</dd>
						</div>
					</dl>

					<div className="profile-actions">
						<button className="primary-action" type="button" disabled>
							Editar perfil
						</button>
						<button className="secondary-action" type="button" onClick={handleLogout}>
							Sair
						</button>
					</div>
				</div>
			</section>
		</main>
	)
}

export default ProfilePage
