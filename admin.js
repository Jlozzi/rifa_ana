let selecionados        = [];
let filtroAtivo         = 'todos';
let buscaAtiva          = '';
let numeroDetalhesAtivo = null;

async function verificarSessao() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    await carregarEstadoAdmin();
    mostrarAdmin();
  }
}

async function tentarLogin() {
  const email  = document.getElementById('loginEmail').value.trim();
  const senha  = document.getElementById('loginSenha').value;
  const errEl  = document.getElementById('loginError');
  const btn    = document.getElementById('btnEntrar');

  if (!email || !senha) { errEl.textContent = '⚠️ Preencha email e senha.'; return; }

  btn.disabled    = true;
  btn.textContent = 'Entrando...';
  errEl.textContent = '';

  const { error } = await sb.auth.signInWithPassword({ email, password: senha });

  btn.disabled    = false;
  btn.textContent = '🔓 Entrar';

  if (error) {
    errEl.textContent = '❌ Email ou senha incorretos.';
    document.getElementById('loginSenha').value = '';
    document.getElementById('loginSenha').focus();
    const card = document.querySelector('.login-card');
    card.classList.add('shake');
    setTimeout(() => card.classList.remove('shake'), 500);
    return;
  }

  await carregarEstadoAdmin();
  mostrarAdmin();
}

function mostrarAdmin() {
  document.getElementById('loginOverlay').style.display = 'none';
  document.getElementById('adminPanel').style.display   = 'block';
  aplicarBgImagem();
  renderizarTudo();
  sincronizarForms();
  atualizarPreviewImagem('premio',  state.premio.imagem);
  atualizarPreviewImagem('premio2', state.premio.imagem2);
  atualizarPreviewImagem('premio3', state.premio.imagem3);
  if (state.config.bgImagem) atualizarPreviewImagem('bg', state.config.bgImagem);
  iniciarRealtimeAdmin();
}

async function logout() {
  await sb.auth.signOut();
  location.reload();
}

function iniciarRealtimeAdmin() {
  sb.channel('admin-changes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'solicitacoes' },
      async () => {
        await carregarEstadoAdmin();
        renderizarTudo();
        showToast('🔔 Nova solicitação recebida!');
      }
    )
    .subscribe();
}

function renderizarTudo() {
  renderizarHeader();
  renderizarSolicitacoes();
  renderizarNumeros();
  renderizarCompradores();
}

function renderizarHeader() {
  const { config, numeros, solicitacoes } = state;
  const total     = Object.keys(numeros).length;
  const vendidos  = Object.values(numeros).filter(v => v?.status === 'vendido').length;
  const pendentes = solicitacoes.length;
  const pct = total > 0 ? Math.round((vendidos / total) * 100) : 0;

  document.title = `Admin — ${config.nome}`;
  document.getElementById('adminSubtitulo').textContent  = config.nome;
  document.getElementById('statTotal').textContent       = total;
  document.getElementById('statVendidos').textContent    = vendidos;
  document.getElementById('statPendentes').textContent   = pendentes;
  document.getElementById('progressFill').style.width    = pct + '%';
  document.getElementById('progressPercent').textContent = pct + '%';

  const badge = document.getElementById('badgePendentes');
  badge.textContent   = pendentes;
  badge.style.display = pendentes > 0 ? 'inline-flex' : 'none';
}

