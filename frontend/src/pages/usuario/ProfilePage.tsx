import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../../api'
import CitizenMobileNav from '../../components/usuario/CitizenMobileNav'
import CitizenHeader from '../../components/usuario/CitizenHeader'
import '../../App.css'

/** Perfil do cidadão: fonte remota na API, com cache visual local e logout seguro. */
type CitizenProfile = {
  id?: number
  name?: string
  email?: string
  phone?: string
  cpf?: string | null
  cep?: string | null
  photo?: string | null
  registeredAt?: string
}

function readProfile(): CitizenProfile {
  try {
    const storedProfile = localStorage.getItem('cidup-profile')
    if (!storedProfile) return {}
    const profile: unknown = JSON.parse(storedProfile)
    return profile && typeof profile === 'object' ? profile as CitizenProfile : {}
  } catch {
    return {}
  }
}

function formatRegistrationDate(value?: string) {
  if (!value) return 'Não informada'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Não informada' : new Intl.DateTimeFormat('pt-BR').format(date)
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

function formatInputCpf(value: string) {
  return onlyDigits(value).slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

function formatInputCep(value: string) {
  return onlyDigits(value).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2')
}

function formatInputPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11)
  if (digits.length <= 2) return digits ? `(${digits}` : ''
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function formatCpf(value?: string | null) {
  const digits = onlyDigits(value ?? '')
  return digits.length === 11 ? digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : value || 'Não informado'
}

function formatCep(value?: string | null) {
  const digits = onlyDigits(value ?? '')
  return digits.length === 8 ? digits.replace(/(\d{5})(\d{3})/, '$1-$2') : value || 'Não informado'
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Não foi possível ler a foto.'))
    reader.readAsDataURL(file)
  })
}

function ProfilePage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<CitizenProfile>(() => readProfile())
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(profile.name ?? '')
  const [phone, setPhone] = useState(formatInputPhone(profile.phone ?? ''))
  const [cpf, setCpf] = useState(formatInputCpf(profile.cpf ?? ''))
  const [cep, setCep] = useState(formatInputCep(profile.cep ?? ''))
  const [photo, setPhoto] = useState(profile.photo ?? null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [logoutError, setLogoutError] = useState('')

  // Sincroniza o cache local com a sessão autenticada consultada em /api/auth/session.
  useEffect(() => {
    apiRequest<{ user: CitizenProfile }>('/api/auth/session')
      .then(({ user }) => {
        const next = { ...readProfile(), ...user }
        setProfile(next)
        setName(next.name ?? '')
        setPhone(formatInputPhone(next.phone ?? ''))
        setCpf(formatInputCpf(next.cpf ?? ''))
        setCep(formatInputCep(next.cep ?? ''))
        setPhoto(next.photo ?? null)
        localStorage.setItem('cidup-profile', JSON.stringify(next))
      })
      .catch(() => undefined)
  }, [])

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.match(/^image\/(png|jpeg|webp)$/) || file.size > 2 * 1024 * 1024) {
      setError('Escolha uma imagem PNG, JPG ou WEBP de até 2 MB.')
      return
    }
    setError('')
    setPhoto(await readFileAsDataUrl(file))
  }

  // Atualiza os dados editáveis do cidadão em PATCH /api/users/:id e mantém o cache local alinhado.
  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSaved(false)
    if (!profile.id) {
      setError('Não foi possível identificar seu usuário. Entre novamente.')
      return
    }
    try {
      const data = await apiRequest<{ user: CitizenProfile }>(`/api/users/${profile.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), cpf: onlyDigits(cpf), cep: onlyDigits(cep), photo }),
      })
      const next = { ...profile, ...data.user }
      setProfile(next)
      localStorage.setItem('cidup-profile', JSON.stringify(next))
      setIsEditing(false)
      setSaved(true)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o perfil.')
    }
  }

  // Encerra a sessão no backend e retorna à página de login após limpar os dados locais.
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
    sessionStorage.removeItem('cidup-active-draft-id')
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
          {/* Alterna entre edição e consulta dos dados sincronizados com a conta do cidadão. */}
          <div className="profile-avatar-block">
            {profile.photo ? <img className="profile-avatar" src={profile.photo} alt={`Foto de perfil de ${profile.name ?? 'usuário'}`} /> : <div className="profile-avatar profile-avatar-placeholder" aria-hidden="true">{(profile.name ?? 'C').slice(0, 1).toUpperCase()}</div>}
            {isEditing && <label className="secondary-action profile-photo-button" htmlFor="profile-photo">Escolher foto<input id="profile-photo" type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoChange} /></label>}
          </div>

          {isEditing ? (
            <form className="profile-edit-form" onSubmit={handleSave}>
              <label>Nome<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
            <label>Telefone<input value={phone} onChange={(event) => setPhone(formatInputPhone(event.target.value))} inputMode="tel" maxLength={15} required /></label>
            <label>CPF<input value={cpf} onChange={(event) => setCpf(formatInputCpf(event.target.value))} inputMode="numeric" maxLength={14} required /></label>
            <label>CEP<input value={cep} onChange={(event) => setCep(formatInputCep(event.target.value))} inputMode="numeric" maxLength={9} required /></label>
              {error && <p className="form-message" role="alert">{error}</p>}
              <div className="profile-actions"><button className="primary-action" type="submit">Salvar alterações</button><button className="secondary-action" type="button" onClick={() => setIsEditing(false)}>Cancelar</button></div>
            </form>
          ) : (
            <>
              <dl className="profile-fields">
                <div className="profile-field"><dt>Nome</dt><dd>{profile.name || 'Não informado'}</dd></div>
                <div className="profile-field"><dt>E-mail</dt><dd>{profile.email || 'Não informado'}</dd></div>
                <div className="profile-field"><dt>Telefone</dt><dd>{profile.phone || 'Não informado'}</dd></div>
                <div className="profile-field"><dt>CPF</dt><dd>{formatCpf(profile.cpf)}</dd></div>
                <div className="profile-field"><dt>CEP</dt><dd>{formatCep(profile.cep)}</dd></div>
                <div className="profile-field"><dt>Data de cadastro</dt><dd>{formatRegistrationDate(profile.registeredAt)}</dd></div>
              </dl>
              <div className="profile-actions"><button className="primary-action" type="button" onClick={() => setIsEditing(true)}>Editar perfil</button><button className="secondary-action" type="button" onClick={handleLogout}>Sair</button></div>
            </>
          )}
          {saved && <p className="form-message" role="status">Perfil atualizado com sucesso.</p>}
          {logoutError && <p className="form-message" role="alert">{logoutError}</p>}
        </div>
      </section>
      <CitizenMobileNav />
    </main>
  )
}

export default ProfilePage
