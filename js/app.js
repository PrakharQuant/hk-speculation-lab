/**
 * HK Speculation Lab — Main Application (non-module for maximum compatibility)
 * All model calculations are included inline.
 */

// ========== MODEL (inlined from model.js) ==========
const DEFAULTS = {
  phi: 0.80,
  delta: 0.95,
  state: 1
};

const PARAM_BOUNDS = {
  phi: { min: 0.50, max: 0.98 },
  delta: { min: 0.50, max: 0.98 }
};

function validateParams(phi, delta) {
  if (typeof phi !== 'number' || phi < PARAM_BOUNDS.phi.min || phi >= 1) {
    throw new Error(`Invalid phi: ${phi}. Must be in [${PARAM_BOUNDS.phi.min}, 1).`);
  }
  if (typeof delta !== 'number' || delta <= 0 || delta >= 1 || delta < PARAM_BOUNDS.delta.min) {
    throw new Error(`Invalid delta: ${delta}. Must be in [${PARAM_BOUNDS.delta.min}, 1).`);
  }
  return true;
}

function transitionMatrix1(phi) {
  validateParams(phi, 0.9);
  return [
    [phi, 1 - phi],
    [1 - phi, phi]
  ];
}

function transitionMatrix2(phi) {
  validateParams(phi, 0.9);
  return [
    [1 - phi, phi],
    [phi, 1 - phi]
  ];
}

function rowsSumToOne(Q, tol = 1e-12) {
  return Q.every(row => Math.abs(row.reduce((a, b) => a + b, 0) - 1) < tol);
}

function matVec(Q, v) {
  return [
    Q[0][0] * v[0] + Q[0][1] * v[1],
    Q[1][0] * v[0] + Q[1][1] * v[1]
  ];
}

function matMul(A, B) {
  return [
    [A[0][0]*B[0][0] + A[0][1]*B[1][0], A[0][0]*B[0][1] + A[0][1]*B[1][1]],
    [A[1][0]*B[0][0] + A[1][1]*B[1][0], A[1][0]*B[0][1] + A[1][1]*B[1][1]]
  ];
}

function matPow(Q, n) {
  if (n === 0) return [[1, 0], [0, 1]];
  if (n === 1) return Q.map(r => [...r]);
  let result = [[1, 0], [0, 1]];
  let base = Q.map(r => [...r]);
  let exp = n;
  while (exp > 0) {
    if (exp % 2 === 1) result = matMul(result, base);
    base = matMul(base, base);
    exp = Math.floor(exp / 2);
  }
  return result;
}

function expectedDividend(Q, i) {
  const d = [0, 1];
  if (i === 0) return d;
  const Qi = matPow(Q, i);
  return matVec(Qi, d);
}

function fundamentalClosedForm(phi, delta) {
  validateParams(phi, delta);
  const denom = (1 - delta) * (1 + delta - 2 * delta * phi);
  if (Math.abs(denom) < 1e-14) {
    throw new Error('Numerical singularity in fundamental value denominator.');
  }
  const F0_1 = delta * (1 - phi) / denom;
  const F1_1 = delta * (phi + delta - 2 * delta * phi) / denom;
  return {
    agent1: [F0_1, F1_1],
    agent2: [F1_1, F0_1]
  };
}

function fundamentalMatrix(phi, delta, agent = 1) {
  validateParams(phi, delta);
  const Q = agent === 1 ? transitionMatrix1(phi) : transitionMatrix2(phi);
  const dQ = delta;
  const I_dQ = [
    [1 - dQ * Q[0][0], -dQ * Q[0][1]],
    [-dQ * Q[1][0], 1 - dQ * Q[1][1]]
  ];
  const det = I_dQ[0][0] * I_dQ[1][1] - I_dQ[0][1] * I_dQ[1][0];
  if (Math.abs(det) < 1e-14) {
    throw new Error('Singular matrix in fundamental value calculation.');
  }
  const inv = [
    [I_dQ[1][1] / det, -I_dQ[0][1] / det],
    [-I_dQ[1][0] / det, I_dQ[0][0] / det]
  ];
  const d = [0, 1];
  const temp = matVec(inv, d);
  const Qtemp = matVec(Q, temp);
  return [dQ * Qtemp[0], dQ * Qtemp[1]];
}

