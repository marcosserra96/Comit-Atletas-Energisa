# Design System — Atletas Energisa

> **Fonte da verdade:** os tokens vivem em `src/app/globals.css` e os componentes em
> `src/components/ui/`. Este arquivo descreve o sistema que existe no código. Se os dois
> divergirem, o código vale, e este arquivo precisa ser atualizado no mesmo PR.

**Produto:** portal interno do programa de atletas Energisa (corrida e bike). Três perfis:
atleta, comitê e administrador. É uma ferramenta corporativa de uso recorrente, não uma
landing page: clareza e consistência valem mais que novidade visual.

---

## Cores

Use sempre os tokens (classes Tailwind geradas a partir deles). Nunca escreva hexadecimais
em componentes.

### Marca (configurável pelo administrador)

As cores de marca podem ser trocadas em **Configurar portal → Identidade visual**.
O `src/lib/branding.ts` ajusta cada cor automaticamente para contraste AA (≥ 4,5:1)
e publica duas variações, `--brand-*-light` e `--brand-*-dark`. O `globals.css` usa a
certa para cada tema.

| Token (classe) | Uso | Padrão claro | Padrão escuro |
|---|---|---|---|
| `primary` | Ações principais, links, item ativo | `#007591` (marca `#009bc1`) | `#009bc1` |
| `secondary` | Destaques positivos da marca | `#007c57` (marca `#00b37e`) | `#00b37e` |
| `accent` | Destaque secundário (laranja) | `#af5119` (marca `#f37021`) | `#f37021` |
| `danger` | Erros e ações destrutivas | `#cc333d` (marca `#e63946`) | `#e84551` |

`*-hover` é derivado automaticamente (`color-mix` com preto). `*-subtle` são fundos
translúcidos para selos e ícones.

**Texto sobre fundo colorido:** use `text-on-primary`, `text-on-danger` etc., nunca
`text-white`. No tema claro é branco; no escuro, azul-marinho, porque ali as cores de marca
ficam claras demais para texto branco.

**Superfícies sempre escuras** (menu lateral, barra do topo da gestão, abertura, faixa de
boas-vindas do Início, painel do login): adicione a classe `superficie-escura`. Ela troca as
cores de marca pelas variantes claras e ajusta os `on-*`, para que links e botões continuem
legíveis também no tema claro.

### Status (fixos)
`success` `#15803d` · `warning` `#b45309` · `info` `#2563eb`. No tema escuro:
`#22c55e` · `#f1c40f` · `#60a5fa`.

### Texto
| Token | Uso | Claro | Escuro |
|---|---|---|---|
| `text-text` | Títulos e texto principal | `#1a202c` | `#e8eaf0` |
| `text-text-secondary` | Subtítulos e parágrafos | `#475569` | `#b0b8cc` |
| `text-text-light` | Descrições, metadados | `#526074` | `#a0a8c0` |
| `text-text-muted` | Rótulos pequenos, placeholders, ícones | `#5b6b80` | `#868ea9` |

Todos passam 4,5:1 sobre o fundo da página. **Não crie tons de cinza mais claros para
texto.** Para hierarquia, use tamanho e peso, não cores mais apagadas.

### Superfícies e bordas
`bg-bg` (página) · `bg-bg-card` (cards) · `bg-bg-elevated` · `bg-bg-subtle` · `bg-bg-inset`
(áreas rebaixadas, campos). Bordas: `border-border`, `border-border-subtle`,
`border-border-strong`.

### Modalidades e ranking
`sport-running` / `sport-cycling` (+ `-subtle`). Ouro, prata e bronze: `ranking-gold|silver|bronze`
(+ `-bg`, `-text`).

---

## Tipografia

- **Fonte:** Inter (`next/font`), pesos 400–800. Não há fonte de títulos separada.
- **Escala:** `text-xs` 12 · `text-sm` 13 · `text-base` 14 · `text-md` 15 · `text-lg` 17 ·
  `text-xl` 20 · `text-2xl` 24 · `text-3xl` 30 · `text-4xl` 36.
- **Título de página:** um único `<h1>` por página (`PageHeader` no atleta). A barra do topo
  mostra o nome da página só depois que o `<h1>` sai da tela, para não repetir o título.
