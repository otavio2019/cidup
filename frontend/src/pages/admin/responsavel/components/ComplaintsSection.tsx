import type { FormEvent } from 'react'
import type { AdminComplaint, ComplaintStatus, Organization } from '../types'
import { ALL_PERIODS, monthLabel, priorityLabels, statusOptions } from '../utils'
import { Info, PriorityBadge, StatusBadge } from './PanelPrimitives'

// ===== RESPONSÁVEL: LISTA E DETALHES DAS DENÚNCIAS =====
// QUEM USA: ResponsiblePanelPage.tsx. API: /api/complaints, /api/historicos e /api/orgaos.

type ComplaintsSectionProps = {
  selectedComplaint?: AdminComplaint
  visibleComplaints: AdminComplaint[]
  visibleComplaintGroups: AdminComplaint[][]
  organizations: Organization[]
  status: ComplaintStatus
  statusFilter: string
  query: string
  period: string
  periodOptions: string[]
  sector: string
  observation: string
  savedUpdate: boolean
  onSelectComplaint: (complaint: AdminComplaint) => void
  onBack: () => void
  onStatusChange: (status: ComplaintStatus) => void
  onStatusFilterChange: (status: string) => void
  onQueryChange: (query: string) => void
  onPeriodChange: (period: string) => void
  onSectorChange: (sector: string) => void
  onObservationChange: (observation: string) => void
  onSave: (event: FormEvent<HTMLFormElement>) => void
  onExport: () => void
}

