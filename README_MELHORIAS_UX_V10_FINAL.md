# Atletas Energisa — Versão Final V10

## Principais ajustes

- Topo da Visão Estratégica redesenhado com leitura executiva.
- Cards superiores substituídos por Saúde do Programa + KPIs financeiros/operacionais.
- Gráfico de Evolução agora compara Participações, Pontos e KM.
- Donuts de Base Bike/Corrida substituídos por barras de engajamento mais claras.
- Bloco de Força substituído por Performance por Modalidade.
- Report Oficial refeito em páginas A4 controladas:
  - Página 1: Resumo executivo;
  - Página 2: Evolução mensal;
  - Página 3: Modalidades;
  - Página 4: Gestão.
- PDF não depende mais de fatiar uma imagem gigante; cada página é montada separadamente antes da exportação.

## Arquivos alterados nesta versão

- `admin.html`
- `css/admin.css`
- `js/modules/dashboard.js`

## Testes recomendados

1. Abrir Visão Estratégica e conferir os novos blocos.
2. Validar o gráfico de Evolução Mensal.
3. Validar Engajamento por Modalidade.
4. Clicar em Exportar Report Oficial e conferir se o PDF tem 4 páginas.
5. Conferir se nenhuma página do PDF corta bloco no meio.
6. Testar em tema claro e escuro.

## Observação

As bibliotecas `html2canvas` e `jsPDF` ainda dependem de CDN, a menos que sejam baixadas e salvas localmente no projeto. Se a rede bloquear CDN, o PDF pode falhar.
