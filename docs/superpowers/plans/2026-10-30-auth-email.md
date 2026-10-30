# Recuperação de senha e notificações por e-mail — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar recuperação segura de senha e notificações transacionais por e-mail no CidUp, com testes determinísticos e configuração SMTP por ambiente.

**Architecture:** Criar um serviço isolado de e-mail com Nodemailer, usando SMTP configurado por variáveis de ambiente e um transporte de teste quando SMTP não estiver configurado. Persistir somente o hash dos tokens de recuperação, com expiração e uso único. Disparar notificações após criação de denúncia e atualização de status sem impedir a resposta principal quando o e-mail falhar.

**Tech Stack:** Express 5, Prisma 6/PostgreSQL, Nodemailer, Node crypto/scrypt, React/Vite/TypeScript, Vitest/Node test runner.

**Spec:** Requisitos fornecidos pelo usuário em 2026-10-30: recuperação de senha com tela, token/link ou código temporário, expiração e nova senha; notificações por e-mail.

## Global Constraints

- Não revelar se um e-mail/CPF existe na solicitação de recuperação.
- Nunca armazenar token de recuperação em texto puro.
- Token deve expirar e ser invalidado após uso.
- E-mails são assíncronos e falha de envio não pode desfazer denúncia ou mudança de status.
- SMTP deve ser configurável por ambiente; testes não podem enviar e-mails reais.
- Segredos e credenciais nunca entram no Git.

## Review Focus

- Solicitação com e-mail inexistente deve retornar a mesma resposta da solicitação válida.
- Token expirado, inválido ou já usado deve ser rejeitado.
- Nova senha deve respeitar a validação atual e substituir o hash antigo.
- Falha no SMTP não pode transformar criação/atualização de denúncia em erro.
- Mudança de status deve gerar no máximo uma notificação por transição.

---

### Task 1: Modelo e serviço de e-mail

**Files:**
- Create: `backend/src/email.ts`
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_add_password_reset_tokens/migration.sql`
- Modify: `backend/.env.example` ou documentação de ambiente existente
- Test: `backend/src/email.test.ts`

**Interfaces:**
- Produces `sendEmail(message)` e `sendPasswordResetEmail(...)`/`sendComplaintStatusEmail(...)`.
- Produces model `password_reset_token` com hash, expiração, uso e usuário.

- [ ] Criar transporte Nodemailer SMTP com `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`; usar transporte de teste/log quando ausentes.
- [ ] Criar helpers que retornem resultado sem expor conteúdo sensível em logs.
- [ ] Adicionar migration/model para token hash, `expires_at`, `used_at`, `created_at`, `id_usuario` e índice de consulta.
- [ ] Cobrir envio capturado em teste e falha controlada.

### Task 2: API de recuperação de senha

**Files:**
- Modify: `backend/src/index.ts`
- Modify: `backend/src/index.test.ts`
- Create: `frontend/src/pages/auth/ForgotPasswordPage.tsx`
- Create: `frontend/src/pages/auth/ResetPasswordPage.tsx`
- Modify: `frontend/src/pages/auth/LoginPage.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- `POST /api/auth/forgot-password` recebe `{ email }` e sempre retorna mensagem genérica.
- `POST /api/auth/reset-password` recebe `{ token, password }`.

- [ ] Gerar token aleatório com `randomBytes`, armazenar somente SHA-256, expirar em 30 minutos e invalidar tokens anteriores do usuário.
- [ ] Enviar link usando `FRONTEND_ORIGINS`/`FRONTEND_URL` e não incluir token em logs.
- [ ] Validar senha entre 6 e 1024 caracteres, marcar token como usado em transação e atualizar hash.
- [ ] Limitar solicitação de recuperação com rate limit específico.
- [ ] Criar tela de solicitação, tela de nova senha e rotas públicas com feedback acessível.
- [ ] Testar sucesso, usuário inexistente, token inválido/expirado/usado e senha inválida.

### Task 3: Notificações de denúncias

**Files:**
- Modify: `backend/src/index.ts`
- Modify: `backend/src/index.test.ts`
- Modify: `backend/src/email.ts`

**Interfaces:**
- `notifyComplaintReceived(complaint)` e `notifyComplaintStatusChanged(complaint, previousStatus)`.

- [ ] Após criar denúncia, notificar cidadão e órgão quando houver e-mail válido.
- [ ] Após atualização real de status, notificar cidadão com protocolo, status e observação disponível.
- [ ] Usar `void`/fila simples com captura de erro para não bloquear a resposta HTTP.
- [ ] Cobrir que a transição dispara mensagem e falha no envio não altera status da API.

### Task 4: Frontend, documentação e verificação

**Files:**
- Modify: `frontend/src/api.ts` se necessário
- Modify: `README.md` ou documentação de deploy
- Test: frontend tests relevantes

- [ ] Confirmar mensagens, loading, estados de sucesso/erro e navegação por teclado.
- [ ] Documentar variáveis SMTP e URL pública do frontend.
- [ ] Rodar `npm test`, `npm run build`, `npx tsc --noEmit` no frontend e `npm test` no backend.
- [ ] Revisar diff para garantir ausência de senhas, tokens, `.env` e artefatos.
- [ ] Commitar em commits atômicos e publicar somente após todos os testes.
