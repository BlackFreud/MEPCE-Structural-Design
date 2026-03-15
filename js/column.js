/**
 * @file column.js
 * @description Column design module — rectangular and circular columns.
 *              References: NSCP 2015, ACI 318-14 §6.2.5, §6.6.4, §22.4, §18.7.5
 * @module column
 * @requires utils.js, canvas.js
 */
"use strict";

// =============================================================================
// PUBLIC API
// =============================================================================

function calculateColumn() {
  clearAllErrors("column");

  const fields = [
    { id:"c_fc",  label:"fc'",   min:17  },
    { id:"c_fy",  label:"fy",    min:230 },
    { id:"c_nb",  label:"Bars",  min:4   },
    { id:"c_db",  label:"Bar Ø", min:12  },
    { id:"c_Pu",  label:"Pu",    min:0   },
    { id:"c_M2",  label:"Mu",    min:0   },
    { id:"c_Lu",  label:"Lu",    min:0.5 },
  ];
  if (!validateFields(fields)) return;

  const fc    = getVal("c_fc");
  const fy    = getVal("c_fy");
  const nb    = getVal("c_nb");
  const db    = getVal("c_db");
  const dt    = getVal("c_dt");
  const hx    = getVal("c_hx") || 200;     // Max hoop leg spacing — ACI §18.7.5.3(c)
  const Pu    = getVal("c_Pu");
  const Mu    = getVal("c_M2");
  const Lu    = getVal("c_Lu") * 1000;   // m → mm
  const sway  = parseInt(getStr("c_sway"));
  // Effective length factor k — ACI 318-14 §6.6.4.3
  // Non-sway: k ≤ 1.0  |  Sway: k ≥ 1.0 (1.2 minimum per commentary)
  const k_raw  = getVal("c_k")    || (sway ? 1.2 : 1.0);
  const k_eff  = sway ? Math.max(k_raw, 1.0) : Math.min(k_raw, 1.0);
  // Seismic zone — controls §18 vs §25 detailing
  const seismic = getStr("c_seismic") || "zone4";
  const isZone4 = seismic === "zone4";
  // Sustained load ratio — ACI 318-14 §6.6.4.4.4
  const bdns   = Math.min(Math.max(getVal("c_bdns") || 0.6, 0), 0.99);
  const shape    = getStr("c_shape");
  const tie      = getStr("c_tie");
  const cc       = getVal("c_cc");            // Actual cover input
  const exposure = getStr("c_exposure") || "weather";

  // Geometry
  const b = getVal("c_b"), h = getVal("c_h"), D = getVal("c_D");
  const dim  = shape === "rect" ? h : D;
  const Ag   = shape === "rect" ? b * h : Math.PI * Math.pow(D / 2, 2);
  const As_t = nb * barArea(db);

  // --- Cover adequacy (NSCP 2015 Table 406.3.2.1 / ACI 318-14 Table 20.6.1.3.1) ---
  const cc_min = getMinCover(exposure, db);
  const cc_ok  = cc >= cc_min;

  // ==========================================================================
  // SLENDERNESS (ACI 318-14 §6.2.5.1)
  // r = 0.3h (rect) or 0.25D (circ)
  // Limit: 34 non-sway (conservative, M1/M2 ratio not yet input)
  //        22 sway
  // ==========================================================================
  const r         = shape === "rect" ? 0.3 * dim : 0.25 * D;
  const klr       = (k_eff * Lu) / r;
  const slenLimit = sway ? 22 : 34;
  const isSlender = klr > slenLimit;

  // ==========================================================================
  // MIN ECCENTRICITY (ACI 318-14 §6.6.4.5.1)
  // ==========================================================================
  const ecc_min = 15 + 0.03 * dim;
  let Mc = Math.max(Math.abs(Mu), (Pu * ecc_min) / 1000);

  // ==========================================================================
  // MOMENT MAGNIFICATION — non-sway (ACI 318-14 §6.6.4.4)
  // EI = (0.4·Ec·Ig) / (1 + βdns)   — includes creep reduction
  // δns = 1/(1 − Pu/(0.75·Pc)) ≥ 1.0
  // ==========================================================================
  let delta = 1.0;
  if (isSlender && !sway) {
    const Ec  = 4700 * Math.sqrt(fc);
    const Ig  = shape === "rect"
      ? (b * Math.pow(h, 3)) / 12
      : (Math.PI * Math.pow(D, 4)) / 64;
    const EI  = (0.4 * Ec * Ig) / (1 + bdns);   // ACI §6.6.4.4.4 — creep factor applied
    const Pc  = (Math.PI * Math.PI * EI) / (Lu * Lu) / 1000;
    const den = 1 - Pu / (0.75 * Pc);
    delta = den > 0 ? Math.max(1.0 / den, 1.0) : 2.5;
    Mc   *= delta;
  }

  // ==========================================================================
  // P-M INTERACTION (C2: clean linear c-sweep, C3: uses cc input)
  // ==========================================================================
  const pmPoints = _buildPMCurve(shape, b, h, D, fc, fy, nb, db, dt, cc, Ag, As_t);
  const inside   = _isDemandInside(pmPoints, Mc, Pu);

  // ==========================================================================
  // MAX AXIAL (ACI 318-14 §22.4.2.1)
  // φPn_max = φ·k·[0.85fc'(Ag−Ast) + Ast·fy]
  // k = 0.80 tied, 0.85 spiral
  // ==========================================================================
  const k_type   = tie === "spiral" ? 0.85 : 0.80;
  const phi_col  = tie === "spiral" ? 0.75 : PHI_COMP;
  const PhiPnMax = phi_col * k_type * (0.85 * fc * (Ag - As_t) + As_t * fy) / 1000;

  // ==========================================================================
  // CONFINEMENT — ZONE 4 (ACI 318-14 §18.7.5.3)
  // so ≤ min(b_min/4, 6db, 150mm)
  // ==========================================================================
  const b_min = shape === "rect" ? Math.min(b, h) : D;

  // 3. Standard tie spacing (s) — ACI 318-14 §25.7.2.1 (always computed)
  const s_std = Math.floor(Math.min(16 * db, 48 * dt, b_min));

  // 1 & 2. Special confinement — ACI 318-14 §18.7.5 (Zone 4 only)
  let so, so_c, lo;
  if (isZone4) {
    // (a) b_min/4  (b) 6×db  (c) 100 + (350−hx)/3  clamped [100,150]
    so_c = Math.min(Math.max(100 + (350 - hx) / 3, 100), 150);
    so   = Math.floor(Math.min(b_min / 4, 6 * db, so_c));
    lo   = Math.ceil(Math.max(b_min, Lu / 6, 450));
  }

  // Reinforcement ratio check
  const rho_g = As_t / Ag;

  // Rebar schedule (F4)
  const rebarBars = [
    { mark:"L1", count:nb,  dia:db, length:"Full height", location:"Longitudinal" },
  ];
  if (isZone4) {
    rebarBars.push({ mark:"T1", count:"—", dia:dt, length:"Per spacing", location:`Hoops @ ${so}mm (within ${lo}mm from ends)` });
    rebarBars.push({ mark:"T2", count:"—", dia:dt, length:"Per spacing", location:`Ties @ ${s_std}mm (mid-height)` });
  } else {
    rebarBars.push({ mark:"T1", count:"—", dia:dt, length:"Per spacing", location:`Ties @ ${s_std}mm o.c. (standard)` });
  }
  // ==========================================================================
  // BUILD MODERN HTML
  // ==========================================================================
  let html = `
    <div class="modern-result-header">
      <div class="modern-result-header-content">
        <div class="modern-result-title">
          <div class="modern-result-main-title">Column Analysis</div>
          <div class="modern-result-subtitle">${shape === "rect" ? "Rectangular" : "Circular"} ${tie === "spiral" ? "Spiral" : "Tied"}</div>
        </div>
      </div>
      <button class="btn-print-modern" onclick="window.print()" title="Print / Save as PDF">
        <span class="print-icon">⎙</span>
        <span class="print-text">Print</span>
      </button>
    </div>
    <div class="modern-result-body">`;

  // Charts Section (Two charts side-by-side)
  html += `
    <div class="modern-charts-row">
      <div class="modern-chart-card">
        <div class="modern-chart-header">
          <span class="chart-header-title">P-M Interaction Diagram</span>
        </div>
        <div class="modern-chart-content">
          <canvas id="pmChart" width="300" height="250"></canvas>
        </div>
        <div class="modern-chart-legend">
          <div class="legend-item">
            <span class="legend-dot" style="background:#27ae60"></span>
            <span class="legend-text">Capacity</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot" style="background:#c0392b"></span>
            <span class="legend-text">Demand (Mc, Pu)</span>
          </div>
        </div>
      </div>
      
      <div class="modern-chart-card">
        <div class="modern-chart-header">
          <span class="chart-header-title">Section Preview</span>
        </div>
        <div class="modern-chart-content">
          <canvas id="colCanvas" width="160" height="160"></canvas>
        </div>
      </div>
    </div>`;

  // Section Properties
  html += `<div class="modern-section">
    <div class="modern-section-divider">
      <span class="section-divider-title">Section Properties</span>
    </div>
    <div class="modern-results-grid">`;
  html += createRow("Gross Area (A<sub>g</sub>)",      Ag.toFixed(0)   + " mm²", "");
  html += createRow("Total Steel (A<sub>st</sub>)",    As_t.toFixed(0) + " mm²", "");
  html += createRow("Steel Ratio (ρ<sub>g</sub>)",     (rho_g * 100).toFixed(2) + " %",
    rho_g >= 0.01 && rho_g <= 0.08 ? "PASS" : "FAIL");
  html += createRow("Clear Cover Provided",            cc.toFixed(0)     + " mm", "");
  html += createRow("Min Cover Required (exposure)",   cc_min.toFixed(0) + " mm", cc_ok ? "PASS" : "FAIL");
  html += `</div></div>`;

  // Slenderness
  html += `<div class="modern-section">
    <div class="modern-section-divider">
      <span class="section-divider-title">Slenderness — Limit kl/r = ${slenLimit}</span>
      <span class="section-divider-code">ACI 318-14 §6.2.5</span>
    </div>
    <div class="modern-results-grid">`;
  html += createRow("Eff. Length Factor (k)",  k_eff.toFixed(2),         sway ? "SWAY" : "NON-SWAY");
  html += createRow("kl/r",                    klr.toFixed(2),           isSlender ? "SLENDER" : "SHORT");
  if (isSlender && !sway) {
    html += createRow("β<sub>dns</sub> (creep)", bdns.toFixed(2),         "");
    html += createRow("Magnification (δ<sub>ns</sub>)", delta.toFixed(3), "");
  }
  html += createRow("Design Moment (M<sub>c</sub>)",  Mc.toFixed(2) + " kNm",  "");
  html += `</div></div>`;

  // Axial-Flexural Strength
  html += `<div class="modern-section">
    <div class="modern-section-divider">
      <span class="section-divider-title">Axial-Flexural Strength</span>
      <span class="section-divider-code">ACI 318-14 §22.4</span>
    </div>
    <div class="modern-results-grid">`;
  html += createRow("P-M Demand",          inside ? "Inside envelope" : "Outside envelope",
    inside ? "SAFE" : "FAIL");
  html += createProgressBar("P<sub>u</sub> vs φP<sub>n,max</sub>", Pu, PhiPnMax, "kN");
  html += createRow("φP<sub>n,max</sub>",             PhiPnMax.toFixed(1) + " kN",
    PhiPnMax >= Pu ? "PASS" : "FAIL");
  html += `</div></div>`;

  // Confinement
  // Seismic / Tie Detailing
  html += `<div class="modern-section">
    <div class="modern-section-divider">
      <span class="section-divider-title">${isZone4 ? "Seismic Detailing — Zone 4" : "Tie Detailing — Standard"}</span>
      <span class="section-divider-code">${isZone4 ? "ACI 318-14 §18.7.5" : "ACI 318-14 §25.7.2"}</span>
    </div>
    <div class="modern-results-grid">`;
  html += createRow("Tie Type", tie === "spiral" ? "Spiral" : "Rectangular Tie", "");
  if (isZone4) {
    html += createRow("Confinement Zone (l<sub>o</sub>)",        `${lo} mm from each joint`,                       "");
    html += createRow("s<sub>o</sub> — Cond. (a) b<sub>min</sub>/4", `${Math.floor(b_min / 4)} mm`,               "");
    html += createRow("s<sub>o</sub> — Cond. (b) 6d<sub>b</sub>",    `${Math.floor(6 * db)} mm`,                  "");
    html += createRow("s<sub>o</sub> — Cond. (c) hx-based",     `${Math.floor(so_c)} mm  (h<sub>x</sub>=${hx}mm)`, "");
    html += createRow("Hoops @ Ends — Governing s<sub>o</sub>",  `${dt}mm Ø @ ${so}mm o.c.`,                      "");
    html += createRow("Ties @ Mid-Height (s)",                   `${dt}mm Ø @ ${s_std}mm o.c.`,                   "");
  } else {
    html += createRow("Standard Tie Spacing (s)",                `${dt}mm Ø @ ${s_std}mm o.c.`,                   "");
    html += createRow("Governs",                                 `min(16d<sub>b</sub>, 48d<sub>t</sub>, b<sub>min</sub>)`, "");
  }
  html += `</div></div>`;

  // Rebar Schedule
  html += `<div class="modern-section">
    <div class="modern-section-divider">
      <span class="section-divider-title">Rebar Schedule</span>
    </div>`;
  html += createRebarSchedule(rebarBars);
  html += `</div>`;

  html += `</div>`;

  renderResults("col-results", html, () => {
    drawPMCurve("pmChart", pmPoints, Mc, Pu);
    drawColSection("colCanvas", shape, b, h, D, cc, nb, db);
  });
}

