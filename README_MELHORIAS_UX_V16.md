# Melhorias UX V16 — Edição completa de lançamentos

## Foco desta versão

A V16 reforça a edição dos lançamentos no Extrato, deixando mais claro e completo o fluxo de correção de lote.

## Ajustes implementados

- Modal de edição do lançamento ampliado, mais largo e com melhor leitura.
- Abas renomeadas para deixar claro o que cada uma faz:
  - Dados gerais;
  - Remover/validar atletas;
  - Adicionar atleta esquecido.
- Lista de atletas do lote com botão de remoção por atleta.
- Inclusão de atleta esquecido no mesmo lote.
- Estorno de atleta sem apagar histórico.
- Novo botão para estornar o lote inteiro.
- Registro de auditoria para remoção, inclusão, edição de dados gerais e estorno do lote.
- Atualização dos pontos totais dos atletas ao remover, adicionar ou estornar lote.
- Rodapé do modal fixo para não perder os botões principais.
- Modal com altura controlada e rolagem interna.

## Observação importante

Para funcionar em produção, o Firestore precisa permitir:

- update em `historico_pontos`;
- update em `atletas`;
- create em `auditoria`.

