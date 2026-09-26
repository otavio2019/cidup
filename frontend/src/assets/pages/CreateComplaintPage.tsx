import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '../../App.css'

type ComplaintFormData = {
  type: string
  description: string
  address: string
  number: string
  neighborhood: string
  complement: string
}

type ComplaintErrors = Partial<Record<keyof ComplaintFormData | 'photo', string>>

const initialForm: ComplaintFormData = {
  type: '',
  description: '',
  address: '',
  number: '',
  neighborhood: '',
  complement: '',
}

const complaintTypes = [
  'Buraco ou problema na via',
  'Iluminação pública',
  'Lixo ou descarte irregular',
  'Calçada ou acessibilidade',
  'Árvore ou área verde',
  'Alagamento ou drenagem',
  'Sinalização de trânsito',
  'Outro problema urbano',
]

const MAX_PHOTO_SIZE = 5 * 1024 * 1024

function CreateComplaintPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [photo, setPhoto] = useState<File | null>(null)
  const [errors, setErrors] = useState<ComplaintErrors>({})
  const [submitError, setSubmitError] = useState('')

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: value,
    }))

    setErrors((current) => ({
      ...current,
      [name]: undefined,
    }))
    setSubmitError('')
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedPhoto = event.target.files?.[0]

    if (!selectedPhoto) {
      setPhoto(null)
      return
    }

    if (!selectedPhoto.type.startsWith('image/')) {
      setPhoto(null)
      setErrors((current) => ({
        ...current,
        photo: 'Selecione um arquivo de imagem válido.',
      }))
      return
    }

    if (selectedPhoto.size > MAX_PHOTO_SIZE) {
      setPhoto(null)
      setErrors((current) => ({
        ...current,
        photo: 'A imagem deve ter no máximo 5 MB.',
      }))
      return
    }

    setPhoto(selectedPhoto)
    setErrors((current) => ({
      ...current,
      photo: undefined,
    }))
  }

  function validateForm(): ComplaintErrors {
    const nextErrors: ComplaintErrors = {}
    const trimmedDescription = form.description.trim()

    if (!form.type) {
      nextErrors.type = 'Selecione o tipo do problema.'
    }

    if (!trimmedDescription) {
      nextErrors.description = 'Descreva o problema encontrado.'
    } else if (trimmedDescription.length < 20) {
      nextErrors.description = 'A descrição deve ter pelo menos 20 caracteres.'
    } else if (trimmedDescription.length > 1000) {
      nextErrors.description = 'A descrição deve ter no máximo 1.000 caracteres.'
    }

    if (!form.address.trim()) {
      nextErrors.address = 'Informe o nome da rua ou avenida.'
    }

    if (!form.number.trim()) {
      nextErrors.number = 'Informe o número ou digite “S/N”.'
    }

    if (!form.neighborhood.trim()) {
      nextErrors.neighborhood = 'Informe o bairro.'
    }

    return nextErrors
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validateForm()

    if (Object.keys(nextErrors).length > 0 || errors.photo) {
      setErrors(nextErrors)
      return
    }

    const complaintDraft = {
      ...form,
      type: form.type,
      description: form.description.trim(),
      address: form.address.trim(),
      number: form.number.trim(),
      neighborhood: form.neighborhood.trim(),
      complement: form.complement.trim(),
      photoName: photo?.name ?? null,
    }

    // HACK: guardar temporariamente até a API POST /api/complaints existir.
    sessionStorage.setItem('cidup-complaint-draft', JSON.stringify(complaintDraft))
    setSubmitError('')
    navigate('/registrar-denuncia/localizacao', {
      state: complaintDraft,
    })
  }

  return (
    <main className="complaint-page">
      <header className="complaint-header">
        <Link className="complaint-brand" to="/dashboard" aria-label="Voltar ao Dashboard">
          <span className="complaint-brand-mark" aria-hidden="true">C</span>
          <span>CidUp</span>
        </Link>
        <span className="complaint-step">Etapa 1 de 3</span>
      </header>

      <section className="complaint-shell" aria-labelledby="complaint-title">
        <div className="complaint-heading">
          <Link className="back-link" to="/dashboard">← Voltar ao início</Link>
          <p className="complaint-kicker">NOVA DENÚNCIA</p>
          <h1 id="complaint-title">Conte o que aconteceu</h1>
          <p>
            Quanto mais detalhes você informar, mais fácil será para o órgão
            responsável entender e resolver o problema.
          </p>
        </div>

        <form className="complaint-form" onSubmit={handleSubmit} noValidate>
          <div className="form-section">
            <div className="form-section-title">
              <span>01</span>
              <div>
                <h2>Sobre o problema</h2>
                <p>Identifique e descreva a situação encontrada.</p>
              </div>
            </div>

            <div className="complaint-field">
              <label htmlFor="type">Tipo do problema <span>*</span></label>
              <select
                id="type"
                name="type"
                value={form.type}
                onChange={handleChange}
                aria-invalid={Boolean(errors.type)}
                aria-describedby={errors.type ? 'type-error' : undefined}
              >
                <option value="">Selecione uma opção</option>
                {complaintTypes.map((complaintType) => (
                  <option key={complaintType} value={complaintType}>
                    {complaintType}
                  </option>
                ))}
              </select>
              {errors.type && <p className="field-error" id="type-error">{errors.type}</p>}
            </div>

            <div className="complaint-field">
              <div className="field-label-row">
                <label htmlFor="description">Descrição <span>*</span></label>
                <span>{form.description.length}/1.000</span>
              </div>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={handleChange}
                maxLength={1000}
                rows={6}
                placeholder="Explique o que aconteceu, quando você percebeu e qualquer outro detalhe importante."
                aria-invalid={Boolean(errors.description)}
                aria-describedby={errors.description ? 'description-error' : undefined}
              />
              {errors.description && <p className="field-error" id="description-error">{errors.description}</p>}
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">
              <span>02</span>
              <div>
                <h2>Onde aconteceu?</h2>
                <p>Informe o local para encaminharmos a denúncia corretamente.</p>
              </div>
            </div>

            <div className="complaint-field">
              <label htmlFor="address">Rua ou avenida <span>*</span></label>
              <input
                id="address"
                name="address"
                type="text"
                value={form.address}
                onChange={handleChange}
                placeholder="Ex.: Rua das Flores"
                autoComplete="street-address"
                aria-invalid={Boolean(errors.address)}
                aria-describedby={errors.address ? 'address-error' : undefined}
              />
              {errors.address && <p className="field-error" id="address-error">{errors.address}</p>}
            </div>

            <div className="complaint-grid complaint-grid-small">
              <div className="complaint-field">
                <label htmlFor="number">Número <span>*</span></label>
                <input
                  id="number"
                  name="number"
                  type="text"
                  value={form.number}
                  onChange={handleChange}
                  placeholder="Ex.: 120 ou S/N"
                  autoComplete="address-line2"
                  aria-invalid={Boolean(errors.number)}
                  aria-describedby={errors.number ? 'number-error' : undefined}
                />
                {errors.number && <p className="field-error" id="number-error">{errors.number}</p>}
              </div>

              <div className="complaint-field">
                <label htmlFor="neighborhood">Bairro <span>*</span></label>
                <input
                  id="neighborhood"
                  name="neighborhood"
                  type="text"
                  value={form.neighborhood}
                  onChange={handleChange}
                  placeholder="Ex.: Centro"
                  autoComplete="address-level3"
                  aria-invalid={Boolean(errors.neighborhood)}
                  aria-describedby={errors.neighborhood ? 'neighborhood-error' : undefined}
                />
                {errors.neighborhood && <p className="field-error" id="neighborhood-error">{errors.neighborhood}</p>}
              </div>
            </div>

            <div className="complaint-field">
              <label htmlFor="complement">Ponto de referência <small>(opcional)</small></label>
              <input
                id="complement"
                name="complement"
                type="text"
                value={form.complement}
                onChange={handleChange}
                placeholder="Ex.: Próximo à escola municipal"
              />
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">
              <span>03</span>
              <div>
                <h2>Adicione uma foto</h2>
                <p>Uma imagem pode ajudar na análise. Este campo é opcional.</p>
              </div>
            </div>

            <label className="photo-upload" htmlFor="photo">
              <span className="photo-upload-icon" aria-hidden="true">＋</span>
              <span>
                <strong>{photo ? photo.name : 'Adicionar uma foto'}</strong>
                <small>{photo ? 'Imagem selecionada' : 'PNG, JPG ou WEBP até 5 MB'}</small>
              </span>
              <input
                id="photo"
                name="photo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handlePhotoChange}
              />
            </label>
            {errors.photo && <p className="field-error">{errors.photo}</p>}
          </div>

          {submitError && <p className="form-message complaint-submit-error" role="alert">{submitError}</p>}

          <div className="complaint-actions">
            <Link className="secondary-action" to="/dashboard">Cancelar</Link>
            <button className="primary-action" type="submit">
              Continuar para localização <span aria-hidden="true">→</span>
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}

export default CreateComplaintPage
