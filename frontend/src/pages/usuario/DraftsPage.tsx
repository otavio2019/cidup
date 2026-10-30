import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import CitizenMobileNav from '../../components/usuario/CitizenMobileNav'
import CitizenHeader from '../../components/usuario/CitizenHeader'
import { deleteDraft, listDrafts, resumeDraft } from '../../drafts'
import '../../App.css'

/** Lista os rascunhos salvos no navegador; permite continuar ou excluir cada um. */
function DraftsPage() {
  const navigate = useNavigate()
  const [drafts, setDrafts] = useState(() => listDrafts())

  function continueDraft(id: string) {
    if (resumeDraft(id)) navigate('/registrar-denuncia')
    else setDrafts(listDrafts())
  }

  function removeDraft(id: string) {
    if (!window.confirm('Excluir este rascunho?')) return
    deleteDraft(id)
    setDrafts(listDrafts())
  }

  return (
    <main className="my-complaints-page">
      <CitizenHeader active="drafts" />
      <section className="complaints-page-content" aria-labelledby="drafts-title">
        <div className="my-complaints-heading">
          <div>
            <p className="complaint-kicker">RASCUNHOS</p>
            <h2 id="drafts-title">Meus rascunhos</h2>
            <p>Denúncias que você começou e ainda não enviou. Ficam salvas neste navegador.</p>
          </div>
          <Link className="primary-action" to="/registrar-denuncia" onClick={() => { sessionStorage.removeItem('cidup-complaint-draft'); sessionStorage.removeItem('cidup-active-draft-id') }}>
            Nova denúncia
          </Link>
        </div>

        {drafts.length === 0 ? (
          <div className="complaints-empty-state">
            <span aria-hidden="true">✎</span>
            <h3>Nenhum rascunho salvo</h3>
            <p>Use “Salvar rascunho” ao registrar uma denúncia para continuar depois.</p>
          </div>
        ) : (
          <div className="my-complaints-list">
            {drafts.map((draft) => {
              const { type, description, address, number, categories } = draft.data as Record<string, string | string[] | undefined>
              const categoryLabels = Array.isArray(categories) && categories.length ? categories.join(', ') : type
              return (
                <article className="my-complaint-item" key={draft.id}>
                  <div className="my-complaint-main">
                    <h3>{categoryLabels || 'Tipo não informado'}</h3>
                    <p className="my-complaint-description">{description || 'Sem descrição.'}</p>
                    <p className="my-complaint-address">
                      <span aria-hidden="true">⌖</span>
                      {[address, number].filter(Boolean).join(', ') || 'Endereço não informado'}
                    </p>
                    <p className="my-complaint-date">
                      Última edição {formatDistanceToNow(new Date(draft.updatedAt), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  <div className="my-complaint-actions">
                    <button className="primary-action" type="button" onClick={() => continueDraft(draft.id)}>Continuar</button>
                    <button className="secondary-action" type="button" onClick={() => removeDraft(draft.id)}>Excluir</button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
      <CitizenMobileNav />
    </main>
  )
}

export default DraftsPage
