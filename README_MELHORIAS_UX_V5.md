# Melhorias UX V5 - Atletas Energisa

Esta versão consolida as melhorias visuais e de governança solicitadas.

## Principais ajustes

- Correção do Report Oficial para A4 retrato real, evitando corte lateral.
- Report Oficial reorganizado com leitura executiva, KPIs, KM, participações, pódios, radar de inatividade, últimos lançamentos e próximos eventos.
- Melhoria visual do drag and drop das filas, com alça de arraste, realce de destino e orientação visual.
- Extrato por lançamento com alinhamento refinado dos cards, estatísticas uniformes e detalhes mais organizados.
- Ficha do atleta com histórico de status, incluindo ativações/desativações, data e justificativa.
- Auditoria básica para ações críticas: status do atleta, reorganização de fila, campos configuráveis da ficha e regras de pontuação.
- Campos adicionais continuam seguindo o modelo configurável global em Ajustes > Modelo da ficha do atleta.

## Pontos de atenção

Para auditoria funcionar no Firebase, as regras do Firestore precisam permitir leitura/gravação na coleção:

```text
auditoria
```

Para o modelo dinâmico da ficha funcionar, as regras também precisam permitir a coleção:

```text
campos_ficha
```

## Testes recomendados

1. Abrir o Report Oficial e validar se o PDF sai em A4 retrato sem corte.
2. Arrastar atletas na fila e conferir se a ordem muda corretamente.
3. Desativar e reativar atleta pela ficha, com justificativa.
4. Configurar um campo em Ajustes > Modelo da ficha e preencher na ficha de um atleta.
5. Criar/editar regra de pontuação e validar se aparece apenas nos tipos de lançamento selecionados.
6. Fazer lançamento com KM e conferir ficha, extrato e report.
