import 'dotenv/config'
import { createApp } from './app.js'

// ===== INICIALIZAÇÃO DO SERVIDOR =====
// Ponto de entrada (npm run dev / npm start). A montagem da API fica em app.ts.
const app = createApp()
const port = Number(process.env.PORT ?? 3000)
app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor da API em execução na porta ${port}.`)
})
