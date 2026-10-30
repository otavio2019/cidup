import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRequest } from '../../api'

export default function ChangeTemporaryPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (password !== confirmation) {
      setError('As senhas não são iguais.')
      return
    }

    setLoading(true)
    try {
      await apiRequest('/api/auth/change-temporary-password', {
        method: 'POST',
        body: JSON.stringify({ newPassword: password }),
      })
      navigate('/dashboard', { replace: true })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível atualizar sua senha.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-shell">
        <aside className="login-story" aria-label="Sobre o CidUp">
          <div className="login-story-topline"><img className="auth-logo" src={`${import.meta.env.BASE_URL}cidup-logo.png`} alt="CidUp" /></div>
          <div className="login-story-content"><p className="eyebrow">PRIMEIRO ACESSO</p><h1>Proteja sua<br /><strong>nova senha.</strong></h1><p className="story-copy">Por segurança, a senha temporária precisa ser trocada antes de continuar.</p></div>
          <div className="login-story-footer"><span className="story-dot" aria-hidden="true" /><span>Participação cidadã que transforma</span></div>
        </aside>
        <section className="login-panel" aria-labelledby="temporary-password-title">
          <div className="mobile-brand"><img className="auth-logo" src={`${import.meta.env.BASE_URL}cidup-logo.png`} alt="CidUp" /></div>
          <div className="login-panel-header"><p className="panel-kicker">TROCA OBRIGATÓRIA</p><h2 id="temporary-password-title">Crie sua senha</h2><p>Escolha uma senha definitiva com pelo menos seis caracteres.</p></div>
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group"><label htmlFor="new-password">Nova senha</label><div className="input-wrap"><span className="input-icon" aria-hidden="true">*</span><input id="new-password" type="password" required minLength={6} maxLength={1024} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></div></div>
            <div className="form-group"><label htmlFor="confirm-password">Confirmar nova senha</label><div className="input-wrap"><span className="input-icon" aria-hidden="true">*</span><input id="confirm-password" type="password" required minLength={6} maxLength={1024} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" /></div></div>
            <button type="submit" className="login-button" disabled={loading}>{loading ? 'Salvando...' : 'Salvar senha definitiva'}{!loading && <span aria-hidden="true">→</span>}</button>
            {error && <p className="form-message" role="alert">{error}</p>}
          </form>
          <div className="register-link"><Link className="register-cta" to="/login">Voltar para o login</Link></div>
        </section>
      </div>
    </main>
  )
}
