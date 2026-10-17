import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRequest } from '../../api'

// Apresenta o formulário de acesso e mantém o estado dos campos e mensagens.
function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)

  // Valida os campos, autentica o cidadão e redireciona conforme o perfil retornado.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!email || !senha) {
      setMensagem('Preencha o e-mail e a senha para continuar.')
      return
    }

    try {
      const data = await apiRequest<{
        user: {
          id: number
          name: string
          email: string
          phone: string
          role: 'CITIZEN' | 'RESPONSIBLE'
        }
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: senha }),
      })
      localStorage.removeItem('cidup-complaints')
      localStorage.setItem('cidup-profile', JSON.stringify(data.user))
      navigate(data.user.role === 'RESPONSIBLE' ? '/responsavel/dashboard' : '/dashboard')
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Não foi possível entrar.')
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

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">E-mail</label>
              <div className="input-wrap">
                <span className="input-icon" aria-hidden="true">@</span>
                <input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="form-group">
              <div className="label-row">
                <label htmlFor="senha">Senha</label>
                <a className="forgot-link" href="#recuperar-senha">
                  Esqueci minha senha
                </a>
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
                  {isPasswordVisible ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            <label className="remember-option">
              <input type="checkbox" />
              <span>Lembrar-me neste dispositivo</span>
            </label>

            <button type="submit" className="login-button">
              Entrar na conta
              <span aria-hidden="true">→</span>
            </button>

            {mensagem && (
              <p className="form-message" role="status">
                {mensagem}
              </p>
            )}
          </form>

          <div className="register-link">
            <span>Ainda não possui uma conta?</span>
            <Link to="/cadastro">Criar cadastro</Link>
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
