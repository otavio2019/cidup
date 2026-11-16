export type AiComplaintDraft = {
  title?: string
  description?: string
  type?: string
  category?: string
  categories?: string[]
  priority?: string
  improvedDescription?: string
  summary?: string
  street?: string | null
  number?: string | null
  neighborhood?: string | null
  referencePoint?: string | null
}

export type AiComplaintForm = {
  title: string
  type: string
  categories: string[]
  description: string
  address: string
  number: string
  neighborhood: string
  complement: string
  priority: string
}

// Combina a sugestão da IA com o formulário sem apagar dados preenchidos.
export function applyAiComplaintDraft(
  form: AiComplaintForm,
  draft: AiComplaintDraft,
  automaticLocation: Partial<Pick<AiComplaintForm, 'address' | 'number' | 'neighborhood'>> = {},
): AiComplaintForm {
  const categories = draft.categories?.length ? draft.categories : draft.category ? [draft.category] : form.categories
  // Permite substituir só campos vazios ou preenchidos automaticamente pelo GPS.
  const canReplace = (field: 'address' | 'number' | 'neighborhood') =>
    !form[field].trim() || (Boolean(automaticLocation[field]) && form[field] === automaticLocation[field])
  return {
    ...form,
    title: draft.title?.trim() || form.title,
    categories,
    type: categories[0] ?? form.type,
    address: canReplace('address') ? draft.street?.trim() || form.address : form.address,
    number: canReplace('number') ? draft.number?.trim() || form.number : form.number,
    neighborhood: canReplace('neighborhood') ? draft.neighborhood?.trim() || form.neighborhood : form.neighborhood,
    complement: form.complement.trim() ? form.complement : draft.referencePoint?.trim() || form.complement,
    priority: draft.priority?.trim() || form.priority,
  }
}