- **Números:** use `tabular-nums` em métricas, tabelas e rankings.
- **Tamanho mínimo:** 12px para texto que precisa ser lido. Evite `text-[10px]`/`text-[11px]`.
- **Maiúsculas:** só a primeira letra da frase ("Dados pessoais", não "Dados Pessoais").

---

## Padrões de página

- **Cabeçalho:** título e descrição à esquerda; a ação principal da página fica à direita,
  na mesma linha (quebra para baixo no celular).
- **Cards de ação:** ações secundárias ficam num rodapé com `ghost`, separadas por uma borda,
  sem quebra de linha no texto do botão.
- **Números em painéis:** sem bordas coloridas competindo. Destaque vem de tamanho e peso.
- **Celular:** tabelas largas viram um card por item (`md:hidden` / `hidden md:block`).

---

## Aderência e informativo

- **Aderência** (`src/lib/aderencia.ts`): treinos feitos ÷ treinos previstos na agenda
  (`configuracoes/dias_treino`, editada em Critérios), até hoje, sem as datas sem treino e sem
  as faltas justificadas; teto de 100%. Sem agenda, mostra "—". Use sempre essas funções.
  O histórico mensal aceita uma aderência informada (0–100) que substitui o cálculo naquele mês;
  em períodos de vários meses, um mês informado sem agenda pesa como um mês comum. Quando o
  resultado inclui valor informado (`informada`), não mostre "X de Y treinos previstos".
- **O que é treino**: atividade (atleta + dia + lote, `consolidarAtividades`) lançada como Treino
  ou de critério que conta como treino (`regraContaComoTreino`: marcação "Conta como treino" no
  critério; sem marcação, tipo Treino ou "treino" no nome). Toda contagem de treinos e aderência
  passa `regrasTreino` (`useRegrasDeTreino` no cliente, `carregarRegrasDeTreino` no servidor).
- **Ranking do atleta**: abre em "Mensal" no mês atual (horário de Brasília), com navegador
  ‹ mês › até `mesesDesde`; Geral e trimestre continuam. Resultados mensais ficam em
  `ranking_resultados` com `periodoId: "mes"` e `competencia`, só de quem pontuou no mês.
- **Informativo** (`/gestao/informativo`): arte gerada em código (`ArteInformativo`), em 1920×1080
  ou 1080×1920, exportada em PNG. Posição só por pontos, empates dividem a colocação e a
  contagem segue sem pular — 1º, 1º, 2º, 3º (`calcularPosicoesRanking`); ninguém fica de fora e todo informativo fecha com o mesmo
  resumo do período (`ResumoPeriodo`), igual para Corrida e Bike. A arte
  usa cores fixas e as fontes Barlow / Barlow Condensed, independentes do tema do portal.

---

## Celular

- **Navegação:** barra inferior nas duas áreas (`MobileBottomNav`; na gestão, 4 atalhos pelas
  permissões + "Menu"). O menu lateral fecha tocando fora, com Esc ou arrastando para a
  esquerda, e tem no rodapé quem está logado, o tema e o **Sair** (que sai do topo no celular).
- **Toque:** alvo mínimo de 44px. Em botões pequenos use `pointer-coarse:` para crescer só em
  tela de toque.
- **Janelas:** `Modal mobileSheet` sobe de baixo, tem alça e fecha arrastando para baixo.
- **Barras fixas de ação** (ex.: Salvar lançamento) ficam acima da barra inferior:
  `bottom-[calc(4.5rem+env(safe-area-inset-bottom))]`.
- **Tabelas:** no celular viram lista (uma linha por item, valor à direita). Nada de tabela
  com rolagem lateral para dados principais.
- **Listas longas:** agrupe por mês com cabeçalho fixo e use "Mostrar mais".

---

## Espaçamento, raios e sombras

- Espaçamento em múltiplos de 4px (escala Tailwind).
- Raios: `--radius-sm` 6 · `--radius` 10 (botões, campos) · `--radius-lg` 14 (cards) ·
  `--radius-xl` 20 · `--radius-2xl` 28 (sheets no celular).
- Sombras: `--shadow-card` (cards) · `--shadow-elevated` (popovers, toasts) · `--shadow-modal`.

---

## Componentes (`src/components/ui/`)

