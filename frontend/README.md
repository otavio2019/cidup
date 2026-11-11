# React + TypeScript + Vite

## Testes do fluxo de denúncia

O envio de uma denúncia é considerado o fluxo mais crítico do frontend porque a validação impede o avanço com dados incompletos. As regras do formulário são testadas em `src/complaintValidation.test.ts`.

| Campo/regra | Classe válida | Classe inválida | Fronteira coberta |
|---|---|---|---|
| Categoria | Uma ou mais ocorrências | Nenhuma ocorrência | Zero / uma ocorrência |
| Descrição | De 20 a 1.000 caracteres | Vazia, com menos de 20 ou mais de 1.000 | 19, 20, 1.000 e 1.001 caracteres |
| Endereço | Texto não vazio | Vazio ou espaços | Vazio / preenchido |
| Número | Número informado ou `S/N` | Vazio; `S/N` sem referência | Número normalizado com espaços e caixa |
| Bairro | Texto não vazio | Vazio ou espaços | Vazio / preenchido |
| Referência | Opcional com número; obrigatória com `S/N` | Ausente com `S/N` | `S/N` sem / com referência |

Casos automatizados e resultados esperados:

| Caso | Entrada | Resultado esperado |
|---|---|---|
| C1 | Todos os dados obrigatórios válidos | Nenhum erro |
| C2 | Categoria ausente | Erro em `type` |
| C3 | Descrição vazia ou com 19 caracteres | Erro de descrição mínima |
| C4 | Descrição com 20 ou 1.000 caracteres | Nenhum erro de descrição |
| C5 | Descrição com 1.001 caracteres | Erro de descrição máxima |
| C6 | Endereço, número ou bairro em branco | Erro no respectivo campo |
| C7 | Número `S/N` sem referência | Erro de referência obrigatória |
| C8 | Número `S/N` com referência | Nenhum erro |
| C9 | Foto com erro de seleção | Erro de foto preservado |

Para executar os testes e gerar o primeiro relatório de cobertura:

```sh
npm test
npm run test:coverage
```

O relatório textual aparece no terminal e a versão HTML é gerada em `coverage/index.html`.

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