function equilibriumPrice(phi, delta) {
  validateParams(phi, delta);
  return delta * phi / (1 - delta);
}

function speculativePremium(p, F) {
  if (F <= 0) {
    return { absolute: NaN, relativePct: NaN, ratio: NaN };
  }
  const absolute = p - F;
  const relativePct = 100 * (p / F - 1);
  const ratio = F / p;
  return { absolute, relativePct, ratio };
}

function expectedReturn(phi, delta, agent, state) {
  validateParams(phi, delta);
  const p = equilibriumPrice(phi, delta);
  const Q = agent === 1 ? transitionMatrix1(phi) : transitionMatrix2(phi);
  const row = Q[state];
  const E_d_plus_p = row[0] * (0 + p) + row[1] * (1 + p);
  const gross = E_d_plus_p / p;
  return { gross, net: gross - 1 };
}

function riskFreeRate(delta) {
  return 1 / delta - 1;
}

function computeModel(phi, delta, state) {
  validateParams(phi, delta);
  const p = equilibriumPrice(phi, delta);
  const Fmat1 = fundamentalMatrix(phi, delta, 1);
  const Fmat2 = fundamentalMatrix(phi, delta, 2);
  const Fcf = fundamentalClosedForm(phi, delta);
  const prem1 = speculativePremium(p, Fmat1[state]);
  const prem2 = speculativePremium(p, Fmat2[state]);
  const ret1 = expectedReturn(phi, delta, 1, state);
  const ret2 = expectedReturn(phi, delta, 2, state);
  const r = riskFreeRate(delta);

  return {
    phi, delta, state,
    price: p,
    fundamentals: {
      agent1: Fmat1,
      agent2: Fmat2,
      closedForm: Fcf
    },
    premium: {
      agent1: prem1,
      agent2: prem2
    },
    returns: {
      agent1: ret1,
      agent2: ret2,
      riskFree: r,
      riskFreeGross: 1 / delta
    },
    transition: {
      agent1: transitionMatrix1(phi),
      agent2: transitionMatrix2(phi)
    }
  };
}

// ========== UI ==========
let state = { ...DEFAULTS };

function format(n, digits = 4) {
  if (!isFinite(n)) return '—';
  return n.toFixed(digits);
}

function formatPct(n) {
  if (!isFinite(n)) return '—';
  return n.toFixed(2) + '%';
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
    document.getElementById('overview-interpretation').innerHTML = `<strong style="color:#f87171">Error:</strong> ${err.message}`;
  }
}

function updateOverview(m) {
  const prem = m.premium.agent1;
  const metrics = [
    { label: 'Equilibrium Price', value: format(m.price), cls: 'accent' },
    { label: 'Agent 1 Fundamental', value: format(m.fundamentals.agent1[m.state]) },
    { label: 'Agent 2 Fundamental', value: format(m.fundamentals.agent2[m.state]) },
    { label: 'Absolute Premium', value: format(prem.absolute), cls: prem.absolute > 0 ? 'positive' : '' },
    { label: '% Premium', value: formatPct(prem.relativePct) },
    { label: 'F/P Ratio', value: format(prem.ratio, 3) },
    { label: 'Current State', value: m.state },
    { label: 'Discount Factor δ', value: format(m.delta, 3) },
    { label: 'Implied r_f', value: formatPct(m.returns.riskFree * 100) }
  ];
  const container = document.getElementById('overview-metrics');
  if (container) {
    container.innerHTML = metrics.map(met => `
      <div class="metric">
        <div class="label">${met.label}</div>
        <div class="value ${met.cls || ''}">${met.value}</div>
      </div>
    `).join('');
  }

  const F1 = m.fundamentals.agent1[m.state];
  const interp = document.getElementById('overview-interpretation');
  if (interp) {
    interp.innerHTML = `Agent 1 values the asset at <strong>${format(F1)}</strong> in state ${m.state}, while the equilibrium market price is <strong>${format(m.price)}</strong>. The difference reflects the value of resale opportunities under heterogeneous beliefs and short-sale constraints.`;
  }
}

