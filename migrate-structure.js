#!/usr/bin/env node

/**
 * Script auxiliar para reorganizar arquivos do CIDUP
 * 
 * Uso:
 *   node migrate-structure.js
 * 
 * Isso irá copiar os arquivos para seus novos locais mantendo os originais
 * Se tudo der certo, você pode deletar os arquivos originais
 */

const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.join(__dirname, 'backend', 'src');
const FRONTEND_ROOT = path.join(__dirname, 'frontend', 'src');

// Mapeamento de movimentações: { origem: destino }
const backendMoves = {
  'auth.ts': 'core/auth/auth.service.ts',
  'email.ts': 'shared/services/email.service.ts',
  'middlewares/authenticate.ts': 'shared/middlewares/authenticate.ts',
  'middlewares/rateLimits.ts': 'shared/middlewares/rateLimits.ts',
  'utils/validation.ts': 'shared/utils/validation.ts',
  'utils/passwords.ts': 'shared/utils/passwords.ts',
  'utils/prismaErrors.ts': 'shared/utils/prismaErrors.ts',
  'utils/aiAddress.ts': 'shared/utils/aiAddress.ts',
  'utils/complaints.ts': 'core/denuncias/complaints.utils.ts',
  'lib/prisma.ts': 'lib/prisma.ts',
  'lib/supabase.ts': 'lib/supabase.ts',
};

const frontendMoves = {
  'api.ts': 'shared/services/api.ts',
  'geocoding.ts': 'shared/services/geocoding.ts',
  'aiComplaintDraft.ts': 'core/denuncias/services/aiComplaintDraft.service.ts',
  'drafts.ts': 'core/drafts/services/drafts.service.ts',
  'components/usuario/': 'core/profile/components/',
};

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✓ Criado diretório: ${path.relative(__dirname, dir)}`);
  }
}

function copyFile(src, dst) {
  const srcPath = path.join(BACKEND_ROOT, src);
  const dstPath = path.join(BACKEND_ROOT, dst);

  if (!fs.existsSync(srcPath)) {
    console.warn(`⚠ Arquivo não encontrado: ${src}`);
    return false;
  }

  ensureDir(dstPath);
  fs.copyFileSync(srcPath, dstPath);
  console.log(`✓ Copiado: ${src} → ${dst}`);
  return true;
}

function copyFrontendFile(src, dst) {
  const srcPath = path.join(FRONTEND_ROOT, src);
  const dstPath = path.join(FRONTEND_ROOT, dst);

  if (!fs.existsSync(srcPath)) {
    console.warn(`⚠ Arquivo não encontrado: ${src}`);
    return false;
  }

  ensureDir(dstPath);
  fs.copyFileSync(srcPath, dstPath);
  console.log(`✓ Copiado: ${src} → ${dst}`);
  return true;
}

console.log('🚀 Iniciando reorganização do CIDUP...\n');

console.log('📦 Backend\n');
let backendCount = 0;
for (const [src, dst] of Object.entries(backendMoves)) {
  if (copyFile(src, dst)) backendCount++;
}
console.log(`\n✅ ${backendCount} arquivos do backend copiados\n`);

console.log('🎨 Frontend\n');
let frontendCount = 0;
for (const [src, dst] of Object.entries(frontendMoves)) {
  if (copyFrontendFile(src, dst)) frontendCount++;
}
console.log(`\n✅ ${frontendCount} arquivos do frontend copiados\n`);

console.log('━'.repeat(60));
console.log('✅ Reorganização concluída!');
console.log('━'.repeat(60));
console.log(`
📝 Próximos passos:

1. ✅ Estrutura de pastas criada
2. ✅ Arquivos copiados para novos locais
3. ⏭️  PRÓXIMO: Atualizar imports nos arquivos (use find/replace)
4. ⏭️  Testar build: npm run build
5. ⏭️  Deletar arquivos originais (se tudo der certo)

Documentação:
  • backend/ORGANIZACAO_BACKEND.md
  • frontend/ORGANIZACAO_FRONTEND.md
  • RESUMO_REORGANIZACAO.md
`);
