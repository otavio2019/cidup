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

Para iniciar o ambiente Docker, crie o arquivo `.env` a partir do modelo e
execute:

```bash
cp .env.example .env
docker compose up --build
```

No PowerShell, o equivalente é:

```powershell
Copy-Item .env.example .env
docker compose up --build -d
```

O modelo já contém valores para desenvolvimento local. Se você alterá-los,
mantenha a mesma senha em `POSTGRES_PASSWORD`, `DATABASE_URL` e
`DOCKER_DATABASE_URL`. `DATABASE_URL` é usada quando o backend roda no host;
o Compose usa `DOCKER_DATABASE_URL` para acessar o serviço PostgreSQL pela
rede Docker. Não reutilize senhas reais em arquivos versionados.

Se estiver rodando a API diretamente em `backend/`, copie
`backend/.env.example` para `backend/.env` e configure a URL PostgreSQL local.
Ao iniciar a API com `npm run dev`, o Prisma Client é gerado. Migrações não são
aplicadas automaticamente: revise-as e execute os comandos do Prisma
explicitamente para evitar alterações inesperadas no banco.

Configure `AUTH_TOKEN_SECRET` com um segredo aleatório de pelo menos 32 bytes.
Gere-o localmente com `openssl rand -base64 32`; não o compartilhe nem o
versione. `FRONTEND_ORIGINS` lista origens permitidas separadas por vírgula.
Responsáveis autenticados pela tabela `responsavel` podem administrar órgãos e
gerenciar denúncias. Em produção, configure somente origens HTTPS e publique a
API atrás de HTTPS. As sessões são cookies `HttpOnly`, assinados e expiram em
15 minutos; o navegador não recebe nem armazena o token. Se frontend e API
forem publicados em origens diferentes, configure `VITE_API_URL` no ambiente
do frontend com a URL HTTPS da API; sem essa variável, a aplicação usa a API
na mesma origem em produção.

A conta única do responsável é criada pelo seed do backend. Defina
`RESPONSAVEL_NAME`, `RESPONSAVEL_EMAIL`, `RESPONSAVEL_PHONE`,
`RESPONSAVEL_PASSWORD` e `RESPONSAVEL_ORGAO_ID` no `.env` e execute:

```bash
cd backend
npm run seed:responsavel
```

O seed é idempotente: pode ser executado novamente para atualizar a conta sem
criar duplicatas. A rota `/api/auth/login` aceita cidadãos e responsáveis; a
sessão retorna `role: RESPONSIBLE` para a conta cadastrada na tabela
`responsavel`.

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
- Adminer (interface web do banco): <http://localhost:8081>
- Backend: <http://localhost:3001> (porta do host configurável via `BACKEND_HOST_PORT`)
- Verificação de saúde da API: <http://localhost:3001/health>

### Publicação rápida do MVP

Para publicar o MVP sem adaptar o Express para funções serverless, use:

```text
Supabase → PostgreSQL
Render   → backend Express
Vercel  → frontend React
```

O arquivo `render.yaml` já contém a configuração do serviço da API. No Render,
configure `DATABASE_URL` e `DIRECT_URL` com as URLs do Supabase, `FRONTEND_ORIGINS`
com a URL HTTPS da Vercel e as variáveis da conta do responsável. O Render executa
`npx prisma generate` no build e inicia a API com `npm run start`.

As migrations do schema inicial devem ser aplicadas no projeto Supabase antes do
primeiro deploy. Não execute `prisma migrate deploy` nesse banco já provisionado
sem antes registrar as migrations no histórico interno do Prisma, pois isso pode
tentar recriar tabelas existentes.

No projeto da Vercel, use `frontend/` como diretório raiz. O arquivo
`frontend/vercel.json` configura o build do Vite e o fallback das rotas do React.
Configure `VITE_API_URL` com a URL HTTPS do backend no Render.

Depois do primeiro deploy, execute o seed do responsável uma vez usando as mesmas
variáveis de produção:

```bash
cd backend
npm run seed:responsavel
```

O cookie de sessão usa `SameSite=None` e `Secure` quando `NODE_ENV=production`,
permitindo o login entre os domínios separados da Vercel e do Render.

### Acessar o banco de dados

Com os serviços iniciados pelo Docker Compose, abra o Adminer em
<http://localhost:8081> e informe:

- Sistema: PostgreSQL;
- Servidor: `db`;
- Usuário: `cidup`;
- Senha: valor de `POSTGRES_PASSWORD` no arquivo `.env`;
- Banco de dados: `cidup`.

O arquivo `.env.example` é apenas um modelo; o Compose lê os valores do `.env`.
Não abra `http://localhost:5433` no navegador: essa porta fala o protocolo do
PostgreSQL, não HTTP. Para conectar por DBeaver ou outro cliente PostgreSQL,
use host `localhost`, porta `5433`, banco `cidup`, usuário `cidup` e a mesma
senha de `POSTGRES_PASSWORD`.

Também é possível acessar o banco pelo terminal:

```bash
docker compose exec db psql -U cidup -d cidup
```

