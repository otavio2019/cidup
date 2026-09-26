# CidUp

Sistema de denúncias urbanas para aproximar cidadãos e órgãos responsáveis pela cidade.

## Objetivo

Permitir que o cidadão registre problemas urbanos, informe a localização, receba um protocolo e acompanhe o andamento da solicitação.

## Estrutura do projeto

```text
cidup/
├── backend/              # API, regras de negócio e integração com o banco
├── frontend/             # Interface React do cidadão
├── docs/                 # Documentação do projeto
└── docker-compose.yml    # Orquestração dos serviços locais
```

## Tecnologias

- React, TypeScript e Vite no frontend;
- Node.js, Express e TypeScript no backend;
- PostgreSQL como banco de dados;
- Prisma como ORM;
- Docker e Docker Compose para o ambiente local;
- Git e GitHub para versionamento.

## Como executar

Na raiz do projeto, execute:

```bash
docker compose up --build
```

O arquivo `.env` é opcional enquanto o assistente de IA não estiver sendo
utilizado. Para criar uma configuração local, copie o modelo:

```bash
cp .env.example .env
```

Se o Docker apresentar `permission denied` ao acessar `/var/run/docker.sock`,
adicione o usuário ao grupo do Docker e abra uma nova sessão:

```bash
sudo usermod -aG docker $USER
newgrp docker
docker ps
```

Como alternativa temporária, use `sudo docker compose up --build -d`.

Endereços locais:

- Frontend: <http://localhost:5173>
- Backend: <http://localhost:3000>
- Health check: <http://localhost:3000/health>

Para parar os serviços:

```bash
docker compose down
```

Também é possível executar os serviços separadamente:

```bash
cd frontend
npm install
npm run dev
```

Em outro terminal:

```bash
cd backend
npm install
npm run dev
```

## Prioridade atual: MVP

O desenvolvimento deve priorizar o fluxo principal antes de funcionalidades adicionais:

1. Cadastro do cidadão;
2. Login e autenticação;
3. Dashboard do cidadão;
4. Registro de denúncia;
5. Informações de localização;
6. Geração de protocolo;
7. Acompanhamento do status;
8. API integrada ao PostgreSQL usando Prisma;
9. CRUDs de usuários e denúncias;
10. Área administrativa para gerenciamento das denúncias.

## Status atual

Já estão disponíveis:

- tela de login com navegação para o Dashboard;
- tela de cadastro;
- Dashboard inicial do cidadão;
- rotas básicas do frontend;
- backend Express com a rota `/health`;
- estrutura inicial para integração com a API;
- configuração inicial para execução com Docker.

As telas ainda utilizam alguns dados simulados enquanto a autenticação, o banco e os CRUDs são integrados.

## Assistente de IA

O projeto possui uma implementação inicial opcional de um assistente que transforma um relato livre em um rascunho de denúncia. Ele pode sugerir título, categoria, prioridade e resumo.

Essa funcionalidade **não é prioridade do MVP**. Ela deve ser revisada e finalizada somente depois que o fluxo principal estiver funcionando com banco de dados, autenticação e API.

Quando for utilizada, a configuração deverá ser feita no ambiente do backend:

```env
AI_API_KEY=sua-chave
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

Não faça commit do arquivo `.env` nem exponha a chave de API no frontend.

## Próximas etapas técnicas

```text
PostgreSQL com Docker
        ↓
Schema do Prisma e migrations
        ↓
Rotas de cadastro e login
        ↓
Autenticação com JWT
        ↓
Rotas de denúncias
        ↓
Integração do frontend com a API
        ↓
Testes do fluxo completo
        ↓
Assistente de IA como melhoria posterior
```

## Convenção de tarefas

O projeto utiliza comentários que podem ser encontrados pela extensão Todo Tree do VS Code:

```ts
// TODO: tarefa que ainda precisa ser implementada
// FIXME: problema que precisa ser corrigido
// HACK: solução temporária
// NOTE: informação importante
```

## Segurança

- Nunca coloque senhas ou chaves reais no repositório;
- mantenha variáveis sensíveis em arquivos `.env`;
- use `.env.example` para documentar configurações necessárias;
- não use `docker compose down -v` sem confirmar que os dados locais podem ser removidos;
- valide os dados recebidos pela API antes de salvar no banco.
