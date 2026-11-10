import { useState } from 'react'
import { generateComplaintConfirmationPdf, type ComplaintPdfData } from '../complaintPdf'

type ComplaintPdfShareButtonProps = {
  complaint: ComplaintPdfData
  buttonClassName?: string
}

export default function ComplaintPdfShareButton({
  complaint,
  buttonClassName = 'secondary-action complaint-detail-print',
}: ComplaintPdfShareButtonProps) {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [whatsAppUrl, setWhatsAppUrl] = useState('')

  async function sharePdf() {
    setMessage('')
    setError('')
    setWhatsAppUrl('')

    try {
      const pdf = generateComplaintConfirmationPdf(complaint)
      const fileProtocol = complaint.protocol.replace(/[^a-zA-Z0-9_-]/g, '_')
      const file = new File([pdf], `cidup-protocolo-${fileProtocol}.pdf`, { type: 'application/pdf' })
      const shareData: ShareData = {
        files: [file],
        title: `Comprovante da denúncia ${complaint.protocol}`,
        text: `Comprovante da denúncia registrada no CidUp. Protocolo: ${complaint.protocol}`,
      }

      if (
        typeof navigator.share === 'function'
        && typeof navigator.canShare === 'function'
        && navigator.canShare(shareData)
      ) {
        try {
          await navigator.share(shareData)
          setMessage('O PDF foi compartilhado pelo menu do dispositivo. Confirme o envio no WhatsApp.')
        } catch (shareError) {
          if (shareError instanceof DOMException && shareError.name === 'AbortError') return
          throw shareError
        }
        return
      }

      const downloadUrl = URL.createObjectURL(file)
      const downloadLink = document.createElement('a')
      downloadLink.href = downloadUrl
      downloadLink.download = file.name
      downloadLink.click()
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)

      const text = encodeURIComponent(`Olá! Segue o comprovante da denúncia registrada no CidUp. Protocolo: ${complaint.protocol}`)
      const url = `https://wa.me/?text=${text}`
      setWhatsAppUrl(url)
      window.open(url, '_blank', 'noopener,noreferrer')
      setMessage(`PDF baixado (${file.name}). Anexe esse arquivo no WhatsApp Web e confirme o envio.`)
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : 'Não foi possível gerar ou compartilhar o PDF.')
    }
  }

  return (
    <div className="complaint-pdf-share">
      <button className={buttonClassName} type="button" onClick={sharePdf}>
        Compartilhar PDF via WhatsApp
      </button>
      {message && <p className="complaint-pdf-share-message" role="status">{message}</p>}
      {whatsAppUrl && (
        <a className={buttonClassName} href={whatsAppUrl} target="_blank" rel="noreferrer">
          Abrir WhatsApp
        </a>
      )}
      {error && <p className="complaint-pdf-share-message" role="alert">{error}</p>}
    </div>
  )
}
