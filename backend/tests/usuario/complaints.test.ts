import { test } from 'node:test'
import assert from 'node:assert/strict'
import { callApi, calls, complaints, cookieFor, record, setupTestServer, type RecordValue } from '../helpers/testServer.js'

// ===== TESTES: DENÚNCIAS (src/routes/usuario/complaints.ts) =====
setupTestServer()

test('salva os componentes do endereço da IA uma única vez', async () => {
  calls.length = 0
  const response = await callApi('/api/complaints', {
    method: 'POST',
    headers: { Cookie: await cookieFor(1) },
    body: JSON.stringify({
      type: 'Buraco ou problema na via',
      categories: ['Buraco ou problema na via'],
      description: 'Existe um buraco na Avenida Solon de Lucena, número 55, no bairro Centro, próximo à praça.',
      address: 'Avenida Solon de Lucena',
      number: '55',
      neighborhood: 'Centro',
      complement: 'próximo à praça',
      latitude: -23,
      longitude: -46,
    }),
  })
  assert.equal(response.status, 201)
  assert.equal(record(calls.find((call) => call.model === 'denuncia' && call.method === 'create')?.args.data).endereco,
    'Avenida Solon de Lucena, 55, Centro, próximo à praça')
})

test('encaminha denúncias automaticamente para o órgão compatível com a categoria', async () => {
  const routingCases = [
    ['Buraco ou problema na via', 1, 'Secretaria de Infraestrutura'],
    ['Iluminação pública', 2, 'Secretaria de Iluminação Pública'],
    ['Lixo ou descarte irregular', 3, 'Secretaria de Limpeza Urbana'],
    ['Árvore ou área verde', 4, 'Secretaria de Meio Ambiente'],
    ['Alagamento ou drenagem', 5, 'Secretaria de Saneamento'],
  ] as const

  for (const [type, organizationId, organizationName] of routingCases) {
    const response = await callApi('/api/complaints', {
      method: 'POST',
      headers: { Cookie: await cookieFor(1) },
      body: JSON.stringify({
        type,
        categories: [type],
        title: type,
        description: `Relato de teste para ${type}.`,
        address: 'Rua de teste, 10, Centro',
        latitude: -23,
        longitude: -46,
      }),
    })
    const body = await response.json() as RecordValue
    const complaint = record(body.complaint)
    const organization = record(complaint.orgao)
    assert.equal(response.status, 201, type)
    assert.equal(complaint.id_orgao, organizationId, type)
    assert.equal(organization.nome, organizationName, type)
  }
})

test('mantém compatibilidade com clientes antigos que enviam uma categoria em type', async () => {
  const response = await callApi('/api/complaints', {
    method: 'POST',
    headers: { Cookie: await cookieFor(1) },
    body: JSON.stringify({
      type: 'Iluminação',
      description: 'Relato legado com uma única categoria.',
      address: 'Rua de teste, 10, Centro',
      latitude: -23,
      longitude: -46,
    }),
  })
  const body = await response.json() as RecordValue
  assert.equal(response.status, 201)
  assert.deepEqual(record(body.complaint).categories, ['Iluminação'])
})

test('salva várias categorias e encaminha para todos os órgãos correspondentes', async () => {
  calls.length = 0
  const response = await callApi('/api/complaints', {
    method: 'POST',
    headers: { Cookie: await cookieFor(1) },
    body: JSON.stringify({
      type: 'Buraco ou problema na via',
      categories: ['Buraco ou problema na via', 'Iluminação pública', 'Lixo ou descarte irregular'],
      title: 'Vários problemas no mesmo local',
      description: 'Há mais de um problema urbano neste endereço.',
      address: 'Rua de teste, 10, Centro',
      latitude: -23,
      longitude: -46,
    }),
  })
  const createCall = calls.find((call) => call.model === 'denuncia' && call.method === 'create')
  const data = record(createCall?.args.data)
  const extraOrganizations = record(data.orgaos_extras)
  assert.equal(response.status, 201)
  assert.deepEqual(data.categorias, ['Buraco ou problema na via', 'Iluminação pública', 'Lixo ou descarte irregular'])
  assert.deepEqual(record(data.orgao).connect, { id_orgao: 1 })
  assert.deepEqual(extraOrganizations.connect, [{ id_orgao: 2 }, { id_orgao: 3 }])
})

