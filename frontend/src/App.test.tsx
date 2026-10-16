import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { ProtectedRoute, ResponsibleRoute } from './App'

vi.mock('./api', () => ({
  apiRequest: vi.fn().mockRejectedValue(new Error('Não autenticado')),
}))

describe('proteção de rotas com sessão do servidor', () => {
  it('não confia nas antigas sinalizações de autenticação do localStorage', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <ProtectedRoute><span>privado</span></ProtectedRoute>
      </MemoryRouter>,
    )

    expect(markup).toContain('Verificando sessão')
    expect(markup).not.toContain('privado')
  })

  it('verifica a sessão antes de exibir o conteúdo da área responsável', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <ResponsibleRoute><span>administrador</span></ResponsibleRoute>
      </MemoryRouter>,
    )

    expect(markup).toContain('Verificando sessão')
    expect(markup).not.toContain('administrador')
  })
})
