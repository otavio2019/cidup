# Guia de código do CidUp

Este documento explica como o backend, o frontend, o banco e as integrações do CidUp se conectam. Ele acompanha o código atual da branch `main` e serve como índice para futuras alterações.

## Visão geral

O CidUp é uma aplicação web dividida em dois processos:

- `backend/`: API Express em TypeScript, autenticação por sessão JWT em cookie `HttpOnly`, regras de autorização e acesso ao PostgreSQL por Prisma.
- `frontend/`: aplicação React com Vite e TypeScript. As páginas chamam a API por `frontend/src/api.ts` e não acessam o banco diretamente.
- PostgreSQL: persistência dos cidadãos, responsáveis, órgãos, denúncias e históricos, modelada em `backend/prisma/schema.prisma`.
- `docker-compose.yml`: ambiente local com PostgreSQL, Adminer, API e frontend.
- Deploy: `render.yaml` publica a API no Render; `frontend/vercel.json` configura o frontend no Vercel.

O fluxo principal é: cadastro/login → sessão autenticada → criação do relato → localização e foto → revisão → envio → protocolo → histórico e acompanhamento. A área do responsável usa a mesma API, mas recebe o papel `RESPONSIBLE` e acessa todas as denúncias para atualização e relatórios.

## Mapa rápido de arquivos

### Backend

- `backend/src/index.ts`: cria o Express, aplica CORS, cookies, limites, validações e todas as rotas da API.
- `backend/src/auth.ts`: cria e valida o JWT da sessão e acrescenta a identidade autenticada à requisição Express.
- `backend/src/lib/prisma.ts`: instancia o Prisma Client a partir de `DATABASE_URL`.
- `backend/src/lib/supabase.ts`: integração opcional com a API REST do Supabase, usada pela rota de status.
- `backend/src/index.test.ts`: testes de integração da API com delegates do Prisma substituídos por mocks em memória; não representa dados de produção.
- `backend/prisma/schema.prisma`: fonte dos modelos PostgreSQL e dos relacionamentos.
- `backend/prisma/migrations/`: histórico versionado de alterações de banco.
- `backend/scripts/seed-responsavel.ts`: cria ou atualiza a conta administrativa vinculada a um órgão.

### Frontend

- `frontend/src/App.tsx`: guarda de sessão e tabela de rotas.
- `frontend/src/api.ts`: cliente HTTP único, com `credentials: 'include'`, tratamento de JSON e erros.
- `frontend/src/pages/auth/LoginPage.tsx` e `RegisterPage.tsx`: login, cadastro e mensagens de validação.
- `frontend/src/pages/usuario/DashboardPage.tsx`: indicadores do cidadão, denúncias recentes, logout e rascunho opcional por IA.
- `frontend/src/pages/usuario/CreateComplaintPage.tsx`: primeira etapa do formulário e leitura da foto.
- `frontend/src/pages/usuario/ComplaintLocationPage.tsx`: geolocalização, geocodificação reversa e endereço.
- `frontend/src/pages/usuario/ComplaintReviewPage.tsx`: revisão final e envio da denúncia à API.
- `frontend/src/pages/usuario/ComplaintConfirmationPage.tsx`: protocolo e impressão/exportação pelo navegador.
- `frontend/src/pages/usuario/MyComplaintsPage.tsx` e `ComplaintDetailsPage.tsx`: lista, status, linha do tempo e histórico.
- `frontend/src/pages/usuario/ProfilePage.tsx`: leitura/edição do perfil, foto e logout.
- `frontend/src/pages/admin/ResponsiblePanelPage.tsx`: painel, filtros, atualização de status/órgão, observações e relatórios CSV.
- `frontend/src/components/usuario/`: cabeçalhos e navegação móvel compartilhados.

## Autenticação, cadastro e sessão

O formulário de cadastro chama `POST /api/auth/register`. O backend normaliza e valida nome, e-mail, telefone, CPF e CEP, deriva a senha com `scrypt` e grava somente o hash com salt. A resposta seleciona apenas campos públicos.

O login chama `POST /api/auth/login`. O backend procura primeiro a conta de `responsavel` e depois a de `usuario`, verifica o hash e cria um JWT assinado com `AUTH_TOKEN_SECRET`. O token fica no cookie `cidup_session`, marcado como `HttpOnly`, com expiração de 15 minutos. O navegador não recebe o token nem precisa armazená-lo em `localStorage`.

`GET /api/auth/session` reconfirma a sessão no servidor. `App.tsx` usa essa rota nos componentes `ProtectedRoute` e `ResponsibleRoute`, evitando renderizar páginas protegidas apenas por valores antigos do navegador. `POST /api/auth/logout` remove o cookie com os mesmos atributos de segurança. As páginas de painel e perfil limpam também rascunhos locais ao sair.

## Cidadão e perfil

As rotas `/api/users` e `/api/usuarios` usam o ID extraído do cookie, não um cabeçalho enviado pelo cliente. O usuário só consulta ou altera o próprio registro. `ProfilePage` carrega a sessão atual, permite editar nome, telefone, CPF, CEP e foto, converte a foto para Data URL e envia `PATCH /api/users/:id`.

O perfil em `localStorage` é apenas um cache visual de apoio; a identidade e a autorização vêm da sessão da API. Não há senha nem segredo nesse cache.

## Criação, revisão, envio e encaminhamento

O fluxo de denúncia é dividido em três páginas:

1. `CreateComplaintPage` coleta tipo, descrição, endereço, número, bairro, complemento e uma foto opcional de até 2 MB. O rascunho fica em `sessionStorage` entre as etapas.
2. `ComplaintLocationPage` tenta obter coordenadas pelo navegador e consulta o Nominatim/OpenStreetMap para sugerir rua, número e bairro. O cidadão pode corrigir os campos antes de continuar.
3. `ComplaintReviewPage` busca os órgãos públicos, exibe o órgão que provavelmente atenderá o tipo e só chama `POST /api/complaints` depois da confirmação.

