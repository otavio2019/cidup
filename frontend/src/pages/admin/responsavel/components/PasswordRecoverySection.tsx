import type { FormEvent } from 'react'
import type { PasswordRecoveryRequest } from '../types'

// ===== RESPONSÁVEL: RECUPERAÇÃO DE SENHA =====
// QUEM USA: ResponsiblePanelPage.tsx. API: /api/admin/password-recovery-requests.

type PasswordRecoverySectionProps = {
  requests: PasswordRecoveryRequest[]
  temporaryPasswords: Record<number, string>
  message: string
  onPasswordChange: (requestId: number, password: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>, requestId: number) => void
}

// Lista pedidos de recuperação e recebe a senha temporária definida pelo responsável.
export function PasswordRecoverySection({
  requests,
  temporaryPasswords,
  message,
  onPasswordChange,
  onSubmit,
}: PasswordRecoverySectionProps) {
  return (
    <>
      <div className="rp-page-heading"><div><h1>Recuperação de senha</h1><p>Analise solicitações e defina uma senha temporária para o cidadão.</p></div></div>
      {message && <p className="rp-success-message" role="status">{message}</p>}
      <section className="rp-panel rp-recovery-list" aria-label="Solicitações de recuperação pendentes">
        {requests.length === 0 && <p className="rp-empty-state">Nenhuma solicitação pendente.</p>}
        {requests.map((item) => (
          <article className="rp-recovery-request" key={item.id}>
            <div className="rp-recovery-citizen">
              <h2>{item.citizen}</h2>
              <p>{item.email} · {item.phone ?? 'Telefone não informado'} · CPF {item.cpf ?? 'não informado'}</p>
              <small>Solicitada em {new Date(item.requestedAt).toLocaleString('pt-BR')}</small>
            </div>
            <form className="rp-recovery-form" onSubmit={(event) => onSubmit(event, item.id)}>
              <label htmlFor={`temporary-password-${item.id}`}>Senha temporária</label>
              <input
                id={`temporary-password-${item.id}`}
                type="text"
                autoComplete="off"
                minLength={8}
                maxLength={1024}
                required
                value={temporaryPasswords[item.id] ?? ''}
                onChange={(event) => onPasswordChange(item.id, event.target.value)}
              />
              <button className="rp-primary-button" type="submit">Definir senha</button>
            </form>
          </article>
        ))}
      </section>
    </>
  )
}
