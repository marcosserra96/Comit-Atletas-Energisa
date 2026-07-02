// =====================================================
// js/modules/diagnostico.js — Diagnóstico de Permissões Firebase
// =====================================================
import { auth, db, functions, collection, getDocs, doc, getDoc, setDoc, deleteDoc, httpsCallable } from '../firebase.js';

// Renderiza um item de check no container indicado
function renderCheck(containerId, { label, detail, status }) {
  // status: 'ok' | 'err' | 'warn' | 'skip' | 'run'
  const icons = { ok: '✓', err: '✗', warn: '!', skip: '–', run: '…' };
  const el = document.createElement('div');
  el.className = `diag-check ${status}`;
  el.innerHTML = `
    <div class="diag-check-icon">${icons[status] ?? '?'}</div>
    <div class="diag-check-body">
      <strong>${label}</strong>
      ${detail ? `<small>${detail}</small>` : ''}
    </div>`;
  document.getElementById(containerId)?.appendChild(el);
  return el;
}

// Executa um check e atualiza o elemento com o resultado
async function runCheck(containerId, label, fn) {
  const placeholder = renderCheck(containerId, { label, detail: 'Verificando…', status: 'run' });
  let status = 'ok', detail = '';
  try {
    detail = await fn() ?? '';
  } catch (e) {
    status = 'err';
    detail = e?.code ? `${e.code}` : (e?.message ?? 'Erro desconhecido');
  }
  placeholder.className = `diag-check ${status}`;
  placeholder.querySelector('.diag-check-icon').textContent = { ok: '✓', err: '✗', warn: '!', skip: '–' }[status] ?? '?';
  placeholder.querySelector('small').textContent = detail;
  return status === 'ok';
}

async function rodarDiagnostico() {
  // Limpa resultados anteriores
  ['diagGrupoAuth', 'diagGrupoRead', 'diagGrupoWrite', 'diagGrupoFunctions'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
  document.getElementById('diagResultado').style.display = 'none';
  document.getElementById('diagResumo').textContent = '';
  document.getElementById('diagLoading').style.display = 'flex';

  let total = 0, falhos = 0;

  async function check(group, label, fn) {
    total++;
    const ok = await runCheck(group, label, fn);
    if (!ok) falhos++;
  }

  // ── Autenticação & Perfil ─────────────────────────────
  await check('diagGrupoAuth', 'Usuário autenticado', async () => {
    const u = auth.currentUser;
    if (!u) throw new Error('Nenhum usuário logado');
    return u.email;
  });

  await check('diagGrupoAuth', 'Documento do usuário existe', async () => {
    const u = auth.currentUser;
    if (!u) throw new Error('Não autenticado');
    const snap = await getDoc(doc(db, 'atletas', u.uid));
    if (!snap.exists()) throw new Error('Documento não encontrado em atletas/{uid}');
    return `role: ${snap.data().role ?? '—'}`;
  });

  await check('diagGrupoAuth', 'Perfil é admin', async () => {
    const u = auth.currentUser;
    if (!u) throw new Error('Não autenticado');
    const snap = await getDoc(doc(db, 'atletas', u.uid));
    const role = snap.exists() ? snap.data().role : null;
    if (role !== 'admin') throw new Error(`role atual: "${role ?? 'sem role'}"`);
    return 'Confirmado';
  });

  // ── Firestore — Leitura ───────────────────────────────
  const colecoes = [
    ['atletas',           'Coleção atletas'],
    ['configuracoes',     'Coleção configuracoes'],
    ['historico_pontos',  'Coleção historico_pontos'],
    ['regras_pontuacao',  'Coleção regras_pontuacao'],
    ['despesas',          'Coleção despesas'],
    ['agenda_eventos',    'Coleção agenda_eventos'],
    ['auditoria',         'Coleção auditoria'],
  ];

  for (const [col, label] of colecoes) {
    await check('diagGrupoRead', label, async () => {
      const snap = await getDocs(collection(db, col));
      return `${snap.size} documento(s)`;
    });
  }

  // ── Firestore — Escrita ───────────────────────────────
  const testDocId = `__diag_${Date.now()}`;

  await check('diagGrupoWrite', 'Criar documento (atletas)', async () => {
    await setDoc(doc(db, 'atletas', testDocId), { _diag: true, ts: Date.now() });
    return 'OK';
  });

  await check('diagGrupoWrite', 'Excluir documento (atletas)', async () => {
    await deleteDoc(doc(db, 'atletas', testDocId));
    return 'OK';
  });

  await check('diagGrupoWrite', 'Escrever em configuracoes', async () => {
    const ref = doc(db, 'configuracoes', '__diag_test');
    await setDoc(ref, { _diag: true, ts: Date.now() }, { merge: true });
    await deleteDoc(ref);
    return 'OK';
  });

  // ── Cloud Functions ───────────────────────────────────
  await check('diagGrupoFunctions', 'Chamar listarUsuarios', async () => {
    const fn = httpsCallable(functions, 'listarUsuarios');
    const res = await fn({});
    const total = res?.data?.totais?.auth ?? res?.data?.usuarios?.length ?? '?';
    return `${total} usuários no Auth`;
  });

  // ── Resumo ────────────────────────────────────────────
  document.getElementById('diagLoading').style.display = 'none';
  document.getElementById('diagResultado').style.display = 'block';

  const resumoEl = document.getElementById('diagResumo');
  if (falhos === 0) {
    resumoEl.className = 'diag-resumo ok';
    resumoEl.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Tudo certo! ${total} verificações passaram sem erros.`;
  } else {
    resumoEl.className = `diag-resumo ${falhos === total ? 'err' : 'warn'}`;
    resumoEl.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> ${falhos} de ${total} verificações falharam. Revise as regras do Firestore e a implantação das Functions.`;
  }
}

export function setupDiagnostico() {
  document.getElementById('btnRodarDiagnostico')?.addEventListener('click', rodarDiagnostico);

  // Roda automaticamente ao abrir a aba
  document.addEventListener('click', e => {
    if (e.target?.closest('[data-target="sub-diagnostico"]')) {
      setTimeout(rodarDiagnostico, 120);
    }
  });
}
