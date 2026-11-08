import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BouncingText from '../../components/BouncingText'
import { ApiError, apiRequest, formatRateLimitMessage } from '../../api'

/** Cadastro do cidadão: formata documentos no navegador e persiste a conta pela API. */

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

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

function formatCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11)
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

function formatCep(value: string) {
  const digits = onlyDigits(value).slice(0, 8)
  return digits.replace(/(\d{5})(\d)/, '$1-$2')
}

function formatPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11)
  if (digits.length <= 2) return digits ? `(${digits}` : ''
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function isValidCpf(value: string) {
  const cpf = onlyDigits(value)
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false
  let sum = 0
  for (let index = 0; index < 9; index += 1) sum += Number(cpf[index]) * (10 - index)
  let digit = (sum * 10) % 11
  if (digit === 10) digit = 0
  if (digit !== Number(cpf[9])) return false
  sum = 0
  for (let index = 0; index < 10; index += 1) sum += Number(cpf[index]) * (11 - index)
  digit = (sum * 10) % 11
  if (digit === 10) digit = 0
  return digit === Number(cpf[10])
}

// ===== TELA DE CADASTRO =====
// O QUE FAZ: cria a conta do cidadão (valida CPF, CEP e senha).
// QUEM USA: App.tsx, rota /cadastro; LoginPage.tsx linka para cá.
// CHAMA: POST /api/auth/register (via apiRequest em api.ts).
// PRÓXIMA TELA: /login (LoginPage), após 900 ms.
function RegisterPage() {
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cpf, setCpf] = useState('')
  const [cep, setCep] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Evita cadastros duplicados por cliques repetidos
  // antes de o botão ser desabilitado na tela.
  const submittingRef = useRef(false)

  // O QUE FAZ: valida os dados, cria a conta e vai para o login.
  // CHAMA: POST /api/auth/register (backend/src/index.ts).
  // 1) Valida no navegador  2) Chama a API  3) Navega para /login.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current) return

    if (!nome || !email || !telefone || !cpf || !cep || !senha || !confirmarSenha) {
      setMensagem('Preencha todos os campos para continuar.')
      return
    }

    if (!isValidCpf(cpf)) {
      setMensagem('CPF inválido. Confira os números digitados.')
      return
    }

    if (onlyDigits(cep).length !== 8) {
      setMensagem('CEP inválido. Informe 8 números no formato 00000-000.')
      return
    }

    if (senha !== confirmarSenha) {
      setMensagem('As senhas não são iguais.')
      return
    }

    submittingRef.current = true
    setIsSubmitting(true)
    try {
      // Cria a conta no backend; com sucesso, a tela segue para /login.
      await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: nome, email, phone: telefone, cpf, cep, password: senha }),
      })
      localStorage.setItem('cidup-profile', JSON.stringify({
        name: nome.trim(),
        email: email.trim(),
        phone: telefone.trim(),
        cpf: cpf.replace(/\D/g, ''),
        cep: cep.replace(/\D/g, ''),
        registeredAt: new Date().toISOString(),
      }))
      setMensagem('Cadastro realizado! Redirecionando para o login...')
      window.setTimeout(() => navigate('/login'), 900)
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) setMensagem(formatRateLimitMessage(error))
      else setMensagem(error instanceof Error ? error.message : 'Não foi possível criar o cadastro.')
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
            <img className="auth-logo" src={`${import.meta.env.BASE_URL}cidup-logo.png`} alt="CidUp" />
          </div>

          <div className="login-panel-header">
            <p className="panel-kicker">COMECE AGORA</p>
            <h2 id="register-title">Crie sua conta</h2>
            <p>Cadastre-se para ajudar a transformar a sua cidade.</p>
          </div>

          {/* Formulário que reúne os dados validados antes do POST /api/auth/register. */}
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
              <label htmlFor="cadastro-telefone">Telefone</label>
              <div className="input-wrap">
                <span className="input-icon" aria-hidden="true">☎</span>
                <input
                  id="cadastro-telefone"
                  type="tel"
                  placeholder="(00) 00000-0000"
                  value={telefone}
                  onChange={(event) => setTelefone(formatPhone(event.target.value))}
                  autoComplete="tel"
                />
              </div>
            </div>

            <div className="complaint-grid complaint-grid-small">
              <div className="form-group">
                <label htmlFor="cadastro-cpf">CPF</label>
                <div className="input-wrap">
                  <span className="input-icon" aria-hidden="true">#</span>
                  <input id="cadastro-cpf" type="text" inputMode="numeric" placeholder="000.000.000-00" value={cpf} onChange={(event) => setCpf(formatCpf(event.target.value))} autoComplete="off" maxLength={14} />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="cadastro-cep">CEP</label>
                <div className="input-wrap">
                  <span className="input-icon" aria-hidden="true">⌖</span>
                  <input id="cadastro-cep" type="text" inputMode="numeric" placeholder="00000-000" value={cep} onChange={(event) => setCep(formatCep(event.target.value))} autoComplete="postal-code" maxLength={9} />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="cadastro-senha">Senha</label>
              <div className="input-wrap">
                <span className="input-icon" aria-hidden="true">*</span>
                <input
                  id="cadastro-senha"
                  type={isPasswordVisible ? 'text' : 'password'}
                  placeholder="Crie uma senha segura"
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  autoComplete="new-password"
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

            <div className="form-group">
              <label htmlFor="confirmar-senha">Confirmar senha</label>
              <div className="input-wrap">
                <span className="input-icon" aria-hidden="true">*</span>
                <input
                  id="confirmar-senha"
                  type={isConfirmPasswordVisible ? 'text' : 'password'}
                  placeholder="Digite a senha novamente"
                  value={confirmarSenha}
                  onChange={(event) => setConfirmarSenha(event.target.value)}
                  autoComplete="new-password"
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setIsConfirmPasswordVisible((visible) => !visible)}
                  aria-label={isConfirmPasswordVisible ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  <PasswordVisibilityIcon visible={isConfirmPasswordVisible} />
                </button>
              </div>
            </div>

            <label className="remember-option">
              <input type="checkbox" required />
              <span>Concordo com os termos de uso do CidUp.</span>
            </label>

            <button type="submit" className="login-button" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting ? <BouncingText>Criando conta...</BouncingText> : <>Criar minha conta<span aria-hidden="true">→</span></>}
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
