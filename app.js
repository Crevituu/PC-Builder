/* ============================================================
   PC BUILDER — app.js
   Carrega data.json e controla toda a lógica do simulador.
   ============================================================ */

let DATA = {};
const sel = { cpu: null, mb: null, cooler: null, gpu: null };
const KEYS = ['cpu', 'mb', 'cooler', 'gpu'];
const LABELS = { cpu: 'CPU', mb: 'MOBO', cooler: 'COOLER', gpu: 'GPU' };

/* ---------- Utilitários ---------- */
const fmt = v => 'R$ ' + v.toLocaleString('pt-BR');
const $   = id => document.getElementById(id);

/* ---------- Carregamento dos dados ---------- */
async function loadData() {
  const res  = await fetch('data.json');
  DATA       = await res.json();
  KEYS.forEach(k => renderOptions(k));
  updateResults();
}

/* ---------- Renderiza as opções de um componente ---------- */
function renderOptions(key) {
  const wrap = $('opts-' + key);
  wrap.innerHTML = DATA[key].map(item => `
    <div class="comp-option ${sel[key]?.id === item.id ? 'active' : ''}"
         onclick="pick('${key}','${item.id}')">
      <div>
        <div class="opt-name">${item.nome}</div>
        <div class="opt-spec">${item.spec}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
        <div class="opt-price">${fmt(item.preco)}</div>
        <div class="opt-check">
          <svg viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3" fill="none"/></svg>
        </div>
      </div>
    </div>
  `).join('');
}

/* ---------- Seleciona um componente ---------- */
function pick(key, id) {
  sel[key] = DATA[key].find(x => x.id === id);
  $('card-' + key).classList.add('selected');
  renderOptions(key);
  updateResults();
}

/* ---------- Atualiza todos os painéis de resultado ---------- */
function updateResults() {
  const count = KEYS.filter(k => sel[k]).length;

  // Contador do hero
  $('sel-count').textContent = count;

  // Dots de progresso
  KEYS.forEach((k, i) =>
    $('pd' + i).classList.toggle('active', !!sel[k])
  );

  updateSummary();
  updatePrice(count);
  updatePower();
  if (count === 4) {
    updateCompatibility();
    updatePerformance();
  }
}

/* ---------- Resumo de componentes ---------- */
function updateSummary() {
  $('sel-summary').innerHTML = KEYS.map(k => `
    <div class="sel-row">
      <div>
        <div class="sel-type">${LABELS[k]}</div>
        <div class="${sel[k] ? 'sel-name' : 'sel-empty'}">
          ${sel[k] ? sel[k].nome : '— não selecionado —'}
        </div>
      </div>
      ${sel[k]
        ? `<div style="font-family:var(--mono);font-size:11px;color:var(--accent);flex-shrink:0">
             ${fmt(sel[k].preco)}
           </div>`
        : ''}
    </div>
  `).join('');
}

/* ---------- Preço total ---------- */
function updatePrice(count) {
  if (count === 0) {
    $('price-section').innerHTML = `
      <div class="empty-state">
        <div class="empty-text">AGUARDANDO<br>SELEÇÃO</div>
      </div>`;
    return;
  }

  const total = KEYS.reduce((s, k) => s + (sel[k]?.preco || 0), 0);
  $('price-section').innerHTML = `
    <div class="price-display">
      <div class="price-main">${fmt(total)}</div>
      <div class="price-label">// TOTAL DO BUILD</div>
    </div>
    <div class="price-breakdown">
      ${KEYS.map(k => sel[k] ? `
        <div class="price-row">
          <span class="price-row-label">${LABELS[k]}</span>
          <span class="price-row-val">${fmt(sel[k].preco)}</span>
        </div>` : '').join('')}
    </div>`;
}

/* ---------- Consumo & fonte ---------- */
function updatePower() {
  if (!sel.cpu || !sel.gpu) {
    $('power-section').innerHTML = `<div class="empty-state"><div class="empty-text">—</div></div>`;
    return;
  }

  const consumo = sel.cpu.tdp + sel.gpu.tdp + 80;          // +80W sistema base
  const psu     = Math.ceil((consumo * 1.3) / 50) * 50;    // margem 30%

  $('power-section').innerHTML = `
    <div class="metrics-grid">
      <div class="metric-box">
        <div class="metric-val">${consumo}</div>
        <div class="metric-unit">W</div>
        <div class="metric-lbl">CONSUMO PICO</div>
      </div>
      <div class="metric-box">
        <div class="metric-val">${psu}</div>
        <div class="metric-unit">W</div>
        <div class="metric-lbl">FONTE REC.</div>
      </div>
    </div>
    <div class="psu-rec">
      <span class="psu-label">80+ GOLD RECOMENDADO</span>
      <span class="psu-val">${psu}W</span>
    </div>`;
}