Antes de criar qualquer elemento de interface, procure aqui. Não duplique.

| Componente | Quando usar |
|---|---|
| `Button` | Toda ação. Variantes: `primary` (uma por área), `secondary`, `outline`, `ghost`, `danger`. |
| `TextField`, `Select` | Campos de formulário (label associado, erro com `role="alert"`). |
| `Card`, `MetricCard`, `SectionHeader`, `PageHeader` | Estrutura de páginas. |
| `Modal`, `ConfirmActionModal`, `ConfirmarPerigoModal` | Diálogos. Não crie diálogos do zero: reaproveite o `Modal` (foco inicial, Esc e Tab preso já vêm prontos). |
| `SubTabs` + `TabPanel` | Seções de uma página (abas sublinhadas, com rolagem lateral no celular). Passe `label` para leitores de tela. |
| `SegmentedControl` | Filtro curto de 2 a 4 opções dentro de uma seção (ex.: Corrida / Bike, Claro / Escuro). |
| `Badge`, `SportBadge`, `RankingPosition`, `TrendIndicator` | Selos e indicadores. |
| `PainelNumeros` | Faixa de números no topo de uma tela (um card, células separadas por linha fina). `emLinhasNoCelular` para valores longos, como reais. Não use cards coloridos empilhados. |
| `EmptyState`, `Skeleton`, `InlineAlert`, `Toast` | Estados vazio, carregando, erro e confirmação. |
| `MenuAcoes` | Botão "⋯" com as ações de um item (editar, estornar, excluir). Ações de perigo ficam em vermelho, separadas. Use em listas para não repetir botões em cada linha. |
| `Switch` | Liga/desliga com área de toque de 44px (preferências, seções de um roteiro). |

---

## Textos e formatação

- **Nomes de modalidade:** sempre por `modalidadeLabel` / `equipeLabel` (`src/lib/labels.ts`).
  O nome oficial é **Corrida** e **Bike**.
- **Nomes de telas:** o item do menu, o título no topo e o título da página usam o mesmo nome.
- **Números:** `formatPontos`, `formatKm`/`formatDistancia`, `formatNumero` e `formatBRL`
  (`src/lib/format.ts`). **Pontos são sempre inteiros** ("25", "1.250"); **km tem até 2 casas**,
  sem zeros sobrando ("10 km", "12,35 km"), o que também limpa somas como 5,2 + 3,1. Campos
  de pontos aceitam só inteiros. Nunca mostre o número cru nem use `toFixed` (ponto decimal).
- **Plural:** `plural(n, "treino")` → "1 treino" / "3 treinos". Nunca "treino(s)".
- **Linguagem:** direta e sem jargão técnico. Mensagens de erro dizem o que aconteceu e o
  que fazer.

---

## Movimento

- Anime só `transform` e `opacity`. Nunca use `transition-all`: nomeie as propriedades.
- Durações de interface entre 150 e 250ms. Entradas usam ease-out. Nada começa em `scale(0)`.
- Ações de teclado ou repetidas dezenas de vezes por dia não são animadas.
- Botões respondem ao toque (`active:scale-[0.97]`, já embutido no `Button`).
- Seleção que muda de lugar (barra inferior, `SegmentedControl`) desliza com `layoutId` e mola
  curta, em vez de pular. Troca de tela: entrada de 200ms (`EntradaDePagina`).
- `cn()` usa tailwind-merge: a classe passada pela tela vence a padrão do componente.
- **Reduzir movimento:** o `<MotionProvider>` (framer-motion) e o `globals.css` já tratam
  isso. Deslocamentos ficam instantâneos e os fades continuam. Não desligue essa proteção.

---

## Checklist antes de entregar

- [ ] Usa só tokens e componentes existentes.
- [ ] Contraste ≥ 4,5:1 (texto) nos temas claro e escuro.
- [ ] Sem rolagem horizontal em 390px de largura. Tabelas largas rolam dentro do próprio card.
- [ ] Alvos de toque ≥ 44×44px no celular.
- [ ] Estados de carregamento, vazio e erro presentes.
- [ ] Foco visível e navegação por teclado (Tab, Esc) funcionando.
- [ ] Números no padrão pt-BR e plurais corretos.
