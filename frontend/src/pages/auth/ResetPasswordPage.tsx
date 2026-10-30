import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../../api'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setError('')
    if (password !== confirmation) {
      setError('As senhas não são iguais.')
      return
    }
    setLoading(true)
    try {
      const result = await apiRequest<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      })
      setMessage(result.message)
      setPassword('')
      setConfirmation('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível atualizar a senha.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page"><div className="login-shell">
      <aside className="login-story" aria-label="Sobre o CidUp"><div className="login-story-topline"><img className="auth-logo" src={`${import.meta.env.BASE_URL}cidup-logo.png`} alt="CidUp" /></div><div className="login-story-content"><p className="eyebrow">ACESSO SEGURO</p><h1>Crie uma senha<br /><strong>nova e segura.</strong></h1><p className="story-copy">Use pelo menos seis caracteres e não compartilhe sua senha.</p></div><div className="login-story-footer"><span className="story-dot" aria-hidden="true" /><span>Participação cidadã que transforma</span></div></aside>
      <section className="login-panel" aria-labelledby="reset-title"><div className="mobile-brand"><img className="auth-logo" src={`${import.meta.env.BASE_URL}cidup-logo.png`} alt="CidUp" /></div><div className="login-panel-header"><p className="panel-kicker">NOVA SENHA</p><h2 id="reset-title">Redefinir senha</h2><p>Escolha uma nova senha para acessar sua conta.</p></div>
        {!token && <p className="form-message" role="alert">O link de recuperação está incompleto. Solicite um novo link.</p>}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group"><label htmlFor="new-password">Nova senha</label><div className="input-wrap"><span className="input-icon" aria-hidden="true">*</span><input id="new-password" type="password" required minLength={6} maxLength={1024} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></div></div>
          <div className="form-group"><label htmlFor="confirm-password">Confirmar nova senha</label><div className="input-wrap"><span className="input-icon" aria-hidden="true">*</span><input id="confirm-password" type="password" required minLength={6} maxLength={1024} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" /></div></div>
          <button type="submit" className="login-button" disabled={loading || !token}>{loading ? 'Salvando...' : 'Salvar nova senha'}{!loading && <span aria-hidden="true">→</span>}</button>
          {message && <p className="form-message" role="status">{message} <Link to="/login">Entrar</Link></p>}
          {error && <p className="form-message" role="alert">{error}</p>}
        </form>
        <div className="register-link"><Link className="register-cta" to="/login">Voltar para o login</Link></div>
      </section>
    </div></main>
  )
}
