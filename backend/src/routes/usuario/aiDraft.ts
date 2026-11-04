import { aiRateLimit } from '../../middlewares/rateLimits.js'
import { complaintPriorityLabels, normalizePriority, supportedComplaintCategories } from '../../utils/complaints.js'
import type { RouteContext } from '../context.js'

// ===== USUÁRIO: IA (SUGESTÃO DE RASCUNHO DE DENÚNCIA) =====
// Tela ligada: frontend/src/pages/usuario/DashboardPage.tsx.
export function registerAiDraftRoutes({ app, authenticate }: RouteContext) {
  // Solicita à IA um rascunho estruturado, sem criar ou enviar a denúncia automaticamente.
  // QUEM USA: DashboardPage.tsx (assistente de nova denúncia).
  // MIDDLEWARE: authenticate, aiRateLimit. CHAMA: API externa de IA (fetch /chat/completions),
  // normalizePriority. Prisma: nenhum. Não grava nada: só devolve o rascunho.
  app.post('/api/ai/complaint-draft', authenticate, aiRateLimit, async (request, response) => {
    const description =
      typeof request.body?.description === 'string'
        ? request.body.description.trim()
        : ''

    if (description.length < 10 || description.length > 1000) {
      response.status(400).json({
        error: 'Descreva o problema com 10 a 1.000 caracteres.',
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
    //    O prompt limita as categorias às de supportedComplaintCategories.
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
                'Você estrutura denúncias cidadãs em JSON. Não invente informações. Responda somente com as propriedades title, categories, priority e summary. ' +
                `"categories" é uma lista com uma ou mais opções copiadas exatamente desta lista: ${supportedComplaintCategories.map((category) => `"${category}"`).join(', ')}. ` +
                '"priority" é "Baixa", "Média" ou "Alta". "summary" é a descrição clara do problema, em até 1.000 caracteres, com o local se ele foi informado. Use português do Brasil.',
            },
            {
              role: 'user',
              content: `Denúncia: ${description}`,
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
      const draft = JSON.parse(content) as Record<string, unknown>
      const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
      // Mantém só as ocorrências aceitas pelo formulário; sem nenhuma válida, usa "Outro problema urbano".
      const suggested = Array.isArray(draft.categories) ? draft.categories : [draft.category]
      const validCategories = [...new Set(suggested.map(text).filter((category) => supportedComplaintCategories.includes(category)))]
      const categories = validCategories.length ? validCategories : ['Outro problema urbano']

      response.json({
        title: text(draft.title),
        category: categories[0],
        categories,
        priority: (() => {
          const priority = normalizePriority(draft.priority)
          return priority ? complaintPriorityLabels[priority] : ''
        })(),
        summary: text(draft.summary).slice(0, 1000),
      })
    } catch (error) {
      console.error('Falha ao gerar rascunho de denúncia com IA.', error instanceof Error ? error.message : error)
      response.status(502).json({
        error: 'Não foi possível gerar o rascunho agora. Tente novamente.',
      })
    }
  })
}
