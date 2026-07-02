// =====================================================
// js/modules/diagnostico.js — Diagnóstico de Usuários
// =====================================================
import {
  db, functions,
  collection, getDocs, doc, updateDoc,
  httpsCallable
} from '../firebase.js';
import { showToast } from './ui.js';

const fnAuditar       = httpsCallable(functions, 'auditarUsuarios');
const fnListarFS      = httpsCallable(functions, 'listarFirestoreUsuarios');
const fnAtualizarPerfil = httpsCallable(functions, 'alterarPerfilUsuario');
const fnReconstruir   = httpsCallable(functions, 'reconstruirCadastro');
const fnExcluirFS     = httpsCallable(functions, 'excluirFirestoreUsuario');
const fnExcluirAuth   = httpsCallable(functions, 'excluirAuthUsuario');

const ROLES_VALIDOS = ['admin', 'comite', 'atleta'];
const STATUS_VALIDOS = ['Aprovado', 'Pendente', 'Inativo'];

// ── Detecta problemas de um usuário Firestore ───────────────────────────────
function detectarProblemas(u, noAuth = false) {
  const problemas = [];

  if (noAuth) problemas.push({ tipo: 'sem_auth', label: 'Sem conta Auth', severidade: 'err' });
  if (!u.role || !ROLES_VALIDOS.includes(u.role)) problemas.push({ tipo: 'role_invalida', label: `Role inválida: "${u.role || '—'}"`, severidade: 'err' });
  if (!u.nome?.trim()) problemas.push({ tipo: 'sem_nome', label: 'Sem nome', severidade: 'warn' });
  if (!u.email?.trim()) problemas.push({ tipo: 'sem_email', label: 'Sem e-mail', severidade: 'warn' });
  if (u.role === 'comite' && u.status === 'Pendente') problemas.push({ tipo: 'pendente', label: 'Acesso pendente de aprovação', severidade: 'warn' });
  if (u.role === 'atleta' && u.status !== 'Aprovado') problemas.push({ tipo: 'atleta_inativo', label: `Status: ${u.status}`, severidade: 'warn' });

  return problemas;
}

// ── Renderiza a tabela de resultados ────────────────────────────────────────
function renderTabela(authSemFS, firestoreSemAuth, fsUsers) {
  const container = document.getElementById('diagTabela');
  if (!container) return;

  // Problemas: Auth sem Firestore
  const linhasAuthSemFS = authSemFS.map(u => ({
    uid: u.uid,
    nome: u.displayName || '—',
    email: u.email || '—',
    role: '—',
    status: '—',
    problemas: [{ tipo: 'sem_doc', label: 'Sem documento Firestore', severidade: 'err' }],
    origem: 'auth'
  }));

  // Problemas: Firestore sem Auth
  const linhasFSSemAuth = firestoreSemAuth.map(u => ({
    uid: u.uid,
    nome: u.nome || '—',
    email: u.email || '—',
    role: u.role || '—',
    status: u.status || '—',
    problemas: [{ tipo: 'sem_auth', label: 'Sem conta Auth', severidade: 'err' }],
    origem: 'firestore'
  }));

  // Problemas: usuários integrados mas com campos errados
  const authUids = new Set(authSemFS.map(u => u.uid));
  const firestoreSemAuthUids = new Set(firestoreSemAuth.map(u => u.uid));
  const linhasProblemas = fsUsers
    .filter(u => !firestoreSemAuthUids.has(u.uid))
    .map(u => ({
      uid: u.uid,
      nome: u.nome || '—',
      email: u.email || '—',
      role: u.role || '—',
      status: u.status || '—',
      problemas: detectarProblemas(u, false),
      origem: 'integrado'
    }))
    .filter(u => u.problemas.length > 0);

  const todos = [...linhasAuthSemFS, ...linhasFSSemAuth, ...linhasProblemas];

  const totalEl = document.getElementById('diagTotalProblemas');
  const semProblemasEl = document.getElementById('diagSemProblemas');
  const tabelaWrap = document.getElementById('diagTabelaWrap');

  if (totalEl) totalEl.textContent = todos.length;

  if (todos.length === 0) {
    if (semProblemasEl) semProblemasEl.style.display = 'flex';
    if (tabelaWrap) tabelaWrap.style.display = 'none';
    return;
  }

  if (semProblemasEl) semProblemasEl.style.display = 'none';
  if (tabelaWrap) tabelaWrap.style.display = 'block';

  container.innerHTML = todos.map(u => {
    const badgesProb = u.problemas.map(p =>
      `<span class="diag-badge diag-badge--${p.severidade}">${p.label}</span>`
    ).join('');

    const acoes = buildAcoes(u);

    return `
      <tr data-uid="${u.uid}" data-origem="${u.origem}">
        <td>
          <div class="diag-user-cell">
            <span class="diag-user-name">${esc(u.nome)}</span>
            <span class="diag-user-email">${esc(u.email)}</span>
          </div>
        </td>
        <td>${roleBadge(u.role)}</td>
        <td><div class="diag-badges">${badgesProb}</div></td>
        <td><div class="diag-acoes">${acoes}</div></td>
      </tr>`;
  }).join('');

  // Bind action buttons
  container.querySelectorAll('[data-acao]').forEach(btn => {
    btn.addEventListener('click', () => handleAcao(btn));
  });
}