function buildExplorerControls() {
  const c = document.getElementById('explorer-controls');
  if (!c) return;
  c.innerHTML = `
    <div class="control-group">
      <label>Belief parameter φ <span class="control-value" id="phi-val">${state.phi}</span></label>
      <input type="range" id="phi-slider" min="0.50" max="0.98" step="0.01" value="${state.phi}">
    </div>
    <div class="control-group">
      <label>Discount factor δ <span class="control-value" id="delta-val">${state.delta}</span></label>
      <input type="range" id="delta-slider" min="0.50" max="0.98" step="0.01" value="${state.delta}">
    </div>
    <div class="control-group">
      <label>Current state</label>
      <select id="state-select">
        <option value="0" ${state.state===0?'selected':''}>State 0 (d=0)</option>
        <option value="1" ${state.state===1?'selected':''}>State 1 (d=1)</option>
      </select>
    </div>
  `;
  const phiSlider = document.getElementById('phi-slider');
  if (phiSlider) phiSlider.addEventListener('input', e => {
    state.phi = parseFloat(e.target.value);
    document.getElementById('phi-val').textContent = state.phi.toFixed(2);
    updateAll();
  });
  const deltaSlider = document.getElementById('delta-slider');
  if (deltaSlider) deltaSlider.addEventListener('input', e => {
    state.delta = parseFloat(e.target.value);
    document.getElementById('delta-val').textContent = state.delta.toFixed(2);
    updateAll();
  });
  const stateSelect = document.getElementById('state-select');
  if (stateSelect) stateSelect.addEventListener('change', e => {
    state.state = parseInt(e.target.value);
    updateAll();
  });
  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    state = { ...DEFAULTS };
    buildExplorerControls();
    updateAll();
  });
  const pctToggle = document.getElementById('pct-toggle');
  if (pctToggle) pctToggle.addEventListener('change', updateAll);
}

