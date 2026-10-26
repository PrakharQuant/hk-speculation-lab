/**
 * HK Speculation Lab — Full interactive application (non-module)
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

function expectedReturn(phi, delta, agent, s) {
  const p = equilibriumPrice(phi, delta);
  const Q = agent === 1 ? transitionMatrix1(phi) : transitionMatrix2(phi);
  const row = Q[s];
  const E = row[0] * (0 + p) + row[1] * (1 + p);
  return { gross: E / p, net: E / p - 1 };
}

function computeModel(phi, delta, st) {
  const p = equilibriumPrice(phi, delta);
  const F1 = fundamentalMatrix(phi, delta, 1);
  const F2 = fundamentalMatrix(phi, delta, 2);
  const premAbs = p - F1[st];
  const premPct = F1[st] > 0 ? 100 * (p / F1[st] - 1) : NaN;
  return {
    price: p,
    fundamentals: { agent1: F1, agent2: F2 },
    premium: { absolute: premAbs, relativePct: premPct, ratio: F1[st] / p },
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
    container.innerHTML = metrics.map(function(met) {
      return '<div class="metric"><div class="label">' + met.label + '</div><div class="value ' + (met.cls || '') + '">' + met.value + '</div></div>';
    }).join('');
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

function updateExplorer(m) {
  const results = document.getElementById('explorer-results');
  if (results) {
    results.innerHTML = '<table><tr><th>Quantity</th><th class="num">Value</th></tr>' +
      '<tr><td>Equilibrium price p</td><td class="num">' + format(m.price) + '</td></tr>' +
      '<tr><td>Agent 1 fundamental</td><td class="num">' + format(m.fundamentals.agent1[state.state]) + '</td></tr>' +
      '<tr><td>Agent 2 fundamental</td><td class="num">' + format(m.fundamentals.agent2[state.state]) + '</td></tr>' +
      '<tr><td>Absolute Premium</td><td class="num">' + format(m.premium.absolute) + '</td></tr></table>';
  }
  if (window.Plotly) {
    Plotly.newPlot('explorer-chart', [{
      x: ['Price', 'Agent 1 F', 'Agent 2 F'],
      y: [m.price, m.fundamentals.agent1[state.state], m.fundamentals.agent2[state.state]],
      type: 'bar',
      marker: { color: ['#2dd4bf', '#38bdf8', '#fbbf24'] }
    }], {
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: '#e6edf3' }, margin: { t: 20, b: 40, l: 50, r: 20 },
      yaxis: { title: 'Value' }, showlegend: false
    }, { responsive: true, displayModeBar: false });
  }
}

function updateBeliefs(m) {
  const Q1 = m.transition.agent1;
  const Q2 = m.transition.agent2;
  const container = document.getElementById('belief-matrices');
  if (container) {
    container.innerHTML =
      '<div><h4>Agent 1 (Persistence)</h4><table>' +
      '<tr><th></th><th>→0</th><th>→1</th></tr>' +
      '<tr><td>from 0</td><td class="num">' + format(Q1[0][0], 3) + '</td><td class="num">' + format(Q1[0][1], 3) + '</td></tr>' +
      '<tr><td>from 1</td><td class="num">' + format(Q1[1][0], 3) + '</td><td class="num">' + format(Q1[1][1], 3) + '</td></tr>' +
      '</table></div>' +
      '<div><h4>Agent 2 (Alternation)</h4><table>' +
      '<tr><th></th><th>→0</th><th>→1</th></tr>' +
      '<tr><td>from 0</td><td class="num">' + format(Q2[0][0], 3) + '</td><td class="num">' + format(Q2[0][1], 3) + '</td></tr>' +
      '<tr><td>from 1</td><td class="num">' + format(Q2[1][0], 3) + '</td><td class="num">' + format(Q2[1][1], 3) + '</td></tr>' +
      '</table></div>';
  }
  if (window.Plotly) {
    const horizons = [1,2,3,4,5,6,7,8,9,10];
    const ed1 = horizons.map(function(h) {
      let v = [1 - state.state, state.state];
      for (let i = 0; i < h; i++) {
        v = [Q1[0][0]*v[0] + Q1[1][0]*v[1], Q1[0][1]*v[0] + Q1[1][1]*v[1]];
      }
      return v[1];
    });
    const ed2 = horizons.map(function(h) {
      let v = [1 - state.state, state.state];
      for (let i = 0; i < h; i++) {
        v = [Q2[0][0]*v[0] + Q2[1][0]*v[1], Q2[0][1]*v[0] + Q2[1][1]*v[1]];
      }
      return v[1];
    });
    Plotly.newPlot('forecast-chart', [
      { x: horizons, y: ed1, name: 'Agent 1', line: { color: '#38bdf8' } },
      { x: horizons, y: ed2, name: 'Agent 2', line: { color: '#fbbf24' } }
    ], {
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: '#e6edf3' }, margin: { t: 20, b: 40, l: 50, r: 20 },
      xaxis: { title: 'Horizon (periods)' }, yaxis: { title: 'Expected dividend' }
    }, { responsive: true, displayModeBar: false });
  }
}

function updatePrice(m) {
  if (!window.Plotly) return;
  const states = [0, 1];
  Plotly.newPlot('price-chart', [
    { x: states, y: states.map(function(s){ return m.fundamentals.agent1[s]; }), name: 'Agent 1 F', line: { color: '#38bdf8' } },
    { x: states, y: states.map(function(s){ return m.fundamentals.agent2[s]; }), name: 'Agent 2 F', line: { color: '#fbbf24' } },
    { x: states, y: [m.price, m.price], name: 'Equilibrium p', line: { color: '#2dd4bf', width: 3 } }
  ], {
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#e6edf3' }, margin: { t: 20, b: 40, l: 50, r: 20 },
    xaxis: { title: 'State', tickvals: [0,1] }, yaxis: { title: 'Value' }
  }, { responsive: true, displayModeBar: false });

  Plotly.newPlot('premium-chart', [
    { x: states, y: states.map(function(s){ return m.price - m.fundamentals.agent1[s]; }), name: 'Premium A1', type: 'bar', marker: { color: '#38bdf8' } },
    { x: states, y: states.map(function(s){ return m.price - m.fundamentals.agent2[s]; }), name: 'Premium A2', type: 'bar', marker: { color: '#fbbf24' } }
  ], {
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#e6edf3' }, margin: { t: 20, b: 40, l: 50, r: 20 },
    xaxis: { title: 'State' }, yaxis: { title: 'Absolute premium' }, barmode: 'group'
  }, { responsive: true, displayModeBar: false });
}

function updateSensitivity() {
  if (!window.Plotly) return;
  const phis = [], prices = [], F1s = [], F2s = [];
  for (let phi = 0.50; phi <= 0.98; phi += 0.02) {
    phis.push(+(phi.toFixed(2)));
    prices.push(equilibriumPrice(phi, state.delta));
    const f1 = fundamentalMatrix(phi, state.delta, 1);
    const f2 = fundamentalMatrix(phi, state.delta, 2);
    F1s.push(f1[state.state]);
    F2s.push(f2[state.state]);
  }
  Plotly.newPlot('sens-phi-chart', [
    { x: phis, y: prices, name: 'p', line: { color: '#2dd4bf', width: 3 } },
    { x: phis, y: F1s, name: 'F1', line: { color: '#38bdf8' } },
    { x: phis, y: F2s, name: 'F2', line: { color: '#fbbf24' } }
  ], {
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#e6edf3' }, margin: { t: 20, b: 40, l: 50, r: 20 },
    xaxis: { title: 'φ' }, yaxis: { title: 'Value' }
  }, { responsive: true, displayModeBar: false });

  const deltas = [], pricesD = [], F1d = [], F2d = [];
  for (let delta = 0.50; delta <= 0.98; delta += 0.02) {
    deltas.push(+(delta.toFixed(2)));
    pricesD.push(equilibriumPrice(state.phi, delta));
    const f1 = fundamentalMatrix(state.phi, delta, 1);
    const f2 = fundamentalMatrix(state.phi, delta, 2);
    F1d.push(f1[state.state]);
    F2d.push(f2[state.state]);
  }
  Plotly.newPlot('sens-delta-chart', [
    { x: deltas, y: pricesD, name: 'p', line: { color: '#2dd4bf', width: 3 } },
    { x: deltas, y: F1d, name: 'F1', line: { color: '#38bdf8' } },
    { x: deltas, y: F2d, name: 'F2', line: { color: '#fbbf24' } }
  ], {
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#e6edf3' }, margin: { t: 20, b: 40, l: 50, r: 20 },
    xaxis: { title: 'δ' }, yaxis: { title: 'Value' }
  }, { responsive: true, displayModeBar: false });
}

function updateReturns(m) {
  if (!window.Plotly) return;
  const states = [0, 1];
  const r1 = states.map(function(s){ return expectedReturn(state.phi, state.delta, 1, s).gross; });
  const r2 = states.map(function(s){ return expectedReturn(state.phi, state.delta, 2, s).gross; });
  const rf = 1 / state.delta;
  Plotly.newPlot('returns-chart', [
    { x: states, y: r1, name: 'Agent 1', type: 'bar', marker: { color: '#38bdf8' } },
    { x: states, y: r2, name: 'Agent 2', type: 'bar', marker: { color: '#fbbf24' } },
    { x: states, y: [rf, rf], name: 'Risk-free', line: { color: '#2dd4bf', dash: 'dash' }, type: 'scatter' }
  ], {
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#e6edf3' }, margin: { t: 20, b: 40, l: 50, r: 20 },
    xaxis: { title: 'State' }, yaxis: { title: 'Expected gross return' }, barmode: 'group'
  }, { responsive: true, displayModeBar: false });
}

function updateBubbles(m) {
  if (!window.Plotly) return;
  const t = Array.from({length: 15}, function(_, i){ return i; });
  Plotly.newPlot('bubble-chart', [
    { x: t, y: t.map(function(){ return m.fundamentals.agent1[1]; }), name: 'Fundamental (A1)', line: { color: '#38bdf8' } },
    { x: t, y: t.map(function(){ return m.price; }), name: 'HK Speculative', line: { color: '#2dd4bf', width: 3 } }
  ], {
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#e6edf3' }, margin: { t: 20, b: 40, l: 50, r: 20 },
    xaxis: { title: 'Period' }, yaxis: { title: 'Price' }
  }, { responsive: true, displayModeBar: false });
}

function updateAll() {
  try {
    const m = computeModel(state.phi, state.delta, state.state);
    updateOverview(m);
    updateExplorer(m);
    updateBeliefs(m);
    updatePrice(m);
    updateSensitivity();
    updateReturns(m);
    updateBubbles(m);
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
