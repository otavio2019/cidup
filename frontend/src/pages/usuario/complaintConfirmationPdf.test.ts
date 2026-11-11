import { describe, expect, it } from 'vitest'
import { generateComplaintConfirmationPdf } from '../../complaintPdf'

describe('generateComplaintConfirmationPdf', () => {
  it('creates a PDF with the complaint protocol and summary', async () => {
    const file = generateComplaintConfirmationPdf({
      protocol: 'CID-123',
      description: 'Buraco na rua',
      address: 'Rua das Flores',
      neighborhood: 'Centro',
    })

    expect(file.type).toBe('application/pdf')
    expect(await file.slice(0, 5).text()).toBe('%PDF-')
    expect(await file.text()).toContain('CID-123')
  })
})
