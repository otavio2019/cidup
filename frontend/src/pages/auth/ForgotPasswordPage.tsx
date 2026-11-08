import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import BouncingText from '../../components/BouncingText'
import { apiRequest } from '../../api'

// ===== ESQUECI MINHA SENHA =====
// O QUE FAZ: pede recuperação de senha informando o CPF ou o e-mail.
// QUEM USA: App.tsx, rota /recuperar-senha; LoginPage.tsx linka para cá.
// CHAMA: POST /api/auth/forgot-password (via apiRequest em api.ts).
// DEPOIS: o responsável gera a senha temporária no painel
//   (GET/POST /api/admin/password-recovery-requests).
export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  // Com "@" envia como e-mail (link de redefinição); senão, envia só os dígitos do CPF
  // (pedido ao responsável). Mostra a mensagem neutra devolvida pela API.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = identifier.trim()
    const isEmail = value.includes('@')
    if (!isEmail && value.replace(/\D/g, '').length !== 11) {
      setError('Informe um CPF com 11 dígitos ou um e-mail válido.')
      setMessage('')
      return
    }
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const payload = isEmail ? { email: value.toLowerCase() } : { cpf: value.replace(/\D/g, '') }
      const result = await apiRequest<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify(payload),
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
          <div className="login-panel-header"><p className="panel-kicker">RECUPERAÇÃO DE SENHA</p><h2 id="forgot-title">Esqueci minha senha</h2><p>Informe seu CPF ou e-mail. Pelo e-mail você recebe um link para criar uma nova senha; pelo CPF, o responsável analisa o pedido e envia uma senha temporária.</p></div>
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group"><label htmlFor="recovery-identifier">CPF ou e-mail</label><div className="input-wrap"><span className="input-icon" aria-hidden="true">@</span><input id="recovery-identifier" type="text" required maxLength={255} placeholder="000.000.000-00 ou seu@email.com" value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} /></div></div>
            <button type="submit" className="login-button" disabled={loading} aria-busy={loading}>
              {loading ? <BouncingText>Enviando solicitação...</BouncingText> : <>Solicitar recuperação<span aria-hidden="true">→</span></>}
            </button>
            {message && <p className="form-message" role="status">{message}</p>}
            {error && <p className="form-message" role="alert">{error}</p>}
          </form>
          <div className="register-link"><Link className="register-cta" to="/login">Voltar para o login</Link></div>
        </section>
      </div>
    </main>
  )
}