function updateExplorer(m) {
  const pct = document.getElementById('pct-toggle')?.checked;
  const results = document.getElementById('explorer-results');
  if (!results) return;
  const p = m.price;
  const F1 = m.fundamentals.agent1[m.state];
  const F2 = m.fundamentals.agent2[m.state];
  const prem1 = m.premium.agent1;
  const prem2 = m.premium.agent2;
  results.innerHTML = `
    <table>
      <tr><th>Quantity</th><th class="num">Value</th></tr>
      <tr><td>Equilibrium price p</td><td class="num">${format(p)}</td></tr>
      <tr><td>Agent 1 fundamental</td><td class="num">${format(F1)}</td></tr>
      <tr><td>Agent 2 fundamental</td><td class="num">${format(F2)}</td></tr>
      <tr><td>Premium (Agent 1)</td><td class="num">${pct ? formatPct(prem1.relativePct) : format(prem1.absolute)}</td></tr>
      <tr><td>Premium (Agent 2)</td><td class="num">${pct ? formatPct(prem2.relativePct) : format(prem2.absolute)}</td></tr>
      <tr><td>Risk-free rate</td><td class="num">${formatPct(m.returns.riskFree*100)}</td></tr>
    </table>
  `;

  if (window.Plotly) {
    const data = [
      { x: ['Price', 'Agent 1 F', 'Agent 2 F'], y: [p, F1, F2], type: 'bar', marker: { color: ['#2dd4bf', '#38bdf8', '#fbbf24'] } }
    ];
    Plotly.newPlot('explorer-chart', data, {
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
    container.innerHTML = `
      <div>
        <h4>Agent 1 (Persistence)</h4>
        <table>
          <tr><th></th><th>→0</th><th>→1</th></tr>
          <tr><td>from 0</td><td class="num">${format(Q1[0][0],3)}</td><td class="num">${format(Q1[0][1],3)}</td></tr>
          <tr><td>from 1</td><td class="num">${format(Q1[1][0],3)}</td><td class="num">${format(Q1[1][1],3)}</td></tr>
        </table>
      </div>
      <div>
        <h4>Agent 2 (Alternation)</h4>
        <table>
          <tr><th></th><th>→0</th><th>→1</th></tr>
          <tr><td>from 0</td><td class="num">${format(Q2[0][0],3)}</td><td class="num">${format(Q2[0][1],3)}</td></tr>
          <tr><td>from 1</td><td class="num">${format(Q2[1][0],3)}</td><td class="num">${format(Q2[1][1],3)}</td></tr>
        </table>
      </div>
    `;
  }

  if (window.Plotly) {
    const horizons = Array.from({length: 10}, (_, i) => i + 1);
    const ed1 = horizons.map(h => {
      let v = [1 - state.state, state.state];
      for (let i = 0; i < h; i++) {
        v = [Q1[0][0]*v[0] + Q1[1][0]*v[1], Q1[0][1]*v[0] + Q1[1][1]*v[1]];
      }
      return v[1];
    });
    const ed2 = horizons.map(h => {
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
      xaxis: { title: 'Horizon (periods)' }, yaxis: { title: 'Expected dividend' },
      legend: { orientation: 'h' }
    }, { responsive: true, displayModeBar: false });
  }
}

function updatePrice(m) {
  if (!window.Plotly) return;
  const states = [0, 1];
  const F1 = states.map(s => m.fundamentals.agent1[s]);
  const F2 = states.map(s => m.fundamentals.agent2[s]);
  const p = [m.price, m.price];
  Plotly.newPlot('price-chart', [
    { x: states, y: F1, name: 'Agent 1 F', line: { color: '#38bdf8' } },
    { x: states, y: F2, name: 'Agent 2 F', line: { color: '#fbbf24' } },
    { x: states, y: p, name: 'Equilibrium p', line: { color: '#2dd4bf', width: 3 } }
  ], {
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#e6edf3' }, margin: { t: 20, b: 40, l: 50, r: 20 },
    xaxis: { title: 'State', tickvals: [0,1] }, yaxis: { title: 'Value' }
  }, { responsive: true, displayModeBar: false });

  const prem1 = states.map(s => m.price - m.fundamentals.agent1[s]);
  const prem2 = states.map(s => m.price - m.fundamentals.agent2[s]);
  Plotly.newPlot('premium-chart', [
    { x: states, y: prem1, name: 'Premium A1', type: 'bar', marker: { color: '#38bdf8' } },
    { x: states, y: prem2, name: 'Premium A2', type: 'bar', marker: { color: '#fbbf24' } }
  ], {
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#e6edf3' }, margin: { t: 20, b: 40, l: 50, r: 20 },
    xaxis: { title: 'State' }, yaxis: { title: 'Absolute premium' }, barmode: 'group' }
  }, { responsive: true, displayModeBar: false });

  const table = document.getElementById('price-table');
  if (table) {
    table.innerHTML = `
      <table>
        <tr><th>State</th><th class="num">p</th><th class="num">F¹</th><th class="num">F²</th><th class="num">Prem¹</th><th class="num">Prem²</th></tr>
        ${states.map(s => `
          <tr>
            <td>${s}</td>
            <td class="num">${format(m.price)}</td>
            <td class="num">${format(m.fundamentals.agent1[s])}</td>
            <td class="num">${format(m.fundamentals.agent2[s])}</td>
            <td class="num">${format(m.price - m.fundamentals.agent1[s])}</td>
            <td class="num">${format(m.price - m.fundamentals.agent2[s])}</td>
          </tr>
        `).join('')}
      </table>
    `;
  }
}

function updateSensitivity() {
  if (!window.Plotly) return;
  // Phi sensitivity
  const phis = [];
  const prices = [], F1s = [], F2s = [];
  for (let phi = 0.50; phi <= 0.98; phi += 0.01) {
    phis.push(+(phi.toFixed(2)));
    prices.push(equilibriumPrice(phi, state.delta));
    const f1 = fundamentalMatrix(phi, state.delta, 1);
    const f2 = fundamentalMatrix(phi, state.delta, 2);
    F1s.push(f1[state.state]);
    F2s.push(f2[state.state]);
  }
  Plotly.newPlot('sens-phi-chart', [
    { x: phis, y: prices, name: 'p', line: { color: '#2dd4bf', width: 3 } },
    { x: phis, y: F1s, name: 'F¹', line: { color: '#38bdf8' } },
    { x: phis, y: F2s, name: 'F²', line: { color: '#fbbf24' } }
  ], {
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#e6edf3' }, margin: { t: 20, b: 40, l: 50, r: 20 },
    xaxis: { title: 'φ' }, yaxis: { title: 'Value' }
  }, { responsive: true, displayModeBar: false });

  // Delta sensitivity
  const deltas = [];
  const pricesD = [], F1d = [], F2d = [];
  for (let delta = 0.50; delta <= 0.98; delta += 0.01) {
    deltas.push(+(delta.toFixed(2)));
    pricesD.push(equilibriumPrice(state.phi, delta));
    const f1 = fundamentalMatrix(state.phi, delta, 1);
    const f2 = fundamentalMatrix(state.phi, delta, 2);
    F1d.push(f1[state.state]);
    F2d.push(f2[state.state]);
  }
  Plotly.newPlot('sens-delta-chart', [
    { x: deltas, y: pricesD, name: 'p', line: { color: '#2dd4bf', width: 3 } },
    { x: deltas, y: F1d, name: 'F¹', line: { color: '#38bdf8' } },
    { x: deltas, y: F2d, name: 'F²', line: { color: '#fbbf24' } }
  ], {
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#e6edf3' }, margin: { t: 20, b: 40, l: 50, r: 20 },
    xaxis: { title: 'δ' }, yaxis: { title: 'Value' }
  }, { responsive: true, displayModeBar: false });

  // Heatmaps
  const phiGrid = [], deltaGrid = [], priceGrid = [], premGrid = [];
  for (let phi = 0.5; phi <= 0.95; phi += 0.05) {
    phiGrid.push(+(phi.toFixed(2)));
    const rowP = [], rowPrem = [];
    for (let delta = 0.5; delta <= 0.95; delta += 0.05) {
      if (phiGrid.length === 1) deltaGrid.push(+(delta.toFixed(2)));
      const p = equilibriumPrice(phi, delta);
      const f = fundamentalMatrix(phi, delta, 1)[1];
      rowP.push(p);
      rowPrem.push(p - f);
    }
    priceGrid.push(rowP);
    premGrid.push(rowPrem);
  }
  Plotly.newPlot('heatmap-price', [{ z: priceGrid, x: deltaGrid, y: phiGrid, type: 'heatmap', colorscale: 'Viridis' }], {
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#e6edf3' }, margin: { t: 20, b: 40, l: 50, r: 20 },
    xaxis: { title: 'δ' }, yaxis: { title: 'φ' }, title: 'Equilibrium Price'
  }, { responsive: true, displayModeBar: false });
  Plotly.newPlot('heatmap-premium', [{ z: premGrid, x: deltaGrid, y: phiGrid, type: 'heatmap', colorscale: 'Inferno' }], {
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#e6edf3' }, margin: { t: 20, b: 40, l: 50, r: 20 },
    xaxis: { title: 'δ' }, yaxis: { title: 'φ' }, title: 'Speculative Premium (state 1, A1)'
  }, { responsive: true, displayModeBar: false });
}

function updateReturns(m) {
  if (!window.Plotly) return;
  const states = [0, 1];
  const r1 = states.map(s => expectedReturn(state.phi, state.delta, 1, s).gross);
  const r2 = states.map(s => expectedReturn(state.phi, state.delta, 2, s).gross);
  const rf = 1 / state.delta;
  Plotly.newPlot('returns-chart', [
    { x: states, y: r1, name: 'Agent 1', type: 'bar', marker: { color: '#38bdf8' } },
    { x: states, y: r2, name: 'Agent 2', type: 'bar', marker: { color: '#fbbf24' } },
    { x: states, y: [rf, rf], name: 'Risk-free', line: { color: '#2dd4bf', dash: 'dash' }, type: 'scatter' }
  ], {
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#e6edf3' }, margin: { t: 20, b: 40, l: 50, r: 20 },
    xaxis: { title: 'State' }, yaxis: { title: 'Expected gross return' }, barmode: 'group' }
  }, { responsive: true, displayModeBar: false });

  const table = document.getElementById('returns-table');
  if (table) {
    table.innerHTML = `
      <table>
        <tr><th>State</th><th class="num">R¹ gross</th><th class="num">R¹ net</th><th class="num">R² gross</th><th class="num">R² net</th><th class="num">R_f</th></tr>
        ${states.map(s => {
          const e1 = expectedReturn(state.phi, state.delta, 1, s);
          const e2 = expectedReturn(state.phi, state.delta, 2, s);
          return `<tr><td>${s}</td><td class="num">${format(e1.gross,4)}</td><td class="num">${format(e1.net,4)}</td><td class="num">${format(e2.gross,4)}</td><td class="num">${format(e2.net,4)}</td><td class="num">${format(rf,4)}</td></tr>`;
        }).join('')}
      </table>
    `;
  }
}

