# Melhorias UX V6

## Correção principal

A exportação do Report Oficial foi ajustada para evitar corte lateral no PDF.

O preview em tela continua usando o bloco visual `#pdfPrintArea`, mas a exportação agora cria um clone temporário em largura fixa de 794px, equivalente ao A4 em retrato. Isso evita conflitos do `html2pdf` com medidas em `mm`, overlay, flexbox e margens do navegador.

## Arquivos alterados

- `js/modules/dashboard.js`
- `css/admin.css`

## O que testar

1. Abrir o painel estratégico.
2. Clicar em **Exportar Report Oficial**.
3. Confirmar que o preview aparece normal.
4. Confirmar que o PDF baixado sai em A4 retrato, sem corte lateral.
5. Validar se gráficos e blocos aparecem completos.

## Sugestões para próxima versão

- Reorganizar a página estratégica em uma visão mais orientada à decisão:
  - Resumo executivo
  - Alertas de gestão
  - Evolução e tendências
  - Modalidades
  - Financeiro
  - Ações recomendadas
- Criar cards de alerta para eventos sem lançamento e atletas inativos.
- Adicionar análise de custo por km e custo por participação.
- Adicionar filtro de período na visão estratégica.
