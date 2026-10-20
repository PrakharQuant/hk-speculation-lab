# HK Speculation Lab

Interactive quantitative finance research application implementing the **Harrison–Kreps (1978)** model of speculative asset pricing.

**Heterogeneous Beliefs. Resale Options. Speculative Asset Pricing.**

[![GitHub Pages](https://img.shields.io/badge/demo-GitHub%20Pages-blue)](https://prakharquant.github.io/hk-speculation-lab/)

## Motivation

How can an asset trade above the fundamental value perceived by *both* rational investors?

The Harrison–Kreps model shows that when investors have heterogeneous beliefs about state transition probabilities, short-selling is restricted, and investors can resell the asset, the equilibrium price can exceed every investor’s own valuation of the dividend stream. The difference is the value of the resale option.

This laboratory makes the mechanism fully transparent, interactive, and mathematically rigorous.

## Model Assumptions

- Two states: dividend \( d = 0 \) or \( d = 1 \).
- Two risk-neutral investors with common discount factor \( \delta \in (0.5, 1) \).
- Heterogeneous beliefs parameterized by \( \varphi \in [0.5, 1) \):
  - Agent 1 expects persistence: \( Q_1 = \begin{pmatrix} \varphi & 1-\varphi \\ 1-\varphi & \varphi \end{pmatrix} \)
  - Agent 2 expects alternation: \( Q_2 = \begin{pmatrix} 1-\varphi & \varphi \\ \varphi & 1-\varphi \end{pmatrix} \)
- Short sales prohibited.
- Equilibrium price (symmetric case): \( p = \dfrac{\delta \varphi}{1-\delta} \) (identical in both states).

## Features

- Executive overview with live metrics and dynamic interpretation
- Interactive Model Explorer (sliders for \( \varphi \), \( \delta \), current state)
- Belief Dynamics with transition matrices and multi-horizon expected dividend forecasts
- Price & Fundamentals comparison charts and tables
- Sensitivity Lab: one-way plots and two-dimensional heatmaps
- State-dependent Expected Returns vs risk-free rate
- Educational Bubble Comparison (fundamental / HK / illustrative rational bubble)
- Full mathematical Research Notes with KaTeX equations and glossary
- Automated numerical test suite

## Local Setup

```bash
git clone https://github.com/PrakharQuant/hk-speculation-lab.git
cd hk-speculation-lab
python -m http.server 8000
```

Open http://localhost:8000

## GitHub Pages Deployment

1. Push this repository to GitHub.
2. Go to Settings → Pages.
3. Source: Deploy from a branch → `main` → `/ (root)`.
4. The site will be available at `https://<username>.github.io/hk-speculation-lab/`.

All resource paths are relative, so the site works correctly under a project subpath.

## Testing

```bash
node tests/test.js
```

All core analytical claims (row sums, coincidence at \( \varphi = 1/2 \), zero premium at equality, matrix vs closed form, Bellman consistency, price exceeding fundamentals, expected return formulas, parameter validation) are covered.

## Architecture

- `js/model.js` — pure mathematical functions (no DOM)
- `js/app.js` — UI orchestration, charts (Plotly), parameter binding
- `index.html` + `css/styles.css` — static frontend
- `tests/test.js` — automated validation

## Limitations

This is a theoretical, two-state, risk-neutral model. It does not estimate fundamental values of real securities, does not include learning, risk aversion, or heterogeneous wealth, and should not be used as investment advice.

**Disclaimer:** This project is an educational implementation of a theoretical asset-pricing model. Its outputs are model-dependent and should not be interpreted as estimates of the fundamental value of actual securities or as investment advice.

## Academic References

Harrison, J. M., & Kreps, D. M. (1978). Speculative Investor Behavior in a Stock Market with Heterogeneous Expectations. *The Quarterly Journal of Economics*, 92(2), 323–336. https://doi.org/10.2307/1884166

Miller, E. M. (1977). Risk, Uncertainty, and Divergence of Opinion. *The Journal of Finance*, 32(4), 1151–1168. https://doi.org/10.1111/j.1540-6261.1977.tb03317.x

## License

MIT

## Author

**Prakhar Gupta**  
Email: bestofprakhar@gmail.com  
LinkedIn: https://www.linkedin.com/in/prakhar-gupta-5b7250372/  
X: https://x.com/PrakharQuant
