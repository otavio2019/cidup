export type ReverseGeocodeResult = {
  street: string
  houseNumber: string
  neighborhood: string
}

type NominatimAddress = {
  road?: string
  street?: string
  pedestrian?: string
  residential?: string
  living_street?: string
  unclassified?: string
  service?: string
  footway?: string
  path?: string
  cycleway?: string
  track?: string
  house_number?: string
  neighbourhood?: string
  suburb?: string
  city_district?: string
  quarter?: string
  borough?: string
}

type NominatimResponse = { address?: NominatimAddress }

// Busca uma rua no ponto exato; no OSM, vias também podem usar categorias alternativas a "road".
export async function reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.search = new URLSearchParams({
    format: 'jsonv2',
    lat: String(latitude),
    lon: String(longitude),
    zoom: '17',
    addressdetails: '1',
    'accept-language': 'pt-BR',
  }).toString()

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  })
  if (!response.ok) {
    if (response.status === 429) throw new Error('O serviço de endereço está temporariamente ocupado. Tente novamente em alguns segundos.')
    throw new Error(`O serviço de endereço respondeu com erro (${response.status}).`)
  }

  const result = await response.json() as NominatimResponse
  const address = result.address ?? {}
  return {
    street: address.road
      ?? address.street
      ?? address.pedestrian
      ?? address.residential
      ?? address.living_street
      ?? address.unclassified
      ?? address.service
      ?? address.footway
      ?? address.path
      ?? address.cycleway
      ?? address.track
      ?? '',
    houseNumber: address.house_number ?? '',
    neighborhood: address.neighbourhood
      ?? address.suburb
      ?? address.city_district
      ?? address.quarter
      ?? address.borough
      ?? '',
  }
}
