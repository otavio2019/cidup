// ===== RESPONSÁVEL: CATEGORIAS DE DENÚNCIA =====
// QUEM USA: ResponsiblePanelPage.tsx. DADOS: categorias contadas a partir de /api/complaints.

export function ComplaintTypesSection({ categories }: { categories: Array<[string, number]> }) {
  return (
    <>
      <div className="rp-page-heading"><div><h1>Categorias de denúncia</h1><p>Tipos de ocorrência registrados pelos cidadãos.</p></div></div>
      <section className="rp-panel rp-types-panel" aria-label="Categorias de denúncia">
        {categories.map(([name, count], index) => (
          <div className="rp-type-row" key={name}>
            <span className="rp-type-number">{index + 1}</span>
            <div className="rp-type-copy"><strong>{name}</strong></div>
            <span className="rp-type-count">{count} {count === 1 ? 'denúncia' : 'denúncias'}</span>
          </div>
        ))}
        {categories.length === 0 && <p className="rp-empty-state">Nenhuma denúncia registrada ainda.</p>}
      </section>
    </>
  )
}
