# cidup

Estrutura inicial do projeto:

- `backend/` - servicos e regras de negocio
- `frontend/` - interface da aplicacao
- `docs/` - documentacao do projeto
- `docker-compose.yml` - orquestracao local dos servicos

## IA para denúncias

O dashboard possui um assistente que transforma um relato livre em um rascunho
com título, categoria, prioridade e resumo usando um provedor compatível com a
API de chat da OpenAI. O provedor ainda não está definido e pode ser trocado
sem alterar o código.

Configure a chave no backend antes de iniciar os serviços:

```env
AI_API_KEY=sua-chave
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

Para execução local, salve esse valor em `backend/.env`. Com Docker Compose,
defina as variáveis `AI_API_KEY`, `AI_BASE_URL` e `AI_MODEL` no ambiente que
executa o comando `docker compose up`.