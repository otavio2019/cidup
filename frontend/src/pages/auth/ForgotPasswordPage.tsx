import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../../api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')
    try {
      const result = await apiRequest<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setMessage(result.message)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível solicitar a recuperação.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-shell">
        <aside className="login-story" aria-label="Sobre o CidUp">
          <div className="login-story-topline"><img className="auth-logo" src={`${import.meta.env.BASE_URL}cidup-logo.png`} alt="CidUp" /></div>
          <div className="login-story-content"><p className="eyebrow">ACESSO SEGURO</p><h1>Recupere o acesso<br /><strong>à sua conta.</strong></h1><p className="story-copy">Vamos enviar instruções para o e-mail cadastrado.</p></div>
          <div className="login-story-footer"><span className="story-dot" aria-hidden="true" /><span>Participação cidadã que transforma</span></div>
        </aside>
        <section className="login-panel" aria-labelledby="forgot-title">
          <div className="mobile-brand"><img className="auth-logo" src={`${import.meta.env.BASE_URL}cidup-logo.png`} alt="CidUp" /></div>
          <div className="login-panel-header"><p className="panel-kicker">RECUPERAÇÃO DE SENHA</p><h2 id="forgot-title">Esqueci minha senha</h2><p>Informe seu e-mail e enviaremos um link seguro para criar uma nova senha.</p></div>
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group"><label htmlFor="recovery-email">E-mail</label><div className="input-wrap"><span className="input-icon" aria-hidden="true">@</span><input id="recovery-email" type="email" required placeholder="seu@email.com" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></div></div>
            <button type="submit" className="login-button" disabled={loading}>{loading ? 'Enviando...' : 'Enviar instruções'}{!loading && <span aria-hidden="true">→</span>}</button>
            {message && <p className="form-message" role="status">{message}</p>}
            {error && <p className="form-message" role="alert">{error}</p>}
          </form>
          <div className="register-link"><Link className="register-cta" to="/login">Voltar para o login</Link></div>
        </section>
      </div>
    </main>
  )
}
