import { afterEach, describe, expect, it, vi } from 'vitest'
import { reverseGeocode } from './geocoding'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('reverseGeocode', () => {
  it('uses zoom 17 and resolves alternative OpenStreetMap road fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      address: {
        pedestrian: 'Rua de Pedestres',
        house_number: '24',
        suburb: 'Centro',
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(reverseGeocode(-7.23, -35.88)).resolves.toEqual({
      street: 'Rua de Pedestres',
      houseNumber: '24',
      neighborhood: 'Centro',
    })
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('zoom=17')
  })

  it('returns an empty street when the map only contains a neighborhood', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      address: { neighbourhood: 'Centro' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })))

    await expect(reverseGeocode(-7.23, -35.88)).resolves.toEqual({
      street: '',
      houseNumber: '',
      neighborhood: 'Centro',
    })
  })

  it('reports rate limiting as a retryable service error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429 })))

    await expect(reverseGeocode(-7.23, -35.88)).rejects.toThrow(/temporariamente ocupado/)
  })
})