function renderizarSolicitacoes() {
  const grid  = document.getElementById('solicitacoesGrid');
  const empty = document.getElementById('emptySolicitacoes');
  grid.innerHTML = '';

  empty.classList.toggle('visible', state.solicitacoes.length === 0);

  state.solicitacoes.forEach(sol => {
    const valor = (sol.numeros.length * state.config.preco)
      .toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const card = document.createElement('div');
    card.className = 'sol-card';
    card.innerHTML = `
      <div class="sol-header">
        <div class="comprador-avatar" style="background:var(--grad-yellow)">${sol.nome.charAt(0).toUpperCase()}</div>
        <div class="comprador-info">
          <div class="comprador-nome">${escapeHtml(sol.nome)}</div>
          <div class="comprador-tel">${escapeHtml(sol.telefone)} · ${sol.data} ${sol.hora || ''}</div>
        </div>
        <div class="sol-valor">R$${valor}</div>
      </div>
      ${sol.obs ? `<p class="sol-obs">💬 ${escapeHtml(sol.obs)}</p>` : ''}
      <div class="comprador-numeros" style="margin:8px 0">
        ${sol.numeros.map(n => `<span class="num-chip chip-pendente">${n}</span>`).join('')}
      </div>
      <div class="sol-actions">
        <button class="btn btn-success" style="margin-top:0;flex:1;font-size:0.85rem" onclick="aprovarSolicitacao('${sol.id}')">✅ Aprovar</button>
        <button class="btn btn-danger"  style="margin-top:0;flex:1;font-size:0.85rem" onclick="rejeitarSolicitacao('${sol.id}')">❌ Rejeitar</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function renderizarNumeros() {
  const grid = document.getElementById('numerosGrid');
  grid.innerHTML = '';
  const nums = Object.keys(state.numeros).map(Number).sort((a, b) => a - b);

  nums.forEach(num => {
    const st     = statusNumero(num);
    const isSel  = selecionados.includes(num);
    const passou = passaFiltroAdmin(num, st);

    const btn = document.createElement('button');
    btn.id = `num-${num}`;
    btn.className = [
      'numero-btn',
      st !== 'disponivel' ? st : '',
      isSel  ? 'selecionado' : '',
      passou ? '' : 'hidden',
    ].join(' ').trim();

    const data = state.numeros[num];
    btn.setAttribute('aria-label', `Número ${num}`);
    if (data) btn.title = `${data.nome || ''} (${st})`;
    btn.innerHTML = `<span>${num}</span>`;
    btn.onclick = () => toggleNumero(num);
    grid.appendChild(btn);
  });
}

function toggleNumero(num) {
  const st = statusNumero(num);
  if (st !== 'disponivel') { abrirDetalhesAdmin(num); return; }
  const idx = selecionados.indexOf(num);
  if (idx === -1) selecionados.push(num);
  else selecionados.splice(idx, 1);
  selecionados.sort((a, b) => a - b);
  atualizarSelecaoUI();
  renderizarNumeros();
}

function atualizarSelecaoUI() {
  const list  = document.getElementById('selectedList');
  const input = document.getElementById('regNumeros');
  if (selecionados.length === 0) {
    list.textContent = 'Nenhum';
    input.value = '';
  } else {
    const txt = selecionados.join(', ');
    list.textContent = txt;
    input.value = txt;
  }
}

function limparSelecao() {
  selecionados = [];
  atualizarSelecaoUI();
  renderizarNumeros();
}

function renderizarCompradores() {
  const container = document.getElementById('compradoresList');
  const empty     = document.getElementById('emptyCompradores');
  container.innerHTML = '';

  const lista = state.compradores.filter(c => {
    if (!buscaAtiva) return true;
    return c.nome.toLowerCase().includes(buscaAtiva) ||
           c.numeros.some(n => String(n).includes(buscaAtiva));
  });

  empty.classList.toggle('visible', lista.length === 0);

  lista.forEach(comp => {
    const valor = (comp.numeros.length * state.config.preco)
      .toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const card = document.createElement('div');
    card.className = 'comprador-card';
    card.innerHTML = `
      <div class="comprador-header">
        <div class="comprador-avatar">${comp.nome.charAt(0).toUpperCase()}</div>
        <div class="comprador-info">
          <div class="comprador-nome">${escapeHtml(comp.nome)}</div>
          <div class="comprador-tel">${comp.telefone ? escapeHtml(comp.telefone) : '—'} · ${comp.data}</div>
        </div>
        <div class="comprador-valor">R$${valor}</div>
      </div>
      <div class="comprador-numeros">${comp.numeros.map(n => `<span class="num-chip">${n}</span>`).join('')}</div>
      <div class="comprador-actions">
        <button class="btn-icon" onclick="removerComprador('${comp.id}')">🗑️ Remover</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function aprovarSolicitacao(id) {
  const sol = state.solicitacoes.find(s => s.id === id);
  if (!sol) return;

  abrirModal('✅', 'Aprovar Solicitação',
    `Confirmar venda dos números ${sol.numeros.join(', ')} para ${sol.nome}?`,
    async () => {
      const { error } = await sb.rpc('aprovar_solicitacao', { p_id: id });
      if (error) { showToast('❌ Erro ao aprovar. Tente novamente.'); return; }
      await carregarEstadoAdmin();
      renderizarTudo();
      fecharModal();
      showToast(`✅ Venda de ${sol.nome} confirmada!`);
    }
  );
}

function rejeitarSolicitacao(id) {
  const sol = state.solicitacoes.find(s => s.id === id);
  if (!sol) return;

  abrirModal('❌', 'Rejeitar Solicitação',
    `Rejeitar e liberar os números ${sol.numeros.join(', ')} de ${sol.nome}?`,
    async () => {
      const { error } = await sb.rpc('rejeitar_solicitacao', { p_id: id });
      if (error) { showToast('❌ Erro ao rejeitar. Tente novamente.'); return; }
      await carregarEstadoAdmin();
      renderizarTudo();
      fecharModal();
      showToast(`🗑️ Solicitação de ${sol.nome} rejeitada. Números liberados.`);
    }
  );
}

async function registrarComprador() {
  const nome     = document.getElementById('regNome').value.trim();
  const telefone = document.getElementById('regTelefone').value.trim();
  const input    = document.getElementById('regNumeros').value;

  if (!nome) { showToast('⚠️ Informe o nome'); return; }

  let nums = selecionados.length > 0
    ? [...selecionados]
    : input.split(/[,;\s]+/).map(s => parseInt(s)).filter(n => !isNaN(n) && n > 0);

  if (!nums.length)          { showToast('⚠️ Selecione ao menos um número'); return; }
  const foraRange = nums.filter(n => !(n in state.numeros));
  const ocupados  = nums.filter(n => (n in state.numeros) && state.numeros[n] !== null);
  if (foraRange.length) { showToast(`⚠️ Fora do range: ${foraRange.join(', ')}`); return; }
  if (ocupados.length)  { showToast(`⚠️ Já ocupados: ${ocupados.join(', ')}`);     return; }

  const id   = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const data = new Date().toLocaleDateString('pt-BR');

  await sb.from('numeros').upsert(
    nums.map(n => ({ numero: n, status: 'vendido', nome, telefone, comprador_id: id }))
  );
  await sb.from('compradores').insert({
    id, nome, telefone, numeros: nums.sort((a, b) => a - b), data,
  });

  selecionados = [];
  document.getElementById('regNome').value     = '';
  document.getElementById('regTelefone').value = '';
  atualizarSelecaoUI();

  await carregarEstadoAdmin();
  renderizarTudo();
  showToast(`✅ ${nome} registrado!`);
}

function removerComprador(id) {
  const comp = state.compradores.find(c => c.id === id);
  if (!comp) return;
  abrirModal('🗑️', 'Remover Comprador',
    `Remover "${comp.nome}" e liberar os números ${comp.numeros.join(', ')}?`,
    async () => {
      await sb.from('numeros').upsert(
        comp.numeros.map(n => ({
          numero: n, status: 'disponivel',
          nome: null, telefone: null, comprador_id: null,
        }))
      );
      await sb.from('compradores').delete().eq('id', id);
      await carregarEstadoAdmin();
      renderizarTudo();
      fecharModal();
      showToast(`🗑️ ${comp.nome} removido`);
    }
  );
}

async function desmarcarNumero() {
  const num = numeroDetalhesAtivo;
  if (!num || state.numeros[num] === null) return;
  const info = state.numeros[num];

  if (info.status === 'pendente') {
    await sb.from('solicitacoes').delete().eq('id', info.compradorId);
  } else {
    const comp = state.compradores.find(c => c.id === info.compradorId);
    if (comp) {
      const novosNums = comp.numeros.filter(n => n !== num);
      if (novosNums.length === 0) {
        await sb.from('compradores').delete().eq('id', comp.id);
      } else {
        await sb.from('compradores').update({ numeros: novosNums }).eq('id', comp.id);
      }
    }
  }

  await sb.from('numeros').update({
    status: 'disponivel', nome: null, telefone: null, comprador_id: null,
  }).eq('numero', num);

  await carregarEstadoAdmin();
  renderizarTudo();
  fecharDetalhes();
  showToast(`✅ Número ${num} liberado`);
}

function abrirDetalhesAdmin(num) {
  numeroDetalhesAtivo = num;
  const data = state.numeros[num];
  const st   = statusNumero(num);
  const icons = { pendente: '⏳', vendido: '✅', disponivel: '🟢' };
  document.getElementById('detalhesIcon').textContent   = icons[st] || '🎟️';
  document.getElementById('detalhesTitulo').textContent = `Número ${num} — ${st.charAt(0).toUpperCase() + st.slice(1)}`;
  document.getElementById('detalhesConteudo').innerHTML = data
    ? `<div class="detalhe-row"><span class="detalhe-label">Nome</span><strong>${escapeHtml(data.nome || '—')}</strong></div>
       <div class="detalhe-row"><span class="detalhe-label">Telefone</span>${data.telefone ? escapeHtml(data.telefone) : '—'}</div>
       <div class="detalhe-row"><span class="detalhe-label">Status</span>${st}</div>
       <div class="detalhe-row"><span class="detalhe-label">Valor</span>R$${state.config.preco.toFixed(2)}</div>`
    : `<p style="color:var(--text-muted);text-align:center">Disponível.</p>`;
  document.getElementById('btnDesmarcar').style.display = data ? '' : 'none';
  document.getElementById('modalDetalhes').classList.add('open');
}

async function aplicarConfig() {
  const nome     = document.getElementById('cfgNome').value.trim();
  const total    = parseInt(document.getElementById('cfgTotal').value)   || 200;
  const preco    = parseFloat(document.getElementById('cfgPreco').value) || 20;
  const contato  = document.getElementById('cfgContato').value.trim();
  const pixChave = document.getElementById('cfgPix').value.trim();

  if (total < 1 || total > 1000) { showToast('⚠️ Quantidade entre 1 e 1000'); return; }

  const totalAtual = state.config.total;

  await sb.from('rifa_config').update({
    nome: nome || state.config.nome,
    total, preco, contato, pix_chave: pixChave,
  }).eq('id', 1);

  if (total > totalAtual) {
    const novos = [];
    for (let i = totalAtual + 1; i <= total; i++) novos.push({ numero: i, status: 'disponivel' });
    if (novos.length) await sb.from('numeros').insert(novos);
  } else if (total < totalAtual) {
    await sb.from('numeros').delete().gt('numero', total).eq('status', 'disponivel');
    const ocupados = Object.entries(state.numeros)
      .filter(([n, v]) => Number(n) > total && v !== null)
      .map(([n]) => n);
    if (ocupados.length) showToast(`⚠️ Números ocupados não removidos: ${ocupados.join(', ')}`);
  }

  selecionados = selecionados.filter(n => n <= total);
  await carregarEstadoAdmin();
  renderizarTudo();
  showToast('✅ Configurações salvas!');
}

async function salvarPremio() {
  const nome      = document.getElementById('cfgPremio').value.trim();
  const descricao = document.getElementById('cfgPremioDesc').value.trim();
  await sb.from('premio').update({ nome, descricao }).eq('id', 1);
  state.premio.nome      = nome;
  state.premio.descricao = descricao;
  showToast('✅ Prêmio salvo!');
}

function confirmarReset() {
  abrirModal('🗑️', 'Resetar Tudo',
    'Apaga TODOS os compradores e solicitações, liberando todos os números. O prêmio e configurações são mantidos.',
    async () => {
      await sb.from('compradores').delete().not('id', 'is', null);
      await sb.from('solicitacoes').delete().not('id', 'is', null);
      await sb.from('numeros').update({
        status: 'disponivel', nome: null, telefone: null, comprador_id: null,
      }).gte('numero', 1);

      selecionados = [];
      await carregarEstadoAdmin();
      renderizarTudo();
      fecharModal();
      showToast('🗑️ Rifa resetada');
    }
  );
}

function carregarImagem(input, slot) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) showToast('⚠️ Imagem grande! Prefira menos de 2MB.');
  const campos = { 1: 'imagem', 2: 'imagem2', 3: 'imagem3' };
  const tipos  = { 1: 'premio', 2: 'premio2', 3: 'premio3' };
  const campo  = campos[slot];
  const tipo   = tipos[slot];
  const reader = new FileReader();
  reader.onload = async e => {
    const base64 = e.target.result;
    await sb.from('premio').update({ [campo]: base64 }).eq('id', 1);
    state.premio[campo] = base64;
    atualizarPreviewImagem(tipo, base64);
    showToast('✅ Foto carregada!');
  };
  reader.readAsDataURL(file);
}

async function removerImagem(slot) {
  const campos   = { 1: 'imagem', 2: 'imagem2', 3: 'imagem3' };
  const tipos    = { 1: 'premio', 2: 'premio2', 3: 'premio3' };
  const inputIds = { 1: 'premioImg', 2: 'premioImg2', 3: 'premioImg3' };
  const campo    = campos[slot];
  const tipo     = tipos[slot];
  await sb.from('premio').update({ [campo]: null }).eq('id', 1);
  state.premio[campo] = null;
  atualizarPreviewImagem(tipo, null);
  document.getElementById(inputIds[slot]).value = '';
  showToast('🗑️ Imagem removida');
}

function atualizarPreviewImagem(tipo, src) {
  const preview     = document.getElementById(`${tipo}Preview`);
  const placeholder = document.getElementById(`${tipo}Placeholder`);
  if (src) { preview.src = src; preview.style.display = 'block'; placeholder.style.display = 'none'; }
  else     { preview.style.display = 'none'; placeholder.style.display = 'flex'; }
}

function carregarBgImagem(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) showToast('⚠️ Imagem grande! Prefira menos de 2MB.');
  const reader = new FileReader();
  reader.onload = async e => {
    const base64 = e.target.result;
    await sb.from('rifa_config').update({ bg_imagem: base64 }).eq('id', 1);
    state.config.bgImagem = base64;
    atualizarPreviewImagem('bg', base64);
    aplicarBgImagem();
    showToast('✅ Imagem de fundo aplicada!');
  };
  reader.readAsDataURL(file);
}

