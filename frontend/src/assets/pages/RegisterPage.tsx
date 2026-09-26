import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

function RegisterPage() {
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [mensagem, setMensagem] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!nome || !email || !senha || !confirmarSenha) {
      setMensagem('Preencha todos os campos para continuar.')
      return
    }

    if (senha !== confirmarSenha) {
      setMensagem('As senhas não são iguais.')
      return
    }

    // TODO: enviar nome, e-mail e senha para POST /auth/register.
    // HACK: redirecionamento temporário enquanto a API não está conectada.
    setMensagem('Cadastro realizado! Redirecionando para o login...')
    window.setTimeout(() => navigate('/login'), 900)
  }

  return (
    <main className="login-page">
      <div className="login-shell">
        <aside className="login-story" aria-label="Sobre o CidUp">
          <div className="login-story-topline">
            <span className="brand-mark" aria-hidden="true">C</span>
            <span>CidUp</span>
          </div>

          <div className="login-story-content">
            <p className="eyebrow">FAÇA PARTE DA MUDANÇA</p>
            <h1>Uma cidade melhor começa com <strong>participação.</strong></h1>
            <p className="story-copy">
              Crie sua conta para registrar problemas urbanos e acompanhar as
              soluções junto à sua comunidade.
            </p>
          </div>

          <div className="login-story-footer">
            <span className="story-dot" aria-hidden="true" />
            <span>Participação cidadã que transforma</span>
          </div>
        </aside>

        <section className="login-panel" aria-labelledby="register-title">
          <div className="mobile-brand" aria-label="CidUp">
            <span className="brand-mark" aria-hidden="true">C</span>
            <span>CidUp</span>
          </div>

          <div className="login-panel-header">
            <p className="panel-kicker">COMECE AGORA</p>
            <h2 id="register-title">Crie sua conta</h2>
            <p>Cadastre-se para ajudar a transformar a sua cidade.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="nome">Nome completo</label>
              <div className="input-wrap">
                <span className="input-icon" aria-hidden="true">C</span>
                <input
                  id="nome"
                  type="text"
                  placeholder="Como podemos chamar você?"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  autoComplete="name"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="cadastro-email">E-mail</label>
              <div className="input-wrap">
                <span className="input-icon" aria-hidden="true">@</span>
                <input
                  id="cadastro-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="cadastro-senha">Senha</label>
              <div className="input-wrap">
                <span className="input-icon" aria-hidden="true">*</span>
                <input
                  id="cadastro-senha"
                  type="password"
                  placeholder="Crie uma senha segura"
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirmar-senha">Confirmar senha</label>
              <div className="input-wrap">
                <span className="input-icon" aria-hidden="true">*</span>
                <input
                  id="confirmar-senha"
                  type="password"
                  placeholder="Digite a senha novamente"
                  value={confirmarSenha}
                  onChange={(event) => setConfirmarSenha(event.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <label className="remember-option">
              <input type="checkbox" required />
              <span>Concordo com os termos de uso do CidUp.</span>
            </label>

            <button type="submit" className="login-button">
              Criar minha conta
              <span aria-hidden="true">→</span>
            </button>

            {mensagem && (
              <p className="form-message" role="status">
                {mensagem}
              </p>
            )}
          </form>

          <div className="register-link">
            <span>Já possui uma conta?</span>
            <Link to="/login">Entrar</Link>
          </div>
        </section>
      </div>
    </main>
  )
}

export default RegisterPage