function buildAcoes(u) {
  const btns = [];

  const temSemDoc = u.problemas.some(p => p.tipo === 'sem_doc');
  const temSemAuth = u.problemas.some(p => p.tipo === 'sem_auth');
  const temPendente = u.problemas.some(p => p.tipo === 'pendente');
  const temRoleInvalida = u.problemas.some(p => p.tipo === 'role_invalida');

  if (temSemDoc) {
    btns.push(`<button class="diag-btn diag-btn--blue" data-acao="reconstruir" data-uid="${u.uid}" data-email="${u.email}" data-nome="${u.nome}" title="Criar documento Firestore">Criar doc</button>`);
    btns.push(`<button class="diag-btn diag-btn--red" data-acao="excluir_auth" data-uid="${u.uid}" title="Remover do Firebase Auth">Remover Auth</button>`);
  }
  if (temSemAuth) {
    btns.push(`<button class="diag-btn diag-btn--red" data-acao="excluir_fs" data-uid="${u.uid}" title="Remover documento Firestore">Remover doc</button>`);
  }
  if (temPendente) {
    btns.push(`<button class="diag-btn diag-btn--green" data-acao="aprovar" data-uid="${u.uid}" title="Aprovar acesso">Aprovar</button>`);
    btns.push(`<button class="diag-btn diag-btn--red" data-acao="excluir_fs" data-uid="${u.uid}" title="Rejeitar e remover">Rejeitar</button>`);
  }
  if (temRoleInvalida || (!temSemDoc && !temSemAuth)) {
    btns.push(`
      <select class="diag-select" data-uid="${u.uid}">
        <option value="">Definir role…</option>
        <option value="atleta" ${u.role==='atleta'?'selected':''}>Atleta</option>
        <option value="comite" ${u.role==='comite'?'selected':''}>Comitê</option>
        <option value="admin" ${u.role==='admin'?'selected':''}>Admin</option>
      </select>
      <button class="diag-btn diag-btn--blue" data-acao="set_role" data-uid="${u.uid}" title="Salvar role">Salvar role</button>
    `);
  }

  return btns.join('');
}

async function handleAcao(btn) {
  const acao = btn.dataset.acao;
  const uid = btn.dataset.uid;
  const row = btn.closest('tr');

  btn.disabled = true;
  btn.textContent = '…';

  try {
    if (acao === 'aprovar') {
      await updateDoc(doc(db, 'atletas', uid), { status: 'Aprovado', ativo: true });
      showToast('Acesso aprovado!', 'success');
      row?.remove();
      decrementarContador();

    } else if (acao === 'excluir_fs') {
      await fnExcluirFS({ uid });
      showToast('Documento removido.', 'success');
      row?.remove();
      decrementarContador();

    } else if (acao === 'excluir_auth') {
      await fnExcluirAuth({ uid });
      showToast('Usuário removido do Auth.', 'success');
      row?.remove();
      decrementarContador();

    } else if (acao === 'reconstruir') {
      await fnReconstruir({ uid, email: btn.dataset.email, nome: btn.dataset.nome, role: 'comite', equipe: 'Comitê' });
      showToast('Documento criado!', 'success');
      row?.remove();
      decrementarContador();

    } else if (acao === 'set_role') {
      const select = row?.querySelector('.diag-select');
      const role = select?.value;
      if (!role) { showToast('Selecione um role.', 'error'); btn.disabled = false; btn.textContent = 'Salvar role'; return; }
      await fnAtualizarPerfil({ uid, role, nome: '', equipe: '' });
      showToast(`Role atualizado para "${role}".`, 'success');
      row?.remove();
      decrementarContador();
    }
  } catch (e) {
    showToast('Erro: ' + (e?.message || e?.code || 'desconhecido'), 'error');
    btn.disabled = false;
    btn.textContent = acao === 'aprovar' ? 'Aprovar' : acao === 'set_role' ? 'Salvar role' : 'Tentar novamente';
  }
}

function decrementarContador() {
  const el = document.getElementById('diagTotalProblemas');
  if (!el) return;
  const atual = parseInt(el.textContent, 10);
  const novo = Math.max(0, atual - 1);
  el.textContent = novo;
  if (novo === 0) {
    document.getElementById('diagSemProblemas').style.display = 'flex';
    document.getElementById('diagTabelaWrap').style.display = 'none';
  }
}

// ── Carrega dados e roda diagnóstico ────────────────────────────────────────
async function rodarDiagnostico() {
  const loading = document.getElementById('diagLoading');
  const resultado = document.getElementById('diagResultado');
  if (!loading || !resultado) return;

  loading.style.display = 'flex';
  resultado.style.display = 'none';

  try {
    const [auditRes, fsRes] = await Promise.all([
      fnAuditar({}),
      fnListarFS({})
    ]);

    const { authSemFirestore = [], firestoreSemAuth = [] } = auditRes.data || {};
    const fsUsers = fsRes.data?.usuarios || [];

    loading.style.display = 'none';
    resultado.style.display = 'block';
    renderTabela(authSemFirestore, firestoreSemAuth, fsUsers);

  } catch (e) {
    loading.style.display = 'none';
    showToast('Erro ao carregar usuários: ' + (e?.message || e?.code), 'error');
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function roleBadge(role) {
  const cls = { admin: 'red', comite: 'blue', atleta: 'gray' }[role] || 'gray';
  return `<span class="diag-role diag-role--${cls}">${role || '—'}</span>`;
}

// ── Setup ────────────────────────────────────────────────────────────────────
export function setupDiagnostico() {
  document.getElementById('btnRodarDiagnostico')?.addEventListener('click', rodarDiagnostico);

  document.addEventListener('click', e => {
    if (e.target?.closest('[data-target="sub-diagnostico"]')) {
      setTimeout(rodarDiagnostico, 120);
    }
  });
}
