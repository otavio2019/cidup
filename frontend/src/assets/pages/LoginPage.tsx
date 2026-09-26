import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'

function LoginPage() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mensagem, setMensagem] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!email || !senha) {
      setMensagem('Preencha o e-mail e a senha.')
      return
    }

    // Simulação de login.
    // Depois substituiremos por uma chamada para a API.
    localStorage.setItem('cidup-authenticated', 'true')

    navigate('/dashboard')
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="brand">
          <h1>CidUp</h1>
          <p>Cidades melhores começam com você</p>
        </div>

        <div className="login-header">
          <h2 id="login-title">Entrar na sua conta</h2>
          <p>Acesse o CidUp para registrar e acompanhar denúncias.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">E-mail</label>

            <input
              id="email"
              type="email"
              placeholder="Digite seu e-mail"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="senha">Senha</label>

            <input
              id="senha"
              type="password"
              placeholder="Digite sua senha"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
            />
          </div>

          <button type="submit" className="login-button">
            Entrar
          </button>

          {mensagem && (
            <p className="form-message" role="status">
              {mensagem}
            </p>
          )}
        </form>

        <div className="register-link">
          <span>Ainda não possui uma conta?</span>
          <a href="/cadastro">Criar cadastro</a>
        </div>
      </section>
    </main>
  )
}

export default LoginPage