// =============================================================================
// PRIVATE — P-M Curve Generation
// C2: Clean linear c-sweep from c=0.001d to c=4h in uniform N_STEPS steps.
// C3: Uses actual cc from input.
// ACI 318-14 §22.4
// =============================================================================
function _buildPMCurve(shape, b, h, D, fc, fy, nb, db, dt, cc, Ag, As_t) {
  const dim    = shape === "rect" ? h : D;
  const beta1  = getBeta1(fc);
  // Derive d_eff and d' from actual cover and tie diameter inputs
  const d_eff  = dim - cc - dt - db / 2;
  const d_p    = cc  + dt + db / 2;
  const As_f   = As_t / 2;

  const Pn_max = 0.80 * (0.85 * fc * (Ag - As_t) + As_t * fy);
  const points = [];
  const N      = 80;

  for (let i = 0; i <= N; i++) {
    // C2: uniform sweep from 4·dim down to near-zero
    const c = dim * (4 - (4 - 0.001) * i / N);
    if (c <= 0) continue;

    const a    = Math.min(beta1 * c, dim);
    const es_s = MAX_CONCRETE_STRAIN * (d_eff - c) / c;
    const es_p = MAX_CONCRETE_STRAIN * (c - d_p) / c;
    const fs_s = steelStress(es_s, fy);
    const fs_p = steelStress(es_p, fy);

    let Cc, Mn_arm;
    if (shape === "rect") {
      Cc     = 0.85 * fc * a * b;
      Mn_arm = dim / 2 - a / 2;
    } else {
      // Circular Whitney block: use chord-sector integration
      const ratio = Math.max(0, Math.min(a / D, 1));
      const theta = 2 * Math.acos(1 - 2 * ratio);
      const Ac    = (D * D / 8) * (theta - Math.sin(theta));
      const yc    = (D / 3) * Math.pow(Math.sin(theta / 2), 3) / (theta / 2 - Math.sin(theta) / 2 + 1e-12);
      Cc          = 0.85 * fc * Ac;
      Mn_arm      = dim / 2 - (D / 2 - yc);
    }

    const Cs  = As_f * (fs_p - 0.85 * fc);
    const Ts  = As_f * fs_s;
    let Pn    = Cc + Cs - Ts;
    if (Pn > Pn_max) Pn = Pn_max;

    const Mn = Math.abs(
      Cc * Mn_arm + Cs * (dim / 2 - d_p) - Ts * (d_eff - dim / 2)
    ) / 1e6;

    const et  = MAX_CONCRETE_STRAIN * (d_eff - c) / c;
    const phi = Pn > 0 ? Math.max(getPhiFlex(et), PHI_COMP) : getPhiFlex(et);

    points.push({ x: Math.abs(Mn * phi), y: (Pn * phi) / 1000 });
  }

  return points.sort((a, b) => a.y - b.y);
}

// =============================================================================
// PRIVATE — Is demand point inside P-M envelope?
// Linear interpolation between bracketing curve segments.
// =============================================================================
function _isDemandInside(pts, Mu, Pu) {
  if (!pts.length) return false;
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i], p2 = pts[i + 1];
    if ((p1.y <= Pu && Pu <= p2.y) || (p2.y <= Pu && Pu <= p1.y)) {
      const frac   = (Pu - p1.y) / (p2.y - p1.y + 1e-9);
      const Mn_cap = p1.x + frac * (p2.x - p1.x);
      return Math.abs(Mu) <= Mn_cap;
    }
  }
  return false;
}