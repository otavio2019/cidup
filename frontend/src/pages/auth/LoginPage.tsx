import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BouncingText from '../../components/BouncingText'
import { ApiError, apiRequest, formatRateLimitMessage } from '../../api'

// Ícone de olho (aberto ou riscado) usado no botão de mostrar/ocultar senha.
function PasswordVisibilityIcon({ visible }: { visible: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {visible && <path d="M4 4l16 16" />}
    </svg>
  )
}

// ===== TELA DE LOGIN =====
// O QUE FAZ: formulário de acesso (e-mail/CPF + senha).
// QUEM USA: App.tsx, rota /login (também é o destino de "*" e "/").
// CHAMA: POST /api/auth/login (via apiRequest em api.ts).
// PRÓXIMA TELA: /trocar-senha-temporaria (ChangeTemporaryPasswordPage),
//   /responsavel/dashboard (RESPONSIBLE) ou /dashboard (cidadão).
// LINKS: /recuperar-senha (ForgotPasswordPage) e /cadastro (RegisterPage).
function LoginPage() {
  const navigate = useNavigate()
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Bloqueia envios repetidos (ex.: Enter duas vezes)
  // antes de o botão ser desabilitado na tela.
  const submittingRef = useRef(false)

  // O QUE FAZ: valida os campos, autentica e redireciona conforme o perfil.
  // CHAMA: POST /api/auth/login (backend/src/index.ts).
  // 1) Valida campos  2) Chama a API  3) Guarda perfil  4) Navega.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current) return

    if (!login.trim() || !senha) {
      setMensagem('Preencha o e-mail ou CPF e a senha para continuar.')
      return
    }

    submittingRef.current = true
    setIsSubmitting(true)
    setMensagem('')
    try {
      const data = await apiRequest<{
        user: {
          id: number
          name: string
          email: string
          phone: string
          role: 'CITIZEN' | 'RESPONSIBLE'
          mustChangePassword?: boolean
        }
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login: login.trim(), password: senha }),
      })
      // Limpa denúncias locais antigas para não mostrar dados de outra conta.
      localStorage.removeItem('cidup-complaints')
      localStorage.setItem('cidup-profile', JSON.stringify(data.user))
      // Senha temporária bloqueia o resto do app até ser trocada (TemporaryPasswordRoute).
      navigate(data.user.mustChangePassword
        ? '/trocar-senha-temporaria'
        : data.user.role === 'RESPONSIBLE' ? '/responsavel/dashboard' : '/dashboard')
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) setMensagem(formatRateLimitMessage(error))
      else setMensagem(error instanceof Error ? error.message : 'Não foi possível entrar.')
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-shell">
        <aside className="login-story" aria-label="Sobre o CidUp">
          <div className="login-story-topline">
            <img className="auth-logo" src={`${import.meta.env.BASE_URL}cidup-logo.png`} alt="CidUp" />
          </div>

          <div className="login-story-content">
            <p className="eyebrow">CUIDAR DA CIDADE COMEÇA COM VOCÊ</p>
            <h1>Pequenas ações.<br /><strong>Grandes mudanças.</strong></h1>
            <p className="story-copy">
              Registre problemas urbanos, acompanhe cada etapa e ajude a
              construir uma cidade melhor para todos.
            </p>
          </div>

          <div className="login-story-footer">
            <span className="story-dot" aria-hidden="true" />
            <span>Participação cidadã que transforma</span>
          </div>
        </aside>

        <section className="login-panel" aria-labelledby="login-title">
          <div className="mobile-brand" aria-label="CidUp">
            <img className="auth-logo" src={`${import.meta.env.BASE_URL}cidup-logo.png`} alt="CidUp" />
          </div>

          <div className="login-panel-header">
            <p className="panel-kicker">BEM-VINDO DE VOLTA</p>
            <h2 id="login-title">Entre na sua conta</h2>
            <p>Acesse o CidUp para registrar e acompanhar suas denúncias.</p>
          </div>

          {/* O envio autentica em POST /api/auth/login e encaminha ao dashboard conforme o papel retornado. */}
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="login">E-mail ou CPF</label>
              <div className="input-wrap">
                <span className="input-icon" aria-hidden="true">@</span>
                <input
                  id="login"
                  type="text"
                  placeholder="E-mail ou CPF"
                  value={login}
                  onChange={(event) => setLogin(event.target.value)}
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="form-group">
              <div className="label-row">
                <label htmlFor="senha">Senha</label>
                <Link className="forgot-link" to="/recuperar-senha">
                  Esqueci minha senha
                </Link>
              </div>
              <div className="input-wrap">
                <span className="input-icon" aria-hidden="true">*</span>
                <input
                  id="senha"
                  type={isPasswordVisible ? 'text' : 'password'}
                  placeholder="Digite sua senha"
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  autoComplete="current-password"
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setIsPasswordVisible((visible) => !visible)}
                  aria-label={isPasswordVisible ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  <PasswordVisibilityIcon visible={isPasswordVisible} />
                </button>
              </div>
            </div>

            <label className="remember-option">
              <input type="checkbox" />
              <span>Lembrar-me neste dispositivo</span>
            </label>

            <button type="submit" className="login-button" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting ? <BouncingText>Entrando...</BouncingText> : 'Entrar na conta'}
              {!isSubmitting && <span aria-hidden="true">→</span>}
            </button>

            {mensagem && (
              <p className="form-message" role="status">
                {mensagem}
              </p>
            )}
          </form>

          <div className="register-link">
            <span>Ainda não possui uma conta?</span>
            <Link className="register-cta" to="/cadastro">Criar cadastro</Link>
          </div>

          <p className="login-privacy">
            Ao continuar, você concorda com os termos de uso do CidUp.
          </p>
        </section>
      </div>
    </main>
  )
}

export default LoginPage
