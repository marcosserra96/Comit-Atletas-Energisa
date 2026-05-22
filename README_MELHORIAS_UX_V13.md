# Melhorias UX V13 — Edição completa de lançamentos

Esta versão mantém os ajustes visuais da V12 e adiciona a edição real dos lançamentos no Extrato.

## O que mudou

- O botão **Editar** no card do lançamento agora abre um modal com abas:
  - Dados gerais;
  - Atletas do lote;
  - Adicionar atleta.
- Na edição é possível alterar:
  - descrição;
  - data;
  - KM por atleta.
- Na aba **Atletas do lote**, é possível remover um atleta lançado por engano.
  - O histórico não é apagado.
  - O registro é marcado como `estornado: true`.
  - Os pontos são subtraídos do total do atleta.
  - A remoção exige justificativa.
- Na aba **Adicionar atleta**, é possível incluir um atleta esquecido.
  - O novo registro usa o mesmo `loteId` do lançamento.
  - A inclusão é marcada como `tipoAjuste: "inclusao_posterior"`.
  - Os pontos são adicionados ao total do atleta.
- A auditoria registra:
  - alteração dos dados gerais do lote;
  - atleta removido do lote;
  - atleta adicionado ao lote.
- Corrigido um problema interno que podia duplicar registros no agrupamento do extrato.
- Registros estornados deixam de aparecer nos cards principais do extrato.

## Atenção

Para a auditoria funcionar, as regras do Firestore precisam permitir gravação na coleção `auditoria` para os perfis autorizados.

Para a remoção/adicionar atleta funcionar, as regras precisam permitir atualização em:

- `historico_pontos`
- `atletas`
- `auditoria`

