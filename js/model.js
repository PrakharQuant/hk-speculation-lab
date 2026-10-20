/**
 * Harrison–Kreps (1978) Speculative Asset Pricing Model
 * Core analytical calculations. All functions are pure and numerically stable.
 * 
 * States: 0 (dividend 0), 1 (dividend 1)
 * Agents: 1 (expects persistence), 2 (expects alternation)
 * Parameters: phi (belief disagreement), delta (discount factor)
 */

export const DEFAULTS = {
  phi: 0.80,
  delta: 0.95,
  state: 1
};

export const PARAM_BOUNDS = {
  phi: { min: 0.50, max: 0.98 },
  delta: { min: 0.50, max: 0.98 }
};

/**
 * Validate parameters. Throws if invalid.
 */
export function validateParams(phi, delta) {
  if (typeof phi !== 'number' || phi < PARAM_BOUNDS.phi.min || phi >= 1) {
    throw new Error(`Invalid phi: ${phi}. Must be in [${PARAM_BOUNDS.phi.min}, 1).`);
  }
  if (typeof delta !== 'number' || delta <= 0 || delta >= 1 || delta < PARAM_BOUNDS.delta.min) {
    throw new Error(`Invalid delta: ${delta}. Must be in [${PARAM_BOUNDS.delta.min}, 1).`);
  }
  return true;
}

/**
 * Transition matrix for agent 1 (persistence).
 * Q1 = [[phi, 1-phi], [1-phi, phi]]
 */
export function transitionMatrix1(phi) {
  validateParams(phi, 0.9); // dummy for validation of phi only
  return [
    [phi, 1 - phi],
    [1 - phi, phi]
  ];
}

/**
 * Transition matrix for agent 2 (alternation).
 * Q2 = [[1-phi, phi], [phi, 1-phi]]
 */
export function transitionMatrix2(phi) {
  validateParams(phi, 0.9);
  return [
    [1 - phi, phi],
    [phi, 1 - phi]
  ];
}

/**
 * Check that every row of a 2x2 matrix sums to 1 (within tolerance).
 */
export function rowsSumToOne(Q, tol = 1e-12) {
  return Q.every(row => Math.abs(row.reduce((a, b) => a + b, 0) - 1) < tol);
}

/**
 * Matrix-vector multiply: 2x2 * 2x1
 */
export function matVec(Q, v) {
  return [
    Q[0][0] * v[0] + Q[0][1] * v[1],
    Q[1][0] * v[0] + Q[1][1] * v[1]
  ];
}

/**
 * Matrix power for 2x2 (integer power).
 */