/* ---------- Compatibilidade ---------- */
function updateCompatibility() {
  let score  = 100;
  const issues = [];

  // Socket CPU × Mobo
  if (sel.cpu.socket !== sel.mb.socket) {
    issues.push({ t: 'err',  msg: `Socket incompatível: CPU ${sel.cpu.socket} ≠ Mobo ${sel.mb.socket}` });
    score -= 40;
  } else {
    issues.push({ t: 'ok',   msg: `Socket ${sel.cpu.socket} compatível ✓` });
  }

  // Cooler × TDP da CPU
  if (sel.cooler.tdp_max < sel.cpu.tdp) {
    issues.push({ t: 'err',  msg: `Cooler insuficiente: suporta ${sel.cooler.tdp_max}W, CPU exige ${sel.cpu.tdp}W` });
    score -= 25;
  } else if (sel.cooler.tdp_max < sel.cpu.tdp * 1.2) {
    issues.push({ t: 'warn', msg: `Cooler no limite — recomendamos mais margem térmica` });
    score -= 8;
  } else {
    issues.push({ t: 'ok',   msg: `Cooler adequado para o TDP do processador ✓` });
  }

  // Overclock
  if (!sel.mb.oc && (sel.cpu.id === 'i7-13700K' || sel.cpu.id === 'i9-13900K')) {
    issues.push({ t: 'warn', msg: `Mobo B-series: overclock de CPU K-series bloqueado` });
    score -= 12;
  }

  // Bottleneck CPU × GPU
  if (sel.cpu.perf < sel.gpu.perf - 25) {
    issues.push({ t: 'warn', msg: `Possível bottleneck de CPU — GPU é mais potente` });
    score -= 8;
  } else if (sel.gpu.perf < sel.cpu.perf - 25) {
    issues.push({ t: 'warn', msg: `GPU limita o build — CPU tem potencial maior` });
    score -= 5;
  } else {
    issues.push({ t: 'ok',   msg: `Bom equilíbrio CPU ↔ GPU ✓` });
  }

  score = Math.max(0, Math.min(100, score));
  const color = score >= 80 ? 'var(--green)' : score >= 55 ? 'var(--yellow)' : 'var(--red)';
  const word  = score >= 80 ? 'ÓTIMO'        : score >= 55 ? 'REGULAR'       : 'CRÍTICO';

  $('compat-section').innerHTML = `
    <div class="compat-score-row">
      <div class="compat-num" style="color:${color}">${score}</div>
      <div class="compat-label-block">
        <div class="compat-word" style="color:${color}">${word}</div>
        <div class="compat-bar-wrap">
          <div class="compat-bar-fill" style="width:${score}%;background:${color}"></div>
        </div>
      </div>
    </div>
    <div class="issue-list">
      ${issues.map(i => `
        <div class="issue ${i.t}">
          <div class="issue-dot"></div>
          <span>${i.msg}</span>
        </div>`).join('')}
    </div>`;
}

/* ---------- Performance estimada ---------- */
function updatePerformance() {
  const gp   = sel.gpu.perf;
  const cp   = sel.cpu.perf;
  const dlss = sel.gpu.marca === 'nvidia' ? 8 : 0;

  const perfs = [
    { label: '1080p · Ultra', score: Math.min(100, Math.round(gp * 0.95)), fps: Math.round(gp * 1.8)  },
    { label: '1440p · Ultra', score: Math.min(100, Math.round(gp * 0.75)), fps: Math.round(gp * 1.3)  },
    { label: '4K · Ultra',    score: Math.min(100, Math.round(gp * 0.52)), fps: Math.round(gp * 0.85) },
    { label: 'Ray Tracing',   score: Math.min(100, Math.round((gp + dlss) * 0.58)), fps: Math.round((gp + dlss) * 0.95) },
  ];

  const scoreGeral = Math.round(cp * 0.35 + gp * 0.65);

  $('perf-section').innerHTML = `
    <div class="perf-list">
      ${perfs.map(p => `
        <div class="perf-row">
          <div class="perf-row-top">
            <span class="perf-res">${p.label}</span>
            <span class="perf-fps">~${p.fps} FPS</span>
          </div>
          <div class="perf-track">
            <div class="perf-fill" style="width:${p.score}%"></div>
          </div>
        </div>`).join('')}
    </div>
    <div style="height:10px"></div>
    <div class="glow-sep"></div>
    <div style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-top:8px;line-height:1.8">
      SCORE GERAL:
      <span style="color:var(--accent);font-size:13px;font-family:var(--head);font-weight:700">
        ${scoreGeral}
      </span> / 100<br>
      ${sel.gpu.marca === 'nvidia' ? '✦ DLSS 3 disponível' : '✦ FSR 3 disponível'}
    </div>`;
}

/* ---------- Init ---------- */
loadData();