function updateBubbles(m) {
  if (!window.Plotly) return;
  const t = Array.from({length: 20}, (_, i) => i);
  const fund = t.map(() => m.fundamentals.agent1[1]);
  const hk = t.map(() => m.price);
  const bubble = t.map(i => 0.5 * Math.pow(1/state.delta, i));
  const total = t.map((i, idx) => hk[idx] + bubble[idx]);
  Plotly.newPlot('bubble-chart', [
    { x: t, y: fund, name: 'Fundamental (A1)', line: { color: '#38bdf8' } },
    { x: t, y: hk, name: 'HK Price', line: { color: '#2dd4bf' } },
    { x: t, y: total, name: 'HK + Illustrative Bubble', line: { color: '#f87171', dash: 'dot' } }
  ], {
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#e6edf3' }, margin: { t: 20, b: 40, l: 50, r: 20 },
    xaxis: { title: 'Period' }, yaxis: { title: 'Price' }
  }, { responsive: true, displayModeBar: false });
}

// Navigation
function setupNavigation() {
  document.querySelectorAll('#main-nav button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#main-nav button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      const section = document.getElementById(btn.dataset.section);
      if (section) section.classList.add('active');
      updateAll();
    });
  });
}

// Initialize — run whether or not DOMContentLoaded has already fired
function init() {
  setupNavigation();
  buildExplorerControls();
  updateAll();
  if (window.renderMathInElement) {
    renderMathInElement(document.body, {
      delimiters: [{left: '\\(', right: '\\)', display: false}, {left: '\\[', right: '\\]', display: true}]
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Fallback if Plotly fails
window.addEventListener('error', e => {
  if (e.message && e.message.includes('Plotly')) {
    document.querySelectorAll('.chart-container').forEach(el => {
      el.innerHTML = '<p style="color:#8b9bb4;padding:1rem;">Chart library failed to load. Numerical values remain available above.</p>';
    });
  }
});
