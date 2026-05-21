# Melhorias UX v3

## Incluído nesta versão

- Drag and drop da fila com visual mais claro: alça, destaque de destino, efeito de arrasto e bloqueio entre filas diferentes.
- Ficha do atleta com toggle de ativação/desativação e justificativa obrigatória para desativar.
- Ficha do atleta com campos adicionais dinâmicos por atleta, salvos em `camposExtras`.
- Regras de pontuação com definição dos tipos de lançamento em que aparecem: Treino, Evento e Avulso.
- Lançamento filtra as regras conforme o tipo escolhido.
- Extrato agrupado com alinhamento visual melhorado nos cards.
- Report oficial reorganizado em A4 retrato, com mais indicadores e melhor aproveitamento de página.
- Report inclui KM total, KM Bike, KM Corrida e participações.

## Observações técnicas

- Os campos adicionais são salvos no documento do atleta em `camposExtras`.
- O status do atleta salva `ativo`, `motivoSaida`, `motivoStatus`, `statusAtualizadoEm` e `statusAtualizadoPor`.
- As regras antigas sem `tiposLancamento` continuam aparecendo em todos os tipos por padrão.
- O report oficial usa `html2pdf` em formato A4 retrato.

## Sugestões para próxima versão

- Auditoria completa de alterações de atleta, fila, regras e permissões.
- Estorno por lote sem apagar histórico.
- Permissões mais granulares para exportar report, alterar regras e desativar atleta.
- Painel de qualidade dos dados: atletas sem localidade, sem data de nascimento, sem campos obrigatórios etc.
