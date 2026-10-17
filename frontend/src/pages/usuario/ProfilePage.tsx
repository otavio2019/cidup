import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { apiRequest } from '../../api'
import CitizenMobileNav from '../../components/usuario/CitizenMobileNav'
import CitizenHeader from '../../components/usuario/CitizenHeader'
import '../../App.css'

type CitizenProfile = {
	name?: string
	email?: string
	phone?: string
	registeredAt?: string
}

// Lê o perfil armazenado no navegador e retorna um objeto vazio se os dados não forem válidos.
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

// Formata a data de cadastro em português ou indica que ela não está disponível.
function formatRegistrationDate(value?: string) {
	if (!value) return 'Não informada'
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return 'Não informada'
	return new Intl.DateTimeFormat('pt-BR').format(date)
}

// Exibe os dados do perfil e permite encerrar a sessão autenticada.
function ProfilePage() {
	const navigate = useNavigate()
	const profile = readProfile()
	const [logoutError, setLogoutError] = useState('')

	// Encerra a sessão na API e remove dados locais antes de voltar ao login.
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

	return (
		<main className="profile-page">
			<CitizenHeader active="profile" />
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
					{logoutError && <p className="form-message" role="alert">{logoutError}</p>}
				</div>
			</section>
			<CitizenMobileNav />
		</main>
	)
}

export default ProfilePage
