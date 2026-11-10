import { jsPDF } from 'jspdf'

export type ComplaintPdfData = {
  protocol: string
  registeredAt?: string
  status?: string
  description?: string
  address?: string
  neighborhood?: string
  complement?: string
  number?: string
  type?: string
  categories?: string[]
}

export function generateComplaintConfirmationPdf(complaint: ComplaintPdfData) {
  const pdf = new jsPDF({ format: 'a4', unit: 'mm' })
  const margin = 18
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const contentWidth = pageWidth - margin * 2
  let y = 24

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.setTextColor(21, 101, 192)
  pdf.text('CidUp — Comprovante de denúncia', margin, y)
  y += 10

  pdf.setFontSize(11)
  pdf.setTextColor(38, 50, 56)
  pdf.text(`Protocolo: ${complaint.protocol}`, margin, y)
  y += 10

  function writeField(label: string, value?: string) {
    const lines = pdf.splitTextToSize(value?.trim() || 'Não informado', contentWidth) as string[]
    if (y + 12 > pageHeight - margin) {
      pdf.addPage()
      y = margin
    }

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(84, 110, 122)
    pdf.text(label, margin, y)
    y += 5

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(11)
    pdf.setTextColor(38, 50, 56)
    for (const line of lines) {
      if (y > pageHeight - margin) {
        pdf.addPage()
        y = margin
      }
      pdf.text(line, margin, y)
      y += 5
    }
    y += 3
  }

  writeField('Data do registro', complaint.registeredAt)
  writeField('Status', complaint.status)
  writeField('Ocorrências', complaint.categories?.join(', ') || complaint.type)
  writeField('Descrição', complaint.description)
  writeField('Endereço', [complaint.address, complaint.number].filter(Boolean).join(', '))
  writeField('Bairro', complaint.neighborhood)
  writeField('Ponto de referência', complaint.complement)

  return pdf.output('blob')
}
