import cors from 'cors'
import express from 'express'

const app = express()
const port = Number(process.env.PORT ?? 3000)

app.use(cors())
app.use(express.json())

// NOTE: esta rota confirma apenas que o servidor Express está ativo.
app.get('/health', (_request, response) => {
  response.json({ status: 'ok' })
})

// TODO: adicionar as rotas de autenticação e denúncias.
// TODO: conectar o Prisma Client ao PostgreSQL quando o schema estiver pronto.
app.listen(port, () => {
  console.log(`Backend listening on port ${port}`)
})
