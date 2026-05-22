# V19 - Refinamento fino de UX sem esticar telas

Base utilizada: V16.

## Objetivo
Reverter a abordagem da V18 que esticava alguns elementos pela largura da tela e aplicar ajustes mais pontuais.

## Ajustes realizados

- Padronização de altura de inputs/selects em áreas específicas.
- Filtros da aba Atletas deixam de ocupar toda a largura da tela.
- Modal de edição de lançamento mantém tamanho estável ao alternar abas.
- Conteúdo das abas do modal rola internamente.
- Abas do modal e da ficha têm rolagem horizontal quando necessário.
- Campos e botões dentro de modais respeitam o container.
- Ajustes sem alterar regra de negócio.

## Arquivos alterados

- `css/admin.css`
- `js/modules/pontuacao.js`

## Validação

Executado:

```bash
node --check js/admin.js
node --check js/modules/pontuacao.js
node --check js/modules/dashboard.js
```
