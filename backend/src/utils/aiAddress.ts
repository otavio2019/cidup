import { normalizeRoutingText } from './complaints.js'

function sourceValue(value: unknown, description: string): { value: string; index: number } | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const candidate = value.trim()
  const index = description.toLocaleLowerCase('pt-BR').indexOf(candidate.toLocaleLowerCase('pt-BR'))
  return index < 0 ? null : { value: description.slice(index, index + candidate.length), index }
}

const referenceWords = /\b(?:proximo|proxima|perto|em frente|ao lado|junto|atras|defronte)\b/

export function extractAiAddress(draft: Record<string, unknown>, description: string) {
  const streetCandidate = sourceValue(draft.street, description)
  const streetPrefix = streetCandidate
    ? normalizeRoutingText(description.slice(Math.max(0, streetCandidate.index - 50), streetCandidate.index))
    : ''
  const proposedNumber = sourceValue(draft.number, description)
  const proposedNeighborhood = sourceValue(draft.neighborhood, description)
  const streetSuffix = streetCandidate ? normalizeRoutingText(streetCandidate.value) : ''
  const street = streetCandidate
    && /^(?:rua|avenida|av\.?|travessa|trav\.?|praça|rodovia|estrada)\s+\S/i.test(streetCandidate.value)
    && !/[,\n;]/.test(streetCandidate.value)
    && !referenceWords.test(normalizeRoutingText(streetCandidate.value))
    && !/\b(?:numero|nº|n°)\s*\d/i.test(normalizeRoutingText(streetCandidate.value))
    && !(proposedNumber && streetSuffix.endsWith(` ${normalizeRoutingText(proposedNumber.value)}`))
    && !(proposedNeighborhood && streetSuffix.endsWith(` ${normalizeRoutingText(proposedNeighborhood.value)}`))
    && !/(?:proxim[oa]|perto|em frente|ao lado|junto|atras|defronte)\s+(?:d[ao]s?|a|à|ao|as|às|aos|das|dos)\s*$/.test(streetPrefix)
    ? streetCandidate.value : null

  const referenceCandidate = sourceValue(draft.referencePoint, description)
  const referencePoint = referenceCandidate && referenceWords.test(normalizeRoutingText(referenceCandidate.value))
    ? referenceCandidate.value : null

  const neighborhoodCandidate = sourceValue(draft.neighborhood, description)
  const neighborhoodPrefix = neighborhoodCandidate
    ? normalizeRoutingText(description.slice(Math.max(0, neighborhoodCandidate.index - 50), neighborhoodCandidate.index))
    : ''
  const neighborhood = neighborhoodCandidate
    && !/[,\n;]/.test(neighborhoodCandidate.value)
    && /[a-z\u00c0-\u00ff]/i.test(neighborhoodCandidate.value)
    && !referenceWords.test(normalizeRoutingText(neighborhoodCandidate.value))
    && (/\bbairro\s+(?:d[ao]s?\s+)?$/.test(neighborhoodPrefix)
      || (street && /,\s*$/.test(neighborhoodPrefix) && !/(?:proxim[oa]|perto|em frente|ao lado)\s+(?:d[ao]s?|a|ao)\s*$/.test(neighborhoodPrefix)))
    ? neighborhoodCandidate.value : null

  const numberCandidate = sourceValue(draft.number, description)
  const numberPrefix = numberCandidate
    ? normalizeRoutingText(description.slice(Math.max(0, numberCandidate.index - 40), numberCandidate.index))
    : ''
  const numberSuffix = numberCandidate
    ? description.slice(numberCandidate.index + numberCandidate.value.length)
    : ''
  const afterStreet = street && streetCandidate && numberCandidate
    && numberCandidate.index >= streetCandidate.index + streetCandidate.value.length
    ? description.slice(streetCandidate.index + streetCandidate.value.length, numberCandidate.index)
    : null
  const number = numberCandidate && /^\d+[A-Za-z]?$/.test(numberCandidate.value)
    && !/\d/.test(description[numberCandidate.index - 1] ?? '')
    && !/[\d-]/.test(numberSuffix[0] ?? '')
    && !/\b(?:cep|telefone|celular|protocolo)\b[^,;]*$/.test(numberPrefix)
    && (/\b(?:numero|nº|n°|n\.)\s*$/.test(numberPrefix)
      || (afterStreet !== null && /^\s*,?\s*$/.test(afterStreet)))
    ? numberCandidate.value : null

  return { street, number, neighborhood, referencePoint }
}
