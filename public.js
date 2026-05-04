let filtroAtivo      = 'todos';
let buscaAtiva       = '';
let selecionados     = [];
let carouselIndex    = 0;
let _carouselImagens = [];

document.addEventListener('DOMContentLoaded', async () => {
  await carregarEstadoPublico();
  aplicarBgImagem();
  renderizarTudo();
  iniciarRealtime();

  const tel = document.getElementById('solTelefone');
  if (tel) {
    tel.addEventListener('input', function () {
      let v = this.value.replace(/\D/g, '').slice(0, 11);
      v = v.length <= 10
        ? v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
        : v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
      this.value = v;
    });
  }
});

function iniciarRealtime() {
  sb.channel('public-numeros')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'numeros' },
      async () => {
        await carregarEstadoPublico();
        renderizarNumeros();
        atualizarBarraSeleção();
      }
    )
    .subscribe();
}

function renderizarTudo() {
  renderizarHeader();
  renderizarPremio();
  renderizarNumeros();
  atualizarBarraSeleção();
  atualizarContato();
}

function renderizarHeader() {
  const { config, numeros } = state;
  const total       = Object.keys(numeros).length;
  const vendidos    = Object.values(numeros).filter(v => v?.status === 'vendido').length;
  const disponiveis = Object.values(numeros).filter(v => v === null).length;
  const pct = total > 0 ? Math.round((vendidos / total) * 100) : 0;

  document.title = `${config.nome} — Rifa`;
  document.getElementById('headerTitle').textContent      = config.nome;
  document.getElementById('statTotal').textContent        = total;
  document.getElementById('statVendidos').textContent     = vendidos;
  document.getElementById('statDisponiveis').textContent  = disponiveis;
  document.getElementById('progressFill').style.width     = pct + '%';
  document.getElementById('progressPercent').textContent  = pct + '%';
}

function renderizarPremio() {
  const { premio, config } = state;
  const section  = document.getElementById('premioSection');
  const showcase = document.getElementById('premioShowcase');

  if (!premio.nome && !premio.imagem) { section.style.display = 'none'; return; }
  section.style.display = '';

  _carouselImagens = [premio.imagem, premio.imagem2, premio.imagem3].filter(Boolean);
  carouselIndex = 0;
  const multi = _carouselImagens.length > 1;

  const slidesHtml = _carouselImagens.length
    ? _carouselImagens.map((src, i) => `
        <div class="carousel-slide">
          <img src="${src}" alt="${escapeHtml(premio.nome)}" class="carousel-img" onclick="abrirLightbox(${i})" />
        </div>`).join('')
    : `<div class="carousel-slide carousel-placeholder"><span style="font-size:5rem">🎁</span></div>`;

  const navHtml = multi ? `
    <button class="carousel-btn carousel-prev" onclick="moverCarousel(-1)">&#8249;</button>
    <button class="carousel-btn carousel-next" onclick="moverCarousel(1)">&#8250;</button>
    <div class="carousel-dots">
      ${_carouselImagens.map((_, i) => `<span class="carousel-dot${i === 0 ? ' active' : ''}" onclick="irParaSlide(${i})"></span>`).join('')}
    </div>` : '';

  showcase.innerHTML = `
    <div class="premio-card">
      <div class="carousel">
        <div class="carousel-track" id="carouselTrack">${slidesHtml}</div>
        ${navHtml}
      </div>
      <div class="premio-body">
        <span class="prize-badge">🏆 Prêmio — R$${config.preco.toFixed(2)} por número</span>
        <h3 class="prize-titulo">${escapeHtml(premio.nome)}</h3>
        ${premio.descricao ? `<p class="prize-desc">${escapeHtml(premio.descricao)}</p>` : ''}
      </div>
    </div>`;
}

function moverCarousel(dir) {
  const total = _carouselImagens.length;
  if (total <= 1) return;
  carouselIndex = (carouselIndex + dir + total) % total;
  _atualizarCarousel();
}

function irParaSlide(idx) {
  carouselIndex = idx;
  _atualizarCarousel();
}

function _atualizarCarousel() {
  const track = document.getElementById('carouselTrack');
  if (track) track.style.transform = `translateX(-${carouselIndex * 100}%)`;
  document.querySelectorAll('.carousel-dot').forEach((d, i) =>
    d.classList.toggle('active', i === carouselIndex));
}

function abrirLightbox(idx) {
  const src = _carouselImagens[idx];
  if (!src) return;
  document.getElementById('lightboxImg').src = src;
  document.getElementById('lightboxOverlay').classList.add('open');
}

function fecharLightbox() {
  document.getElementById('lightboxOverlay').classList.remove('open');
}

function renderizarNumeros() {
  const grid = document.getElementById('numerosGrid');
  grid.innerHTML = '';
  const nums = Object.keys(state.numeros).map(Number).sort((a, b) => a - b);

  nums.forEach(num => {
    const status = statusNumero(num);
    const isSel  = selecionados.includes(num);
    const passou = passaFiltro(num, status);

    const btn = document.createElement('button');
    btn.id = `num-${num}`;
    btn.className = [
      'numero-btn',
      status !== 'disponivel' ? status : '',
      isSel ? 'selecionado' : '',
      passou ? '' : 'hidden',
    ].join(' ').trim();

    btn.setAttribute('aria-label', `Número ${num} — ${status}`);
    btn.innerHTML = `<span>${num}</span>`;

    if (status === 'disponivel') {
      btn.onclick = () => toggleNumero(num);
    } else {
      btn.title   = status === 'pendente' ? 'Aguardando aprovação' : 'Já vendido';
      btn.onclick = () => mostrarInfoNumero(num, status);
    }

    grid.appendChild(btn);
  });
}

