# Melhorias UX V4 — Modelo configurável da ficha

## O que mudou nesta versão

- Substitui os campos adicionais livres por atleta por um modelo configurável da ficha.
- Nova área em **Ajustes > Modelo da ficha do atleta**.
- O comitê/admin pode criar campos que aparecem para todos os atletas.
- Tipos disponíveis:
  - Texto
  - Número
  - Data
  - Seleção
  - Sim/Não
- Os campos podem ter grupo, obrigatoriedade e opções.
- A ficha do atleta passa a exibir os campos configurados, permitindo preencher apenas os valores do atleta.
- Os valores são salvos no documento do atleta em `camposFicha`.
- A configuração dos campos é salva na coleção `campos_ficha`.

## Observação importante

As regras do Firestore precisam permitir que administradores/comitê com permissão possam ler e gravar na coleção `campos_ficha`.

Exemplo conceitual de permissão necessária:

- Ler `campos_ficha` para usuários autorizados.
- Criar/editar/excluir `campos_ficha` apenas para admin ou perfil autorizado.

## Validação feita

- `node --check js/admin.js`
- `node --check js/modules/pontuacao.js`
