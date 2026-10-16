# React + TypeScript + Vite

Esta base oferece uma configuração mínima para usar React com Vite, atualização instantânea (HMR) e algumas regras do Oxlint.

Atualmente, há dois plugins oficiais disponíveis:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) usa [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) usa [SWC](https://swc.rs/)

## Compilador do React

O compilador do React não está ativado nesta base porque pode afetar o desempenho durante o desenvolvimento e a compilação. Para ativá-lo, consulte [a documentação de instalação](https://react.dev/learn/react-compiler/installation).

## Ampliar a configuração do Oxlint

Para preparar a aplicação para produção, recomendamos ativar regras de análise estática que consideram os tipos. Instale `oxlint-tsgolint` e edite `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

Consulte a [documentação das regras do Oxlint](https://oxc.rs/docs/guide/usage/linter/rules) para ver a lista completa de regras e categorias.