function toggleNumero(num) {
  const idx = selecionados.indexOf(num);
  if (idx === -1) selecionados.push(num);
  else selecionados.splice(idx, 1);
  selecionados.sort((a, b) => a - b);
  renderizarNumeros();
  atualizarBarraSeleção();
}

function atualizarBarraSeleção() {
  const bar   = document.getElementById('selectionBar');
  const count = document.getElementById('selectionCount');
  const total = document.getElementById('selectionTotal');

  if (selecionados.length === 0) { bar.classList.remove('visible'); return; }
  bar.classList.add('visible');
  count.textContent = `${selecionados.length} número(s) selecionado(s)`;
  total.textContent = `R$ ${(selecionados.length * state.config.preco)
    .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function abrirModalSolicitacao() {
  if (selecionados.length === 0) return;
  const valor = selecionados.length * state.config.preco;

  document.getElementById('solicitacaoNumeros').textContent =
    `Números: ${selecionados.join(', ')}`;
  document.getElementById('solicitacaoValor').textContent =
    `Total a pagar: R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const pix    = state.config.pixChave || '';
  const pixBox = document.getElementById('pixBox');
  if (pix) {
    document.getElementById('pixChaveTexto').textContent = pix;
    pixBox.style.display = '';
  } else {
    pixBox.style.display = 'none';
  }

  document.getElementById('solNome').value        = '';
  document.getElementById('solTelefone').value    = '';
  document.getElementById('solObs').value         = '';
  document.getElementById('solError').textContent = '';
  document.getElementById('modalSolicitacao').classList.add('open');
}

function fecharSolicitacao() {
  document.getElementById('modalSolicitacao').classList.remove('open');
}

function copiarPix() {
  const chave = state.config.pixChave || '';
  if (!chave) return;
  navigator.clipboard.writeText(chave)
    .then(() => showToast('✅ Chave Pix copiada!'))
    .catch(() => {
      const el = document.createElement('textarea');
      el.value = chave;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      showToast('✅ Chave Pix copiada!');
    });
}

async function enviarSolicitacao() {
  const nome      = document.getElementById('solNome').value.trim();
  const telefone  = document.getElementById('solTelefone').value.trim();
  const obs       = document.getElementById('solObs').value.trim();
  const errEl     = document.getElementById('solError');
  const btnEnviar = document.getElementById('btnEnviarSolicitacao');

  if (!nome)     { errEl.textContent = '⚠️ Informe seu nome.';             return; }
  if (!telefone) { errEl.textContent = '⚠️ Informe seu WhatsApp/telefone.'; return; }
  errEl.textContent = '';

  if (btnEnviar) { btnEnviar.disabled = true; btnEnviar.textContent = 'Enviando...'; }

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const { data, error } = await sb.rpc('criar_solicitacao', {
    p_id:       id,
    p_nome:     nome,
    p_telefone: telefone,
    p_obs:      obs,
    p_numeros:  selecionados,
    p_data:     new Date().toLocaleDateString('pt-BR'),
    p_hora:     new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  });

  if (btnEnviar) { btnEnviar.disabled = false; btnEnviar.textContent = '✅ Confirmar Reserva'; }

  if (error || data?.erro) {
    const conflito = data?.numeros || [];
    errEl.textContent = conflito.length
      ? `⚠️ Número(s) ${conflito.join(', ')} já não estão disponíveis.`
      : '⚠️ Erro ao enviar. Tente novamente.';
    selecionados = selecionados.filter(n => !conflito.includes(n));
    await carregarEstadoPublico();
    renderizarNumeros();
    atualizarBarraSeleção();
    return;
  }

  selecionados = [];
  fecharSolicitacao();
  await carregarEstadoPublico();
  renderizarTudo();
  showToast('✅ Solicitação enviada! Aguarde a confirmação do admin.');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { fecharSolicitacao(); fecharLightbox(); }
});

function mostrarInfoNumero(num, status) {
  const icon   = status === 'pendente' ? '⏳' : '✅';
  const conteudo = status === 'pendente'
    ? `<p style="color:var(--yellow);text-align:center;font-weight:600">Este número está aguardando aprovação de pagamento.</p>`
    : `<p style="color:var(--green-light);text-align:center;font-weight:600">Este número já foi vendido. 🎟️</p>`;

  document.getElementById('detalhesIcon').textContent   = icon;
  document.getElementById('detalhesTitulo').textContent = `Número ${num}`;
  document.getElementById('detalhesConteudo').innerHTML = conteudo;
  document.getElementById('modalDetalhes').classList.add('open');
}

function passaFiltro(num, status) {
  if (filtroAtivo === 'disponivel' && status !== 'disponivel') return false;
  if (filtroAtivo === 'vendido'    && status === 'disponivel') return false;
  if (buscaAtiva && !String(num).includes(buscaAtiva)) return false;
  return true;
}

function setFiltro(filtro) {
  filtroAtivo = filtro;
  const map = { todos: 'filterTodos', disponivel: 'filterDisponiveis', vendido: 'filterVendidos' };
  Object.values(map).forEach(id => document.getElementById(id).classList.remove('active'));
  document.getElementById(map[filtro]).classList.add('active');
  renderizarNumeros();
}

function buscar() {
  buscaAtiva = (document.getElementById('busca').value || '').trim();
  renderizarNumeros();
}

function atualizarContato() {
  const el = document.getElementById('infoContato');
  if (el) el.textContent = state.config.contato || 'Entre em contato com o organizador para mais informações!';
}
