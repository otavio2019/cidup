import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../../api'

export default function ForgotPasswordPage() {
  const [cpf, setCpf] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const result = await apiRequest<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ cpf: cpf.replace(/\D/g, '') }),
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
          <div className="login-story-content"><p className="eyebrow">ACESSO SEGURO</p><h1>Recupere o acesso<br /><strong>à sua conta.</strong></h1><p className="story-copy">Solicite uma senha temporária ao responsável pelo sistema.</p></div>
          <div className="login-story-footer"><span className="story-dot" aria-hidden="true" /><span>Participação cidadã que transforma</span></div>
        </aside>
        <section className="login-panel" aria-labelledby="forgot-title">
          <div className="mobile-brand"><img className="auth-logo" src={`${import.meta.env.BASE_URL}cidup-logo.png`} alt="CidUp" /></div>
          <div className="login-panel-header"><p className="panel-kicker">RECUPERAÇÃO DE SENHA</p><h2 id="forgot-title">Esqueci minha senha</h2><p>Informe seu CPF para solicitar ajuda ao responsável. Você receberá uma senha temporária após a análise.</p></div>
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group"><label htmlFor="recovery-cpf">CPF</label><div className="input-wrap"><span className="input-icon" aria-hidden="true">#</span><input id="recovery-cpf" type="text" inputMode="numeric" required minLength={11} maxLength={14} placeholder="000.000.000-00" value={cpf} onChange={(event) => setCpf(event.target.value)} autoComplete="off" /></div></div>
            <button type="submit" className="login-button" disabled={loading}>{loading ? 'Enviando solicitação...' : 'Solicitar recuperação'}{!loading && <span aria-hidden="true">→</span>}</button>
            {message && <p className="form-message" role="status">{message}</p>}
            {error && <p className="form-message" role="alert">{error}</p>}
          </form>
          <div className="register-link"><Link className="register-cta" to="/login">Voltar para o login</Link></div>
        </section>
      </div>
    </main>
  )
}
