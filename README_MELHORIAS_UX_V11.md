# Melhorias UX V11

Esta versão refinou os últimos pontos visuais observados no dashboard e na exportação do PDF.

## Ajustes feitos

- Redução dos espaços vazios na Visão Estratégica.
- Remoção do span duplo do card de evolução, que gerava buracos no layout.
- Redução da altura do gráfico principal para equilibrar a página.
- Ajuste dos cards de Engajamento e Performance por modalidade.
- Correção de título duplicado em Radar de Inatividade.
- Refinamento do PDF A4:
  - padding menor;
  - cards internos compactos;
  - página de Modalidades sem estouro lateral;
  - métricas de modalidade em 2 colunas;
  - fontes e tabelas ajustadas para caber melhor.

## Arquivos alterados

- `admin.html`
- `css/admin.css`

## Validação

Executado:

```bash
node --check js/modules/dashboard.js
node --check js/admin.js
node --check js/modules/pontuacao.js
```
