const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let state = {
  config: {
    nome: 'Rifa Beneficente da Família',
    total: 200,
    preco: 20,
    contato: '',
    pixChave: '',
    bgImagem: null,
  },
  premio:       { nome: '', descricao: '', imagem: null },
  numeros:      {},
  compradores:  [],
  solicitacoes: [],
};

function mapConfig(row) {
  return {
    nome:     row.nome,
    total:    row.total,
    preco:    Number(row.preco),
    contato:  row.contato   || '',
    pixChave: row.pix_chave || '',
    bgImagem: row.bg_imagem || null,
  };
}

function mapPremio(row) {
  return {
    nome:      row.nome      || '',
    descricao: row.descricao || '',
    imagem:    row.imagem    || null,
  };
}

async function carregarEstadoPublico() {
  const [{ data: config }, { data: premio }, { data: numeros }] = await Promise.all([
    sb.from('rifa_config').select('*').eq('id', 1).single(),
    sb.from('premio').select('*').eq('id', 1).single(),
    sb.from('numeros').select('numero, status'),
  ]);

  if (config) state.config = mapConfig(config);
  if (premio)  state.premio = mapPremio(premio);

  state.numeros = {};
  (numeros || []).forEach(n => {
    state.numeros[n.numero] = n.status === 'disponivel' ? null : { status: n.status };
  });
}

async function carregarEstadoAdmin() {
  const [
    { data: config },
    { data: premio },
    { data: numeros },
    { data: compradores },
    { data: solicitacoes },
  ] = await Promise.all([
    sb.from('rifa_config').select('*').eq('id', 1).single(),
    sb.from('premio').select('*').eq('id', 1).single(),
    sb.from('numeros').select('*'),
    sb.from('compradores').select('*').order('created_at', { ascending: false }),
    sb.from('solicitacoes').select('*').eq('status', 'pendente').order('created_at', { ascending: true }),
  ]);

  if (config) state.config = mapConfig(config);
  if (premio)  state.premio = mapPremio(premio);

  state.numeros = {};
  (numeros || []).forEach(n => {
    state.numeros[n.numero] = n.status === 'disponivel' ? null : {
      status:      n.status,
      nome:        n.nome        || '',
      telefone:    n.telefone    || '',
      compradorId: n.comprador_id,
    };
  });

  state.compradores = (compradores || []).map(c => ({
    id:       c.id,
    nome:     c.nome,
    telefone: c.telefone || '',
    numeros:  c.numeros  || [],
    data:     c.data,
  }));

  state.solicitacoes = (solicitacoes || []).map(s => ({
    id:       s.id,
    nome:     s.nome,
    telefone: s.telefone || '',
    obs:      s.obs      || '',
    numeros:  s.numeros  || [],
    data:     s.data,
    hora:     s.hora,
    status:   s.status,
  }));
}

function statusNumero(num) {
  const d = state.numeros[num];
  if (!d) return 'disponivel';
  return d.status || 'vendido';
}

function aplicarBgImagem() {
  const el = document.getElementById('headerBg');
  if (!el) return;
  if (state.config.bgImagem) {
    el.style.backgroundImage = `url('${state.config.bgImagem}')`;
    el.classList.add('with-image');
  } else {
    el.style.backgroundImage = '';
    el.classList.remove('with-image');
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let _toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

function fecharModal() {
  document.getElementById('modalOverlay')?.classList.remove('open');
}
function fecharDetalhes() {
  document.getElementById('modalDetalhes')?.classList.remove('open');
}
function abrirModal(icon, titulo, msg, onConfirm) {
  document.getElementById('modalIcon').textContent  = icon;
  document.getElementById('modalTitle').textContent = titulo;
  document.getElementById('modalMsg').textContent   = msg;
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('modalConfirmar').onclick = onConfirm;
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { fecharModal(); fecharDetalhes(); }
});
