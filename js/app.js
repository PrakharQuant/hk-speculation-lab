/**
 * HK Speculation Lab — Main Application (fixed non-module version)
 */
const DEFAULTS = { phi: 0.80, delta: 0.95, state: 1 };

function transitionMatrix1(phi) {
  return [[phi, 1 - phi], [1 - phi, phi]];
}
function transitionMatrix2(phi) {
  return [[1 - phi, phi], [phi, 1 - phi]];
}

function fundamentalMatrix(phi, delta, agent) {
  const Q = agent === 1 ? transitionMatrix1(phi) : transitionMatrix2(phi);
  const I_dQ = [
    [1 - delta * Q[0][0], -delta * Q[0][1]],
    [-delta * Q[1][0], 1 - delta * Q[1][1]]
  ];
  const det = I_dQ[0][0] * I_dQ[1][1] - I_dQ[0][1] * I_dQ[1][0];
  if (Math.abs(det) < 1e-14) return [0, 0];
  const inv = [
    [I_dQ[1][1] / det, -I_dQ[0][1] / det],
    [-I_dQ[1][0] / det, I_dQ[0][0] / det]
  ];
  const d = [0, 1];
  const temp = [inv[0][0]*d[0] + inv[0][1]*d[1], inv[1][0]*d[0] + inv[1][1]*d[1]];
  const Qtemp = [Q[0][0]*temp[0] + Q[0][1]*temp[1], Q[1][0]*temp[0] + Q[1][1]*temp[1]];
  return [delta * Qtemp[0], delta * Qtemp[1]];
}

function equilibriumPrice(phi, delta) {
  return delta * phi / (1 - delta);
}

function computeModel(phi, delta, state) {
  const p = equilibriumPrice(phi, delta);
  const F1 = fundamentalMatrix(phi, delta, 1);
  const F2 = fundamentalMatrix(phi, delta, 2);
  const premAbs = p - F1[state];
  const premPct = F1[state] > 0 ? 100 * (p / F1[state] - 1) : NaN;
  return {
    price: p,
    fundamentals: { agent1: F1, agent2: F2 },
    premium: { absolute: premAbs, relativePct: premPct, ratio: F1[state] / p },
    riskFree: 1 / delta - 1,
    transition: { agent1: transitionMatrix1(phi), agent2: transitionMatrix2(phi) }
  };
}

let state = { ...DEFAULTS };

function format(n, digits = 4) {
  if (!isFinite(n)) return '—';
  return Number(n).toFixed(digits);
}
function formatPct(n) {
  if (!isFinite(n)) return '—';
  return n.toFixed(2) + '%';
}

function updateOverview(m) {
  const metrics = [
    { label: 'Equilibrium Price', value: format(m.price), cls: 'accent' },
    { label: 'Agent 1 Fundamental', value: format(m.fundamentals.agent1[state.state]) },
    { label: 'Agent 2 Fundamental', value: format(m.fundamentals.agent2[state.state]) },
    { label: 'Absolute Premium', value: format(m.premium.absolute), cls: m.premium.absolute > 0 ? 'positive' : '' },
    { label: '% Premium', value: formatPct(m.premium.relativePct) },
    { label: 'F/P Ratio', value: format(m.premium.ratio, 3) },
    { label: 'Current State', value: state.state },
    { label: 'Discount Factor δ', value: format(state.delta, 3) },
    { label: 'Implied r_f', value: formatPct(m.riskFree * 100) }
  ];
  const container = document.getElementById('overview-metrics');
  if (container) {
    container.innerHTML = metrics.map(met =>
      '<div class="metric"><div class="label">' + met.label + '</div><div class="value ' + (met.cls || '') + '">' + met.value + '</div></div>'
    ).join('');
  }
  const interp = document.getElementById('overview-interpretation');
  if (interp) {
    interp.innerHTML = 'Agent 1 values the asset at <strong>' + format(m.fundamentals.agent1[state.state]) +
      '</strong> in state ' + state.state + ', while the equilibrium market price is <strong>' + format(m.price) +
      '</strong>. The difference reflects the value of resale opportunities under heterogeneous beliefs and short-sale constraints.';
  }
}

function buildExplorerControls() {
  const c = document.getElementById('explorer-controls');
  if (!c) return;
  c.innerHTML =
    '<div class="control-group"><label>Belief parameter φ <span class="control-value" id="phi-val">' + state.phi + '</span></label>' +
    '<input type="range" id="phi-slider" min="0.50" max="0.98" step="0.01" value="' + state.phi + '"></div>' +
    '<div class="control-group"><label>Discount factor δ <span class="control-value" id="delta-val">' + state.delta + '</span></label>' +
    '<input type="range" id="delta-slider" min="0.50" max="0.98" step="0.01" value="' + state.delta + '"></div>' +
    '<div class="control-group"><label>Current state</label><select id="state-select">' +
    '<option value="0"' + (state.state===0?' selected':'') + '>State 0 (d=0)</option>' +
    '<option value="1"' + (state.state===1?' selected':'') + '>State 1 (d=1)</option></select></div>';

  const phiSlider = document.getElementById('phi-slider');
  if (phiSlider) phiSlider.addEventListener('input', function(e) {
    state.phi = parseFloat(e.target.value);
    document.getElementById('phi-val').textContent = state.phi.toFixed(2);
    updateAll();
  });
  const deltaSlider = document.getElementById('delta-slider');
  if (deltaSlider) deltaSlider.addEventListener('input', function(e) {
    state.delta = parseFloat(e.target.value);
    document.getElementById('delta-val').textContent = state.delta.toFixed(2);
    updateAll();
  });
  const stateSelect = document.getElementById('state-select');
  if (stateSelect) stateSelect.addEventListener('change', function(e) {
    state.state = parseInt(e.target.value);
    updateAll();
  });
  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn) resetBtn.addEventListener('click', function() {
    state = { ...DEFAULTS };
    buildExplorerControls();
    updateAll();
  });
}

function updateAll() {
  try {
    const m = computeModel(state.phi, state.delta, state.state);
    updateOverview(m);
    const results = document.getElementById('explorer-results');
    if (results) {
      results.innerHTML = '<table><tr><th>Quantity</th><th class="num">Value</th></tr>' +
        '<tr><td>Equilibrium price p</td><td class="num">' + format(m.price) + '</td></tr>' +
        '<tr><td>Agent 1 fundamental</td><td class="num">' + format(m.fundamentals.agent1[state.state]) + '</td></tr>' +
        '<tr><td>Agent 2 fundamental</td><td class="num">' + format(m.fundamentals.agent2[state.state]) + '</td></tr>' +
        '<tr><td>Absolute Premium</td><td class="num">' + format(m.premium.absolute) + '</td></tr></table>';
    }
  } catch (err) {
    console.error(err);
    const interp = document.getElementById('overview-interpretation');
    if (interp) interp.innerHTML = '<strong style="color:#f87171">Error:</strong> ' + err.message;
  }
}

function setupNavigation() {
  document.querySelectorAll('#main-nav button').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('#main-nav button').forEach(function(b) { b.classList.remove('active'); });
      document.querySelectorAll('.section').forEach(function(s) { s.classList.remove('active'); });
      btn.classList.add('active');
      const section = document.getElementById(btn.dataset.section);
      if (section) section.classList.add('active');
      updateAll();
    });
  });
}

function init() {
  setupNavigation();
  buildExplorerControls();
  updateAll();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
