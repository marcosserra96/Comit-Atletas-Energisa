# Pacote revisado - Atletas Energisa

## Principais melhorias incluídas

### Lançamentos
- Tipo de lançamento com botões: Treino, Evento e Avulso.
- O campo de evento só aparece quando o tipo escolhido é Evento.
- Eventos já lançados são ocultados da lista para reduzir duplicidade.
- Eventos realizados aparecem por até 7 dias.
- Novos lançamentos recebem `loteId`, `tipoLancamento`, `tituloLancamento`, `criadoPor`, `criadoPorNome` e `criadoEm`.

### Extrato
- Nova visão "Por lançamento", agrupando os registros por lote.
- Visão "Auditoria detalhada" preservada, mantendo a tabela antiga.
- Importações via Excel também passam a gerar lote.

### Atletas
- Nova aba "Atletas" no menu principal.
- Cards premium de atleta com pontos, eventos e último lançamento.
- Filtros por busca, equipe e status.
- Busca global de atletas no topo do painel.
- Acesso rápido à ficha clicando no card ou no resultado da busca.

### Fila de espera
- Linhas da fila podem ser arrastadas e soltas para trocar posição.
- A reorganização usa troca de `criadoEm` para preservar compatibilidade com a ordenação atual.

## Arquivos alterados

- `admin.html`
- `css/admin.css`
- `js/admin.js`
- `js/modules/pontuacao.js`

## Observações importantes

- Não alterei as regras do Firebase/Firestore.
- Não implementei ainda o cadastro dinâmico completo de campos customizados, porque isso exige mudança estrutural de dados e tela de configuração própria.
- Antes de colocar em produção, teste com um lançamento real controlado e valide se o extrato agrupado ficou coerente.
