# Melhorias UX V14 — Ficha do atleta em abas

## O que mudou

- A ficha do atleta foi reorganizada em abas:
  - Resumo
  - Lançamentos
  - Dados e campos
  - Comentários
  - Auditoria
- O resumo agora concentra KPIs, dados rápidos e controle de status.
- Histórico de lançamentos ficou em aba própria.
- Campos configuráveis da ficha ficaram separados em Dados e campos.
- Comentários ganharam aba própria com formulário fixo no contexto.
- Auditoria relacionada ao atleta ganhou visual dedicado dentro da ficha.

## Arquivos alterados

- admin.html
- css/admin.css
- js/admin.js

## Validação

Executado:

```bash
node --check js/admin.js
node --check js/modules/pontuacao.js
node --check js/modules/dashboard.js
```
