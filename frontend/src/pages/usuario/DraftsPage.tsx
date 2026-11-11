import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import CitizenMobileNav from '../../components/usuario/CitizenMobileNav'
import CitizenHeader from '../../components/usuario/CitizenHeader'
import { clearActiveDraft, deleteDraft, listDrafts, resumeDraft } from '../../drafts'
import '../../App.css'

// ===== PÁGINA DE RASCUNHOS =====
// O QUE FAZ: lista rascunhos salvos no navegador; continuar ou excluir cada um.
// QUEM USA: App.tsx, rota /rascunhos (ProtectedRoute).
//   Links: DashboardPage.tsx (menu lateral "Rascunhos") e CitizenHeader/CitizenMobileNav.
// CHAMA: drafts.ts (listDrafts, resumeDraft, deleteDraft). Não usa API, só storage local.
// NAVEGA PARA: /registrar-denuncia (CreateComplaintPage.tsx).
function DraftsPage() {
  const navigate = useNavigate()
  // Lê os rascunhos uma vez; depois atualiza manualmente com listDrafts().
  const [drafts, setDrafts] = useState(() => listDrafts())

  // O QUE FAZ: carrega o rascunho como "ativo" e abre o formulário de denúncia.
  // CHAMA: resumeDraft() em drafts.ts. Se o rascunho sumiu (false), só recarrega a lista.
  function continueDraft(id: string) {
    if (resumeDraft(id)) navigate('/registrar-denuncia')
    else setDrafts(listDrafts())
  }

  // O QUE FAZ: exclui um rascunho após confirmação.
  // CHAMA: deleteDraft() em drafts.ts.
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
          {/* "Nova denúncia": limpa o rascunho ativo para abrir o formulário em branco. */}
          <Link className="primary-action" to="/registrar-denuncia" onClick={clearActiveDraft}>
            Nova denúncia
          </Link>
        </div>

        {/* Lista vazia ou cartões de rascunho (Continuar / Excluir). */}
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