// Exibe a lista filtrada de denúncias ou os detalhes da selecionada.
export function ComplaintsSection({
  selectedComplaint,
  visibleComplaints,
  visibleComplaintGroups,
  organizations,
  status,
  statusFilter,
  query,
  period,
  periodOptions,
  sector,
  observation,
  savedUpdate,
  onSelectComplaint,
  onBack,
  onStatusChange,
  onStatusFilterChange,
  onQueryChange,
  onPeriodChange,
  onSectorChange,
  onObservationChange,
  onSave,
  onExport,
}: ComplaintsSectionProps) {
  if (selectedComplaint) {
    return (
      <div className="rp-complaint-detail-view">
        <button className="rp-back-link" type="button" onClick={onBack}>← Voltar para denúncias</button>
        <div className="rp-detail-heading">
          <div><h1>{selectedComplaint.title}</h1><p>{selectedComplaint.protocol} · recebido em {selectedComplaint.date}</p></div>
          <StatusBadge status={selectedComplaint.status} />
        </div>
        <div className="rp-detail-grid">
          <section className="rp-panel rp-information-panel">
            <div className="rp-information-heading">
              <h2>Informações da denúncia</h2>
              <button
                className="rp-outline-button rp-complaint-pdf-button"
                type="button"
                onClick={() => window.print()}
              >
                Imprimir protocolo / Salvar em PDF
              </button>
            </div>
            <Info label="Descrição" value={selectedComplaint.description} />
            <Info label="Endereço" value={selectedComplaint.address} />
            <Info label="Cidadão" value={selectedComplaint.citizen} />
            <Info label="E-mail" value={selectedComplaint.email} />
            <Info label="Telefone" value={selectedComplaint.phone} />
            <Info label="CPF" value={selectedComplaint.cpf} />
            <Info label="Categorias" value={selectedComplaint.categories.join(', ')} />
            {selectedComplaint.priority && <Info label="Prioridade sugerida pela IA" value={priorityLabels[selectedComplaint.priority]} />}
            {selectedComplaint.photo && <div className="rp-photo-field"><strong>Foto anexada</strong><img src={selectedComplaint.photo} alt="Foto anexada pelo cidadão à denúncia" /></div>}
          </section>
          <form className="rp-panel rp-update-panel" onSubmit={onSave}>
            <h2>Atualizar atendimento</h2>
            <label>Status atual<select name="status" value={status} onChange={(event) => onStatusChange(event.target.value as ComplaintStatus)}>{statusOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
            <label>Setor responsável<select value={sector} onChange={(event) => onSectorChange(event.target.value)}><option value="">Não encaminhada</option>{organizations.map((organization) => <option key={organization.id_orgao} value={organization.nome}>{organization.nome}</option>)}</select></label>
            <label>Observação<textarea value={observation} onChange={(event) => onObservationChange(event.target.value)} placeholder="Inclua uma atualização para o cidadão acompanhar." rows={3} /></label>
            {savedUpdate && <p className="rp-success-message" role="status">Atualização salva com sucesso.</p>}
            <button className="rp-primary-button" type="submit">Salvar atualização</button>
          </form>
        </div>
        <section className="rp-panel rp-history-panel" aria-labelledby="responsible-history-title">
          <h2 id="responsible-history-title">Observações e histórico</h2>
          {selectedComplaint.history.length === 0 ? (
            <p className="rp-empty-state">Nenhuma observação registrada para esta denúncia.</p>
          ) : (
            <div className="rp-history-list">
              {selectedComplaint.history.map((item) => (
                <article className="rp-history-item" key={item.id}>
                  <strong>{item.description}</strong>
                  <p>{item.observation}</p>
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="rp-protocol-print" aria-label="Protocolo para impressão">
          <h1>CidUp — Comprovante de denúncia</h1>
          <p className="rp-protocol-print-number"><strong>Protocolo:</strong> {selectedComplaint.protocol}</p>
          <div className="rp-protocol-print-fields">
            <div className="rp-protocol-print-field"><strong>Data do registro</strong><span>{selectedComplaint.date || 'Não informado'}</span></div>
            <div className="rp-protocol-print-field"><strong>Status</strong><span>{selectedComplaint.status || 'Não informado'}</span></div>
            <div className="rp-protocol-print-field"><strong>Ocorrências</strong><span>{selectedComplaint.categories.join(', ') || selectedComplaint.category || 'Não informado'}</span></div>
            <div className="rp-protocol-print-field"><strong>Descrição</strong><span>{selectedComplaint.description || 'Não informado'}</span></div>
            <div className="rp-protocol-print-field"><strong>Endereço</strong><span>{selectedComplaint.address || 'Não informado'}</span></div>
            <div className="rp-protocol-print-field"><strong>Bairro</strong><span>{selectedComplaint.neighborhood || 'Não informado'}</span></div>
            <div className="rp-protocol-print-field"><strong>Ponto de referência</strong><span>Não informado</span></div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <>
      <div className="rp-page-heading rp-heading-with-action">
        <div><h1>Todas as denúncias</h1><p>Gerencie os registros recebidos pela prefeitura.</p></div>
        <button className="rp-outline-button" type="button" onClick={onExport}>↓ Exportar relatório</button>
      </div>
      <section className="rp-filter-bar" aria-label="Filtros de denúncias">
        <label className="rp-search-field">
          <span>Buscar por protocolo, CPF, nome, e-mail ou telefone</span>
          <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Digite para buscar..." />
        </label>
        <label>Status<select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}><option>Todos</option>{statusOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
        <label>Período<select value={period} onChange={(event) => onPeriodChange(event.target.value)}><option value={ALL_PERIODS}>Todos os períodos</option>{periodOptions.map((key) => <option key={key} value={key}>{monthLabel(key)}</option>)}</select></label>
      </section>
      <section className="rp-panel rp-table-panel">
        <div className="rp-table-scroll">
          <table className="rp-table">
            <thead><tr><th>Protocolo</th><th>Descrição</th><th>Bairro</th><th>Data</th><th>Status</th><th>Ação</th></tr></thead>
            <tbody>
              {visibleComplaintGroups.map((group) => {
                const complaint = group[0]!
                const statuses = new Set(group.map((item) => item.status))
                return (
                  <tr key={complaint.protocol} className={group.length > 1 ? 'rp-group-row' : undefined}>
                    <td className="rp-protocol" data-label="Protocolo">
                      <strong>{group.length > 1 ? `${group.length} denúncias agrupadas` : complaint.protocol}</strong>
                      {group.length > 1 && <details className="rp-group-details">
                        <summary>Ver protocolos</summary>
                        <div>{group.map((item) => <button className="rp-group-protocol" type="button" key={item.protocol} onClick={() => onSelectComplaint(item)}>{item.protocol}</button>)}</div>
                      </details>}
                    </td>
                    <td data-label="Descrição"><strong>{complaint.title}</strong><PriorityBadge priority={complaint.priority} /><small>{complaint.categories.join(', ')}</small>{group.length > 1 && <small className="rp-group-note">Mesma categoria e até 50 m de distância</small>}</td>
                    <td data-label="Bairro">{complaint.neighborhood || '—'}</td>
                    <td data-label="Data">{complaint.date}</td>
                    <td data-label="Status">{statuses.size === 1 ? <StatusBadge status={complaint.status} /> : <span className="rp-status rp-status-mixed">Vários status</span>}</td>
                    <td className="rp-table-action"><button className="rp-text-button" type="button" onClick={() => onSelectComplaint(complaint)}>Ver detalhes <span aria-hidden="true">→</span></button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {visibleComplaints.length === 0 && <p className="rp-empty-state">Nenhuma denúncia encontrada com esses filtros.</p>}
        <div className="rp-table-footer"><span>{visibleComplaintGroups.length} grupos / {visibleComplaints.length} denúncias</span></div>
      </section>
    </>
  )
}