No prompt do `psql`, use `\dt` para listar as tabelas e `\q` para sair.
Se a autenticação falhar após alterar `POSTGRES_PASSWORD`, lembre-se de que a
variável só define a senha quando o volume do banco é inicializado. Em um volume
existente, atualize a senha do usuário `cidup` dentro do PostgreSQL para que
coincida com o valor atual do `.env` usando `ALTER ROLE cidup WITH PASSWORD
'SENHA_DO_ENV';` e substituindo `SENHA_DO_ENV` pelo valor de
`POSTGRES_PASSWORD`. Mantenha a mesma senha nas URLs `DATABASE_URL` e
`DOCKER_DATABASE_URL`.

### Supabase com Prisma

O backend usa Prisma ORM 6.19.3 e o PostgreSQL padrão do Prisma Client; não
precisa instalar adaptador PostgreSQL. `DATABASE_URL` é a conexão usada em
tempo de execução e `DIRECT_URL` é usada pelo Prisma Migrate para migrações.
No Prisma 6, essa separação é declarada por `directUrl` no `schema.prisma`.

O `backend/.env.example` mantém o PostgreSQL local como padrão e inclui um
exemplo comentado de conexão Supabase para redes IPv4. Para usá-lo, copie as
URLs para `backend/.env`, substitua `[YOUR-PASSWORD]` localmente e não versione
o arquivo `.env`.

Obtenha as strings no painel do projeto Supabase: **Connect** → selecione o
método de conexão → copie a connection string. Use a conexão direta para
`DIRECT_URL` quando a rede do backend suportar IPv6 (ou o adicional IPv4 do
Supabase). Se a rede for somente IPv4, escolha **Session pooler** para o
backend e para a CLI, conforme a disponibilidade de rede. O Supabase recomenda
a conexão direta para migrações; não use o transaction pooler para migrações.
Consulte também a documentação oficial do [Supabase para conexões PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres)
e do [Prisma ORM 6 com Supabase](https://www.prisma.io/docs/orm/v6/overview/databases/supabase).
Substitua `[YOUR-PASSWORD]` no seu arquivo local `.env`/`backend/.env` e faça
percent-encoding de caracteres reservados na senha. Nunca cole a senha no chat
nem a versione.

- Backend executado no host: configure `DATABASE_URL` e `DIRECT_URL` em
  `backend/.env`.
- Backend executado pelo Compose: configure `DOCKER_DATABASE_URL` com a URL de
  runtime e `DIRECT_URL` no `.env` da raiz. O Compose mantém a conexão no
  backend; nenhuma URL de banco é enviada ao frontend.

Antes de sincronizar o Prisma com um projeto Supabase existente, confira no
painel ou no SQL Editor quais tabelas e dados existem. Uma consulta somente de
leitura para listar tabelas públicas é:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

Se o Supabase já tiver estrutura, `npx prisma db pull` faz introspecção:
consulta o banco e atualiza o schema local, sem alterar tabelas nem dados. Esse
comando usa `DATABASE_URL`; para executá-lo, configure-a temporariamente com
uma conexão direta ou Session pooler e depois restaure a URL de runtime. Faça
uma cópia de `prisma/schema.prisma` antes se quiser preservar a versão atual.
Depois, `npx prisma generate` gera o Prisma Client a partir do schema local;
não acessa nem modifica os dados do banco. Migrações são diferentes: `migrate
dev` cria e aplica migrações em um banco de desenvolvimento e `migrate deploy`
aplica migrações pendentes no banco configurado. Revise as migrações e confirme
o destino antes de executar qualquer um desses comandos no Supabase.

Com as variáveis configuradas, estes comandos validam e geram o cliente sem
aplicar migrações:

```bash
cd backend
npx prisma validate
npx prisma generate
```

Para testar a conexão com uma leitura sem alterar dados:

```bash
npx tsx -e 'import "dotenv/config"; import { prisma } from "./src/lib/prisma.ts"; void (async () => { try { console.log(await prisma.$queryRaw`SELECT 1`); } finally { await prisma.$disconnect(); } })()'
```

O cliente reutilizável já está em `src/lib/prisma.ts` e deve ser importado
somente pelo backend. Exemplo: `await prisma.usuario.findMany({ take: 10 })`.

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

- tela de acesso com navegação para o painel;
- tela de cadastro;
- painel inicial do cidadão;
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

Não faça commit do arquivo `.env` nem exponha a chave de API no frontend. A rota
de rascunho exige uma sessão válida.

## Próximas etapas técnicas

```text
PostgreSQL com Docker
        ↓
Schema do Prisma e migrations
        ↓
Rotas de cadastro e login
        ↓
Sessão JWT em cookie HttpOnly
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
- não confie em `x-user-id`; a identidade da API vem da sessão assinada;
- cadastros e consultas de perfil são restritos ao usuário autenticado;
- leituras de órgãos mostram somente dados públicos; escrita administrativa
  depende de uma sessão autenticada de responsável;
- use `.env.example` para documentar configurações necessárias;
- não use `docker compose down -v` sem confirmar que os dados locais podem ser removidos;
- valide os dados recebidos pela API antes de salvar no banco.

## Acesso do responsável

O acesso administrativo usa a tabela `responsavel`, vinculada a um órgão, e não
aceita IDs administrativos configurados manualmente. Crie ou atualize a conta
única com `npm run seed:responsavel` e use o e-mail e a senha configurados para
entrar pelo mesmo endpoint de login dos cidadãos. A sessão assinada retorna
`role: RESPONSIBLE`; o navegador não pode escolher esse papel.