A API valida latitude, longitude, texto e Data URL de imagem (`PNG`, `JPEG` ou `WEBP`). A foto é armazenada no campo `denuncia.foto` como texto. No backend, `findOrganizationByComplaintType` normaliza acentos e caixa e aplica regras de palavras-chave para escolher o órgão. Se não houver órgão compatível, a denúncia não é criada e a API responde `503`.

Após a criação, `complaintResponse` adapta os nomes do Prisma para o contrato consumido pelo frontend e cria o protocolo no formato `CIDUP-<id>`. A tela de confirmação guarda o resumo da resposta e permite imprimir ou salvar a página como PDF.

## Histórico e acompanhamento

`GET /api/complaints` lista apenas as denúncias do cidadão; uma sessão de responsável pode consultar todas. `GET /api/complaints/:id` aplica a mesma regra de propriedade. A atualização (`PATCH`) permite ao cidadão alterar seus dados descritivos, mas reserva status e encaminhamento ao responsável. A exclusão é bloqueada quando há histórico vinculado.

As rotas `/api/historicos` fazem o CRUD das observações. Cada consulta verifica se a denúncia pertence à sessão, salvo para responsáveis. O cidadão acompanha status e observações em `MyComplaintsPage` e `ComplaintDetailsPage`, que traduzem os códigos internos (`RECEIVED`, `IN_ANALYSIS`, etc.) para rótulos em português e montam a linha do tempo.

## Painel do responsável e relatórios

`ResponsiblePanelPage` carrega em paralelo denúncias, órgãos e sessão por `Promise.all`. O middleware `requireAdministrator` só libera a área para o principal `RESPONSIBLE`, criado pelo seed e vinculado a um órgão.

O painel filtra por protocolo, texto, status e mês; calcula contagens por status e categoria; mostra detalhes e fotos; e salva alterações em `PATCH /api/complaints/:id`. Observações são persistidas por `POST /api/historicos`. O relatório é gerado no navegador em CSV a partir dos registros carregados da API, sem dataset demonstrativo ou acesso direto ao banco.

## API e contratos

O backend mantém aliases em português e inglês para compatibilidade (`/api/denuncias` e `/api/complaints`, por exemplo). `apiRequest` centraliza o prefixo da API, envia cookies de sessão, interpreta respostas `204` e transforma erros HTTP em `Error` para os componentes.

As rotas públicas são `/health`, leitura pública de órgãos e login/cadastro. As demais rotas exigem o cookie assinado. CORS aceita somente origens em `FRONTEND_ORIGINS`, a API não permite cache em `/api`, há limite de tentativas de autenticação e o middleware de erro evita devolver detalhes do Prisma ou de integrações externas.

A rota opcional `POST /api/ai/complaint-draft` envia um relato autenticado ao endpoint compatível com OpenAI configurado por `AI_BASE_URL`, `AI_MODEL` e `AI_API_KEY`. Ela produz somente um rascunho; não cria nem envia uma denúncia automaticamente. Sem chave configurada, responde `503` e o fluxo principal continua disponível.

## Prisma e PostgreSQL

`schema.prisma` usa o provider PostgreSQL e separa `DATABASE_URL` (runtime) de `DIRECT_URL` (migrações). Os modelos principais são:

- `usuario`: cidadãos e seus dados de perfil;
- `responsavel`: conta administrativa ligada a `orgao`;
- `orgao`: órgão que recebe denúncias;
- `denuncia`: ocorrência, uma ou mais categorias, localização, foto, status, cidadão, órgão principal e órgãos extras; mantém também a data da última atualização;
- `historico`: observações vinculadas à denúncia e ao usuário ou responsável que as registrou, com data de criação.

A rota autenticada `GET /api/complaints/:id/related` sugere até dez denúncias que compartilham categoria e estão a no máximo 50 metros; cada denúncia conserva seu próprio protocolo. O CSV do painel do responsável usa os dados da resposta de `/api/complaints`, incluindo dados do cidadão, coordenadas, categorias, histórico, última atualização e foto.

O Prisma Client é gerado durante o desenvolvimento/deploy e instanciado uma vez em `lib/prisma.ts`. As migrations devem ser revisadas antes de aplicar em um banco existente. Os testes de `index.test.ts` usam mocks para exercitar autorização e contratos sem depender de PostgreSQL real.

## Execução, deploy e integrações

No Docker Compose, PostgreSQL fica em `db`, Adminer em `localhost:8081`, a API em `localhost:3001` e o Vite em `localhost:5173`. O backend recebe `DOCKER_DATABASE_URL`; quando executado no host, usa `DATABASE_URL`.

No deploy, o Render executa `npm ci && npx prisma generate`, inicia `npm run start` e verifica `/health`. O Vercel publica a pasta `frontend/`; `frontend/vercel.json` mantém o fallback das rotas React. Com domínios separados em produção, `VITE_API_URL` aponta para a API HTTPS e o cookie usa `SameSite=None` e `Secure`.

A integração Supabase é opcional: `SUPABASE_URL` e `SUPABASE_KEY` habilitam `supabaseRequest` e `GET /api/supabase/status`; o PostgreSQL continua sendo acessado pelo Prisma. A geocodificação usa Nominatim/OpenStreetMap diretamente do navegador. Nenhum `.env`, segredo, arquivo gerado, `node_modules` ou `dist` pertence à documentação versionada.

## Validações recomendadas

```bash
cd backend
npx prisma validate
npx prisma generate
npx tsc --noEmit
npm test

cd ../frontend
npm run lint
npm test
npm run build
```