test('encontra ocorrências até 50 metros com categoria em comum sem expor dados pessoais', async () => {
  const savedComplaints = [...complaints.entries()]
  complaints.clear()
  const baseComplaint = savedComplaints.find(([id]) => id === 101)?.[1]
  if (!baseComplaint) throw new Error('Denúncia de teste ausente.')
  baseComplaint.categorias = ['Iluminação pública']
  complaints.set(101, baseComplaint)
  complaints.set(303, {
    ...complaints.get(101)!,
    id_denuncia: 303,
    titulo: 'Lâmpada queimada',
    tipo: 'Iluminação pública',
    categorias: ['Iluminação pública'],
    latitude: -22.9998,
    longitude: -46,
  })
  complaints.set(404, {
    ...complaints.get(101)!,
    id_denuncia: 404,
    titulo: 'Muito distante',
    tipo: 'Iluminação pública',
    categorias: ['Iluminação pública'],
    latitude: -22.998,
    longitude: -46,
  })
  try {
    const response = await callApi('/api/complaints/101/related', { headers: { Cookie: await cookieFor(1) } })
    const body = await response.json() as RecordValue
    const related = body.related as RecordValue[]
    assert.equal(response.status, 200)
    assert.equal(related.length, 1)
    assert.equal(related[0]?.id, 303)
    assert.equal(related[0]?.distanceMeters, 22)
    assert.equal('citizen' in (related[0] ?? {}), false)
    assert.equal('address' in (related[0] ?? {}), false)
  } finally {
    complaints.clear()
    savedComplaints.forEach(([id, complaint]) => complaints.set(id, complaint))
  }
})

test('aceita uma foto válida na criação da denúncia', async () => {
  calls.length = 0
  const photo = 'data:image/png;base64, iVBORw0KGgo='.replace(' ', '')
  const response = await callApi('/api/complaints', {
    method: 'POST',
    headers: { Cookie: await cookieFor(1) },
    body: JSON.stringify({
      type: 'Iluminação pública',
      title: 'Foto válida',
      description: 'Relato com uma imagem válida para teste.',
      address: 'Rua de teste, 10, Centro',
      latitude: -23,
      longitude: -46,
      photo,
    }),
  })
  assert.equal(response.status, 201)
  assert.equal(record(calls.find((call) => call.model === 'denuncia' && call.method === 'create')?.args.data).foto, photo)
})

test('salva a prioridade sugerida pela IA e ignora valores inválidos', async () => {
  for (const [priority, expected] of [['Média', 'MEDIA'], ['urgente', null]] as const) {
    calls.length = 0
    const response = await callApi('/api/complaints', {
      method: 'POST',
      headers: { Cookie: await cookieFor(1) },
      body: JSON.stringify({
        type: 'Iluminação pública',
        title: 'Poste apagado',
        description: 'Poste apagado há uma semana na esquina.',
        address: 'Rua de teste, 10, Centro',
        latitude: -23,
        longitude: -46,
        priority,
      }),
    })
    assert.equal(response.status, 201)
    assert.equal(record(calls.find((call) => call.model === 'denuncia' && call.method === 'create')?.args.data).prioridade, expected)
    assert.equal(record((await response.json() as RecordValue).complaint).priority, expected)
  }
})

test('rejeita foto maior que 2 MB antes de persistir a denúncia', async () => {
  calls.length = 0
  const oversizedPhoto = `data:image/png;base64,${'A'.repeat(2_800_000)}`
  const response = await callApi('/api/complaints', {
    method: 'POST',
    headers: { Cookie: await cookieFor(1) },
    body: JSON.stringify({
      type: 'Iluminação pública',
      title: 'Foto grande',
      description: 'Relato com uma imagem acima do limite permitido.',
      address: 'Rua de teste, 10, Centro',
      latitude: -23,
      longitude: -46,
      photo: oversizedPhoto,
    }),
  })
  assert.equal(response.status, 400)
  assert.match(await response.text(), /no máximo 2 MB/i)
  assert.equal(calls.some((call) => call.model === 'denuncia' && call.method === 'create'), false)
})

test('usuários não podem consultar, atualizar ou excluir denúncias de outras pessoas', async () => {
  const cookie = await cookieFor(1)
  const read = await callApi('/api/complaints/202', { headers: { Cookie: cookie, 'x-user-id': '2' } })
  calls.length = 0
  const update = await callApi('/api/complaints/202', {
    method: 'PATCH',
    headers: { Cookie: cookie, 'x-user-id': '2' },
    body: JSON.stringify({ description: 'tentativa indevida' }),
  })
  const remove = await callApi('/api/complaints/202', {
    method: 'DELETE',
    headers: { Cookie: cookie, 'x-user-id': '2' },
  })
  assert.equal(read.status, 404)
  assert.equal(update.status, 404)
  assert.equal(remove.status, 404)
  assert.equal(calls.some((call) => call.model === 'denuncia' && ['update', 'delete'].includes(call.method)), false)
  assert.equal(complaints.get(202)?.descricao, 'Relato privado do cidadão dois')
})
