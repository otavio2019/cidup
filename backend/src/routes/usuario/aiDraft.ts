import { aiRateLimit } from '../../middlewares/rateLimits.js'
import { extractAiAddress } from '../../utils/aiAddress.js'
import { complaintPriorityLabels, normalizePriority, normalizeRoutingText, supportedComplaintCategories } from '../../utils/complaints.js'
import type { RouteContext } from '../context.js'

// ===== USUÁRIO: IA (SUGESTÃO DE RASCUNHO DE DENÚNCIA) =====
// Tela ligada: frontend/src/pages/usuario/DashboardPage.tsx.
export function registerAiDraftRoutes({ app, authenticate }: RouteContext) {
  // Solicita à IA um rascunho estruturado, sem criar ou enviar a denúncia automaticamente.
  // QUEM USA: DashboardPage.tsx (assistente de nova denúncia).
  // MIDDLEWARE: authenticate, aiRateLimit. CHAMA: API externa de IA (fetch /chat/completions),
  // normalizePriority. Prisma: nenhum. Não grava nada: só devolve o rascunho.
  app.post('/api/ai/complaint-draft', authenticate, aiRateLimit, async (request, response) => {
    const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
    const description = typeof request.body?.description === 'string' ? request.body.description : ''
    const address = text(request.body?.address)
    const neighborhood = text(request.body?.neighborhood)
    const type = text(request.body?.type)
    const categoriesInput = Array.isArray(request.body?.categories)
      ? [...new Set((request.body.categories as unknown[]).filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean))]
      : []
    const inputCategories = categoriesInput.filter((category) => supportedComplaintCategories.includes(category))

    if (description.trim().length < 20 || description.length > 1000) {
      response.status(400).json({
        error: 'Descreva o problema com 20 a 1.000 caracteres.',
      })
      return
    }

    // 1) Valida o texto (10 a 1000 caracteres) e exige AI_API_KEY configurada.
    const apiKey = process.env.AI_API_KEY
    if (!apiKey) {
      response.status(503).json({
        error: 'A IA ainda não está configurada. Adicione AI_API_KEY ao backend.',
      })
      return
    }

      // 2) Chama a API de IA (compatível com OpenAI) pedindo resposta em JSON.
      //    O prompt limita as categorias às de supportedComplaintCategories e proíbe invenções.
    try {
      const baseUrl = (process.env.AI_BASE_URL ?? 'https://api.openai.com/v1').replace(
        /\/$/,
        '',
      )
      const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal: AbortSignal.timeout(30_000),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL ?? 'gpt-4o-mini',
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'Você é um assistente para organizar denúncias urbanas. Analise a descrição, rua, bairro e tipo ou tipos informados. ' +
                'Melhore a descrição sem inventar informações, crie um título curto, identifique uma ou mais categorias válidas e sugira uma prioridade. ' +
                'Extraia exclusivamente da descrição original os campos street, number, neighborhood e referencePoint, copiando literalmente a escrita original. ' +
                'Use strings para esses campos e null quando não houver evidência suficiente. street contém apenas o nome da Rua, Avenida, Av., Travessa, Praça, Rodovia ou Estrada; separe número, bairro e referência. ' +
                'Referências como próximo, perto, em frente e ao lado não fazem parte da rua. Uma praça mencionada apenas como referência não é a rua da ocorrência. ' +
                'Não confunda número de imóvel com CEP, telefone ou protocolo. Não invente endereço, órgão, medidas, datas ou fatos. ' +
                'Responda somente em JSON válido, sem texto fora do JSON, com as propriedades title, categories, priority, improvedDescription, street, number, neighborhood e referencePoint. ' +
                `"categories" deve usar somente esta lista: ${supportedComplaintCategories.map((category) => `"${category}"`).join(', ')}. ` +
                '"priority" deve ser "Baixa", "Média" ou "Alta". Use português do Brasil.',
            },
            {
              role: 'user',
              content: [
                'Descrição original:', description,
                '', 'Rua:', address || 'não informada',
                '', 'Bairro:', neighborhood || 'não informado',
                '', 'Tipo informado pelo cidadão:', type || 'não informado',
                '', 'Categorias já selecionadas:', inputCategories.length ? inputCategories.join(', ') : 'nenhuma',
              ].join('\n'),
            },
          ],
        }),
      })

      if (!aiResponse.ok) {
        const detail = (await aiResponse.text().catch(() => '')).slice(0, 300)
        throw new Error(`O provedor de IA retornou o status ${aiResponse.status}: ${detail}`)
      }

      // 3) Lê a resposta e confere cada campo (a IA pode errar). Devolve ao frontend.
      const completion = (await aiResponse.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>
      }
      const content = completion.choices?.[0]?.message?.content ?? '{}'
      const normalizedContent = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
      const draft = JSON.parse(normalizedContent) as Record<string, unknown>
      // Mantém só as ocorrências aceitas pelo formulário; se a IA não retornar nenhuma,
      // preserva as categorias já escolhidas pelo cidadão ou usa a categoria genérica segura.
      const suggested = Array.isArray(draft.categories) ? draft.categories : [draft.category]
      const validCategories = [...new Set(suggested.map(text).filter((category) => supportedComplaintCategories.includes(category)))]
      const categories = validCategories.length ? validCategories : inputCategories.length ? inputCategories : ['Outro problema urbano']
      const title = text(draft.title).slice(0, 200) || description.slice(0, 120)
      let improvedDescription = text(draft.improvedDescription) || text(draft.summary) || description
      if (address && !normalizeRoutingText(improvedDescription).includes(normalizeRoutingText(address))) {
        improvedDescription += ` Local informado: ${address}.`
      }
      if (neighborhood && !normalizeRoutingText(improvedDescription).includes(normalizeRoutingText(neighborhood))) {
        improvedDescription += ` Bairro informado: ${neighborhood}.`
      }
      improvedDescription = improvedDescription.slice(0, 1000)
      const priorityCode = normalizePriority(draft.priority)
      const priority = priorityCode ? complaintPriorityLabels[priorityCode] : complaintPriorityLabels.MEDIA
      const location = extractAiAddress(draft, description)

      response.json({
        title,
        description,
        type: categories[0],
        category: categories[0],
        categories,
        priority,
        ...location,
        improvedDescription,
        // Mantém summary para clientes antigos do dashboard.
        summary: improvedDescription,
      })
    } catch (error) {
      console.error('Falha ao gerar rascunho de denúncia com IA.', error instanceof Error ? error.message : error)
      response.status(502).json({
        error: 'Não foi possível gerar o rascunho agora. Tente novamente.',
      })
    }
  })
}
