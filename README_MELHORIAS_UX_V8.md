# Melhorias UX V8

Ajustes feitos nesta versão:

- Ações recomendadas agora exibem apenas itens com pendência real.
- Quando não houver pendências, aparece um único card informando que não há ação crítica no momento.
- Botão **Salvar lançamento** agora fica visível na tela de lançamento, mesmo antes da tabela aparecer.
- O botão de salvar fica desabilitado até a equipe ser selecionada e a tabela ser carregada.
- Extrato por lançamento ganhou botão **Editar** em cada lote.
- Edição de lote permite alterar:
  - descrição do lançamento;
  - data;
  - KM por atleta.
- A edição atualiza todos os registros do lote no `historico_pontos`.
- KM editado é aplicado apenas aos registros com pontuação maior que zero, evitando contar KM para falta justificada.
- Mantida a auditoria detalhada e os detalhes por atleta.

Validação realizada:

```bash
node --check js/admin.js
node --check js/modules/dashboard.js
node --check js/modules/pontuacao.js
```

Observação: a edição de lote altera dados gerais do lançamento. Ela não recalcula pontuação individual nem altera regras aplicadas.
