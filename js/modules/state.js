// js/modules/state.js

export const appState = {
  userRole: "atleta",
  userPermissoes: [],
  historicoCompleto: [], 
  historicoFinanceiro: [], 
  mapAtletas: {},        
  gastoTotalGlobal: 0, 
  cacheEventos: [],
  listaTodasRegras: []
};

// Funções utilitárias para atualizar o estado de forma segura, se necessário
export function updateMapAtletas(novoMapa) {
  appState.mapAtletas = novoMapa;
}
