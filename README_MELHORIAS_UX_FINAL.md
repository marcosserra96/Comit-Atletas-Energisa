# Versão final - Melhorias UX, Estratégico e Administração

## Principais ajustes

### Página Estratégica
- Novos KPIs: KM total, participações, custo por participação e custo por km.
- Bloco de **Ações recomendadas** com alertas automáticos:
  - eventos realizados sem lançamento;
  - atletas sem atividade há mais de 30 dias;
  - fila aguardando decisão;
  - regras sem uso;
  - atletas ativos sem histórico.
- Bloco de eficiência para apoiar decisão do comitê.

### Report Oficial A4
- Exportação refeita usando captura direta via `html2canvas` + `jsPDF`.
- Paginação controlada para evitar corte lateral.
- Mantido preview em tela.

### Administração
- Novo **Centro do Admin** em Gestão Base > Dados.
- KPIs de administração: atletas, lançamentos, eventos e auditoria.
- Exportação de backup JSON das principais coleções.
- Auditoria recente em tela.

### Permissões
- Perfis rápidos no modal de permissões:
  - Consulta;
  - Comitê Pontuação;
  - Comitê Financeiro;
  - Comitê Gestão;
  - Comitê Geral.

## Atenção Firestore
Para tudo funcionar, as regras do Firestore precisam permitir leitura/gravação conforme perfil nas coleções:
- `auditoria`
- `campos_ficha`
- `historico_pontos`
- `agenda_eventos`
- `regras_pontuacao`
- `financeiro`

## Arquivos principais alterados
- `admin.html`
- `css/admin.css`
- `js/admin.js`
- `js/modules/dashboard.js`

## Validação realizada
- `node --check js/admin.js`
- `node --check js/modules/dashboard.js`
- `node --check js/modules/pontuacao.js`
- `node --check js/modules/financeiro.js`
- `node --check js/modules/gestao.js`
- `node --check js/modules/ui.js`
