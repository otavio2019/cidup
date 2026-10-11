import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { ProtectedRoute, ResponsibleRoute } from './App'

vi.mock('./api', () => ({
  apiRequest: vi.fn().mockRejectedValue(new Error('Unauthenticated')),
}))

describe('server-backed route guards', () => {
  it('does not trust legacy localStorage authentication flags', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <ProtectedRoute><span>private</span></ProtectedRoute>
      </MemoryRouter>,
    )

    expect(markup).toContain('Verificando sessão')
    expect(markup).not.toContain('private')
  })

  it('checks server session before rendering responsible content', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <ResponsibleRoute><span>admin</span></ResponsibleRoute>
      </MemoryRouter>,
    )

    expect(markup).toContain('Verificando sessão')
    expect(markup).not.toContain('admin')
  })
})