export function matPow(Q, n) {
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

function matMul(A, B) {
  return [
    [A[0][0]*B[0][0] + A[0][1]*B[1][0], A[0][0]*B[0][1] + A[0][1]*B[1][1]],
    [A[1][0]*B[0][0] + A[1][1]*B[1][0], A[1][0]*B[0][1] + A[1][1]*B[1][1]]
  ];
}

/**
 * Expected dividend vector after i steps: (Q^i) d
 * d = [0, 1]
 */
export function expectedDividend(Q, i) {
  const d = [0, 1];
  if (i === 0) return d;
  const Qi = matPow(Q, i);
  return matVec(Qi, d);
}

/**
 * Closed-form fundamental values for the symmetric model.
 * F0^1 = δ(1-φ) / [(1-δ)(1+δ-2δφ)]
 * F1^1 = δ(φ + δ - 2δφ) / [(1-δ)(1+δ-2δφ)]
 * Agent 2 is reversed.
 */
export function fundamentalClosedForm(phi, delta) {
  validateParams(phi, delta);
  const denom = (1 - delta) * (1 + delta - 2 * delta * phi);
  if (Math.abs(denom) < 1e-14) {
    throw new Error('Numerical singularity in fundamental value denominator.');
  }
  const F0_1 = delta * (1 - phi) / denom;
  const F1_1 = delta * (phi + delta - 2 * delta * phi) / denom;
  return {
    agent1: [F0_1, F1_1],
    agent2: [F1_1, F0_1] // reversed
  };
}

/**
 * Matrix-based fundamental value: F = δ Q (I - δ Q)^{-1} d
 * Uses analytic inverse for 2x2.
 */
export function fundamentalMatrix(phi, delta, agent = 1) {
  validateParams(phi, delta);
  const Q = agent === 1 ? transitionMatrix1(phi) : transitionMatrix2(phi);
  const dQ = delta;
  // Compute (I - δQ)
  const I_dQ = [
    [1 - dQ * Q[0][0], -dQ * Q[0][1]],
    [-dQ * Q[1][0], 1 - dQ * Q[1][1]]
  ];
  // Inverse of 2x2
  const det = I_dQ[0][0] * I_dQ[1][1] - I_dQ[0][1] * I_dQ[1][0];
  if (Math.abs(det) < 1e-14) {
    throw new Error('Singular matrix in fundamental value calculation.');
  }
  const inv = [
    [I_dQ[1][1] / det, -I_dQ[0][1] / det],
    [-I_dQ[1][0] / det, I_dQ[0][0] / det]
  ];
  // δ Q * inv * d
  const d = [0, 1];
  const temp = matVec(inv, d); // inv * d
  const Qtemp = matVec(Q, temp); // Q * (inv * d)
  return [dQ * Qtemp[0], dQ * Qtemp[1]];
}

/**
 * Finite-horizon approximation of fundamental value for validation.
 */
export function fundamentalFinite(phi, delta, agent = 1, horizon = 500) {
  validateParams(phi, delta);
  const Q = agent === 1 ? transitionMatrix1(phi) : transitionMatrix2(phi);
  const d = [0, 1];
  let F = [0, 0];
  let power = [[1, 0], [0, 1]];
  for (let i = 1; i <= horizon; i++) {
    power = matMul(power, Q);
    const ed = matVec(power, d);
    const disc = Math.pow(delta, i);
    F[0] += disc * ed[0];
    F[1] += disc * ed[1];
  }
  return F;
}

/**
 * Equilibrium price in the symmetric model: p = δ φ / (1 - δ)
 * Identical across states.
 */
export function equilibriumPrice(phi, delta) {
  validateParams(phi, delta);
  return delta * phi / (1 - delta);
}

/**
 * Speculative premium metrics.
 */
export function speculativePremium(p, F) {
  if (F <= 0) {
    return { absolute: NaN, relativePct: NaN, ratio: NaN };
  }
  const absolute = p - F;
  const relativePct = 100 * (p / F - 1);
  const ratio = F / p;
  return { absolute, relativePct, ratio };
}

/**
 * Expected gross return from agent a's perspective in state d.
 * R_a(d) = E^a[d_{t+1} + p(d_{t+1}) | d_t = d] / p
 */
export function expectedReturn(phi, delta, agent, state) {
  validateParams(phi, delta);
  const p = equilibriumPrice(phi, delta);
  const Q = agent === 1 ? transitionMatrix1(phi) : transitionMatrix2(phi);
  const row = Q[state];
  // Next dividend expected + next price (same p in both states)
  const E_d_plus_p = row[0] * (0 + p) + row[1] * (1 + p);
  const gross = E_d_plus_p / p;
  return { gross, net: gross - 1 };
}

/**
 * Closed-form expected returns for agent 1 (symmetric model).
 * R1(0) = (1/δ) [1 - (2φ-1)(1-δ)/φ]
 * R1(1) = 1/δ
 */
export function expectedReturnClosedForm(phi, delta, agent, state) {
  validateParams(phi, delta);
  const rf = 1 / delta;
  if (agent === 1) {
    if (state === 1) return { gross: rf, net: rf - 1 };
    // state 0
    const factor = 1 - (2 * phi - 1) * (1 - delta) / phi;
    return { gross: rf * factor, net: rf * factor - 1 };
  } else {
    // agent 2 symmetric: swap states
    if (state === 0) return { gross: rf, net: rf - 1 };
    const factor = 1 - (2 * phi - 1) * (1 - delta) / phi;
    return { gross: rf * factor, net: rf * factor - 1 };
  }
}

/**
 * Implied risk-free rate: r = 1/δ - 1
 */
export function riskFreeRate(delta) {
  return 1 / delta - 1;
}

/**
 * Full model snapshot for UI.
 */
export function computeModel(phi, delta, state) {
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

// Export for tests
export const __test__ = {
  matMul, matPow, matVec
};