async function removerBgImagem() {
  await sb.from('rifa_config').update({ bg_imagem: null }).eq('id', 1);
  state.config.bgImagem = null;
  atualizarPreviewImagem('bg', null);
  aplicarBgImagem();
  document.getElementById('bgImg').value = '';
  showToast('🗑️ Imagem de fundo removida');
}

function passaFiltroAdmin(num, st) {
  if (filtroAtivo !== 'todos' && st !== filtroAtivo) return false;
  if (buscaAtiva) {
    const data = state.numeros[num];
    if (String(num).includes(buscaAtiva)) return true;
    if (data?.nome?.toLowerCase().includes(buscaAtiva)) return true;
    return false;
  }
  return true;
}

function setFiltro(filtro) {
  filtroAtivo = filtro;
  const map = { todos: 'filterTodos', disponivel: 'filterDisponiveis', pendente: 'filterPendentes', vendido: 'filterVendidos' };
  Object.values(map).forEach(id => document.getElementById(id)?.classList.remove('active'));
  document.getElementById(map[filtro])?.classList.add('active');
  renderizarNumeros();
}

function buscarAdmin() {
  buscaAtiva = (document.getElementById('buscaAdmin').value || '').toLowerCase().trim();
  renderizarNumeros();
  renderizarCompradores();
}

function sincronizarForms() {
  document.getElementById('cfgNome').value       = state.config.nome;
  document.getElementById('cfgTotal').value      = state.config.total;
  document.getElementById('cfgPreco').value      = state.config.preco;
  document.getElementById('cfgContato').value    = state.config.contato   || '';
  document.getElementById('cfgPix').value        = state.config.pixChave  || '';
  document.getElementById('cfgPremio').value     = state.premio.nome      || '';
  document.getElementById('cfgPremioDesc').value = state.premio.descricao || '';
}

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('loginEmail').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('loginSenha').focus();
  });
  document.getElementById('loginSenha').addEventListener('keydown', e => {
    if (e.key === 'Enter') tentarLogin();
  });

  const tel = document.getElementById('regTelefone');
  if (tel) {
    tel.addEventListener('input', function () {
      let v = this.value.replace(/\D/g, '').slice(0, 11);
      v = v.length <= 10
        ? v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
        : v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
      this.value = v;
    });
  }

  await verificarSessao();
});
