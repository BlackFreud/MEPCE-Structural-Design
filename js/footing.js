/**
 * @file footing.js
 * @description Isolated spread footing design module.
 *              References: NSCP 2015, ACI 318-14 §13, §22.5, §22.6, §7.6
 * @module footing
 * @requires utils.js, canvas.js
 */
"use strict";

// =============================================================================
// PUBLIC API
// =============================================================================

function calculateFooting() {
  clearAllErrors("footing");

  const fields = [
    { id:"f_fc",  label:"fc'",              min:17    },
    { id:"f_fy",  label:"fy",               min:230   },
    { id:"f_Pu",  label:"Pu",               min:0     },
    { id:"f_Mu",  label:"Mu",               min:0     },
    { id:"f_qa",  label:"Allowable bearing",min:50    },
    { id:"f_B",   label:"Footing width B",  min:500   },
    { id:"f_L",   label:"Footing length L", min:500   },
    { id:"f_h",   label:"Footing depth h",  min:300   },
    { id:"f_cc",  label:"Cover",            min:75    },
    { id:"f_db",  label:"Bar Ø",            min:12    },
    { id:"f_cw",  label:"Column width cw",  min:200   },
    { id:"f_cl",  label:"Column length cl", min:200   },
  ];
  if (!validateFields(fields)) return;

  const fc   = getVal("f_fc");
  const fy   = getVal("f_fy");
  const Pu   = getVal("f_Pu");          // kN  — factored axial
  const Mu   = getVal("f_Mu");          // kNm — factored moment (one axis)
  const qa   = getVal("f_qa");          // kPa — allowable soil bearing
  const B    = getVal("f_B");           // mm  — footing width  (short direction)
  const L    = getVal("f_L");           // mm  — footing length (long direction, parallel to Mu)
  const h    = getVal("f_h");           // mm  — footing overall depth
  const cc   = getVal("f_cc");          // mm  — clear cover (soil face: 75mm min)
  const db   = getVal("f_db");          // mm  — main bar diameter
  const cw   = getVal("f_cw");          // mm  — column width  (perpendicular to Mu)
  const cl   = getVal("f_cl");          // mm  — column length (parallel to Mu)

  // Effective depth — bottom bars, two layers perpendicular; use average d
  const d_long  = h - cc - db / 2;           // long-direction bars (bottom layer)
  const d_short = h - cc - db - db / 2;      // short-direction bars (second layer up)
  const d_avg   = (d_long + d_short) / 2;    // average for punching

  // Footing area and section modulus
  const Af    = (B * L) / 1e6;         // m²
  const Sb    = (B / 1000) * Math.pow(L / 1000, 2) / 6;  // m³ (bending about short axis)

  // ==========================================================================
  // SOIL BEARING PRESSURE CHECK
  // Service loads: Ps = Pu/1.4 (conservative), Ms = Mu/1.4
  // ==========================================================================
  const Ps    = Pu  / 1.4;             // kN  — service axial
  const Ms    = Mu  / 1.4;             // kNm — service moment
  const Wf    = GAMMA_CONCRETE * h / 1000 * Af;  // kN — footing self-weight

  const q_avg = (Ps + Wf) / Af;
  const q_max = (Ps + Wf) / Af + Ms / Sb;
  const q_min = (Ps + Wf) / Af - Ms / Sb;
  const bear_pass = q_max <= qa;

  // ==========================================================================
  // FACTORED UPWARD NET SOIL PRESSURE (for structural design)
  // qu = Pu / Af  (self-weight cancels with soil overburden in ACI practice)
  // ==========================================================================
  const qu_avg = Pu / Af;              // kPa — average factored net pressure
  const qu_max = Pu / Af + (Mu * 1000) / (Sb * 1e6);  // kPa — max edge
  const qu_min = Pu / Af - (Mu * 1000) / (Sb * 1e6);  // kPa — min edge

  // ==========================================================================
  // PUNCHING (TWO-WAY) SHEAR  — ACI 318-14 §22.6
  // Critical perimeter at d/2 from column face
  // ==========================================================================
  const bp_long  = cl + d_avg;         // mm — critical perimeter dimension (long)
  const bp_short = cw + d_avg;         // mm — critical perimeter dimension (short)
  const bo       = 2 * (bp_long + bp_short);  // mm — critical perimeter

  // Area inside critical perimeter
  const A_punch  = (bp_long * bp_short) / 1e6;  // m²

  // Factored punching shear — use qu_max for conservative
  const Vu_p     = qu_max * (Af - A_punch);     // kN

  // βc — column aspect ratio
  const beta_c   = Math.max(cl, cw) / Math.min(cl, cw);
  const alphaS   = 40;                 // Interior column assumption
  const sqrtFc   = Math.sqrt(fc);

  const Vc_a_p   = 0.083 * (2 + 4 / beta_c)           * sqrtFc * bo * d_avg / 1000;
  const Vc_b_p   = 0.083 * (2 + (alphaS * d_avg) / bo) * sqrtFc * bo * d_avg / 1000;
  const Vc_c_p   = 0.33                               * sqrtFc * bo * d_avg / 1000;
  const Vc_p     = Math.min(Vc_a_p, Vc_b_p, Vc_c_p);
  const PhiVc_p  = PHI_SHEAR * Vc_p;
  const punch_govn = Vc_p === Vc_a_p ? "(a) 2+4/βc"
                   : Vc_p === Vc_b_p ? "(b) αs·d/bo"
                   :                   "(c) 0.33√fc'";

  // ==========================================================================
  // ONE-WAY (BEAM) SHEAR  — ACI 318-14 §22.5
  // Critical section at d from column face
  // Long direction — critical section at d_long from col face (parallel to cw)
  // Short direction — critical section at d_short from col face (parallel to cl)
  // ==========================================================================
  // Long direction (B wide, L span): cantilever = (L/2 − cl/2 − d_long)
  const cant_long  = L / 2 - cl / 2 - d_long;    // mm — cantilever beyond critical section
  const Vu_1l      = cant_long > 0
    ? qu_max * (cant_long / 1000) * (B / 1000)    // kN
    : 0;
  const Vc_1l      = (0.17 * sqrtFc * B * d_long) / 1000;  // kN
  const PhiVc_1l   = PHI_SHEAR * Vc_1l;

  // Short direction (L wide, B span): cantilever = (B/2 − cw/2 − d_short)
  const cant_short = B / 2 - cw / 2 - d_short;   // mm — cantilever beyond critical section
  const Vu_1s      = cant_short > 0
    ? qu_max * (cant_short / 1000) * (L / 1000)   // kN
    : 0;
  const Vc_1s      = (0.17 * sqrtFc * L * d_short) / 1000;  // kN
  const PhiVc_1s   = PHI_SHEAR * Vc_1s;

  // ==========================================================================
  // FLEXURAL DESIGN  — ACI 318-14 §13.3 / §22.3
  // Critical section at face of column for each direction
  // Long direction (bending about short axis, width = B):
  //   Mu_fl = qu_max × (L/2 − cl/2)² / 2 × B  (kNm)
  // Short direction (bending about long axis, width = L):
  //   Mu_fs = qu_max × (B/2 − cw/2)² / 2 × L  (kNm)
  // ==========================================================================
  const arm_long   = (L / 2 - cl / 2) / 1000;   // m
  const arm_short  = (B / 2 - cw / 2) / 1000;   // m
  const B_m = B / 1000, L_m = L / 1000;

  const Mu_fl = qu_max * arm_long  * arm_long  / 2 * B_m;   // kNm — long dir
  const Mu_fs = qu_max * arm_short * arm_short / 2 * L_m;   // kNm — short dir

  // Solve required As per metre width then get total As
  // Long direction (d = d_long, width = B)
  const As_fl_pm = _footingSolveAs(Mu_fl / B_m, d_long, fc, fy);   // mm²/m
  const As_fl    = As_fl_pm * B_m;                                   // mm² total

  // Short direction (d = d_short, width = L)
  const As_fs_pm = _footingSolveAs(Mu_fs / L_m, d_short, fc, fy);  // mm²/m
  const As_fs    = As_fs_pm * L_m;                                   // mm² total

  // ACI 318-14 §13.3.4.2 — min steel = 0.0018 × B × h (temperature + shrinkage)
  const As_min_l  = 0.0018 * B * h;      // mm² — long direction
  const As_min_s  = 0.0018 * L * h;      // mm² — short direction
  const As_fl_gov = Math.max(As_fl, As_min_l);
  const As_fs_gov = Math.max(As_fs, As_min_s);

  // Number of bars and spacing
  const Ab        = barArea(db);
  const n_long    = Math.ceil(As_fl_gov / Ab);
  const n_short   = Math.ceil(As_fs_gov / Ab);
  const s_long    = Math.floor((B - 2 * cc) / (n_long  - 1 || 1));
  const s_short   = Math.floor((L - 2 * cc) / (n_short - 1 || 1));

  // ==========================================================================
  // MAX SPACING CHECK — ACI 318-14 §13.3.4.2 / §7.7.2.3
  // s_max = min(3h, 450mm) for footings
  // ==========================================================================
  const s_max  = Math.min(3 * h, 450);
  const sl_ok  = s_long  <= s_max;
  const ss_ok  = s_short <= s_max;

  // ==========================================================================
  // REBAR SCHEDULE
  // ==========================================================================
  const rebarBars = [
    { mark:"FL", count:n_long,  dia:db, length:`${(L/1000).toFixed(2)}m`, location:`Long dir. (B-dir.) @ ${s_long}mm o.c.` },
    { mark:"FS", count:n_short, dia:db, length:`${(B/1000).toFixed(2)}m`, location:`Short dir. (L-dir.) @ ${s_short}mm o.c.` },
  ];

  // ==========================================================================
  // BUILD MODERN HTML
  // ==========================================================================
  let html = `
    <div class="modern-result-header">
      <div class="modern-result-header-content">
        <div class="modern-result-title">
          <div class="modern-result-main-title">Footing Analysis</div>
          <div class="modern-result-subtitle">Isolated Spread Footing</div>
        </div>
      </div>
      <button class="btn-print-modern" onclick="window.print()" title="Print / Save as PDF">
        <span class="print-icon">⎙</span>
        <span class="print-text">Print</span>
      </button>
    </div>
    <div class="modern-result-body">`;

  // Section Preview
  html += `
    <div class="modern-chart-card">
      <div class="modern-chart-header">
        <span class="chart-header-title">Section Preview — Plan & Elevation</span>
      </div>
      <div class="modern-chart-content">
        <canvas id="footingCanvas" width="460" height="200"></canvas>
      </div>
    </div>`;

  // Geometry
  html += `<div class="modern-section">
    <div class="modern-section-divider">
      <span class="section-divider-title">Geometry</span>
    </div>
    <div class="modern-results-grid">`;
  html += createRow("Footing Plan (B × L)",     `${B} × ${L} mm`,              "");
  html += createRow("Footing Depth (h)",         `${h} mm`,                     "");
  html += createRow("Effective Depth d (long)",  d_long.toFixed(0)  + " mm",    "");
  html += createRow("Effective Depth d (short)", d_short.toFixed(0) + " mm",    "");
  html += createRow("Footing Area (A<sub>f</sub>)", Af.toFixed(3) + " m²",      "");
  html += `</div></div>`;

  // Soil Bearing
  html += `<div class="modern-section">
    <div class="modern-section-divider">
      <span class="section-divider-title">Soil Bearing Pressure</span>
      <span class="section-divider-code">NSCP 2015 §105</span>
    </div>
    <div class="modern-results-grid">`;
  html += createRow("q<sub>avg</sub> (service)",  q_avg.toFixed(1) + " kPa",    "");
  html += createRow("q<sub>max</sub> (service)",  q_max.toFixed(1) + " kPa",    bear_pass ? "PASS" : "FAIL");
  html += createRow("q<sub>min</sub> (service)",  q_min.toFixed(1) + " kPa",    q_min >= 0 ? "" : "WARN");
  html += createRow("Allowable q<sub>a</sub>",    qa.toFixed(1)    + " kPa",    "");
  html += createProgressBar("q<sub>max</sub> vs q<sub>a</sub>", q_max, qa,      "kPa");
  if (q_min < 0) html += createRow("Note", "Tension at footing edge — check uplift or enlarge footing", "WARN");
  html += `</div></div>`;

  // Punching Shear
  html += `<div class="modern-section">
    <div class="modern-section-divider">
      <span class="section-divider-title">Punching (Two-Way) Shear</span>
      <span class="section-divider-code">ACI 318-14 §22.6</span>
    </div>
    <div class="modern-results-grid">`;
  html += createRow("Critical Perimeter (b<sub>o</sub>)", bo.toFixed(0) + " mm",       "");
  html += createRow("β<sub>c</sub> (column aspect)",      beta_c.toFixed(3),            "");
  html += createRow("Eq. (a) V<sub>c</sub>",              Vc_a_p.toFixed(1) + " kN",   "");
  html += createRow("Eq. (b) V<sub>c</sub>",              Vc_b_p.toFixed(1) + " kN",   "");
  html += createRow("Eq. (c) V<sub>c</sub>",              Vc_c_p.toFixed(1) + " kN",   "");
  html += createRow("Governing Equation",                  punch_govn,                   "");
  html += createProgressBar("V<sub>u,punch</sub> vs φV<sub>c</sub>", Vu_p, PhiVc_p,    "kN");
  html += createRow("φV<sub>c</sub> Capacity",             PhiVc_p.toFixed(1) + " kN", PhiVc_p >= Vu_p ? "SAFE" : "FAIL");
  html += `</div></div>`;

  // One-Way Shear
  html += `<div class="modern-section">
    <div class="modern-section-divider">
      <span class="section-divider-title">One-Way (Beam) Shear</span>
      <span class="section-divider-code">ACI 318-14 §22.5</span>
    </div>
    <div class="modern-results-grid">`;
  html += createRow("Long Dir. V<sub>u</sub>",       Vu_1l.toFixed(1)   + " kN", "");
  html += createProgressBar("V<sub>u</sub> vs φV<sub>c</sub> (long)",  Vu_1l, PhiVc_1l, "kN");
  html += createRow("Long Dir. φV<sub>c</sub>",      PhiVc_1l.toFixed(1) + " kN", PhiVc_1l >= Vu_1l ? "SAFE" : "FAIL");
  html += createRow("Short Dir. V<sub>u</sub>",      Vu_1s.toFixed(1)   + " kN", "");
  html += createProgressBar("V<sub>u</sub> vs φV<sub>c</sub> (short)", Vu_1s, PhiVc_1s, "kN");
  html += createRow("Short Dir. φV<sub>c</sub>",     PhiVc_1s.toFixed(1) + " kN", PhiVc_1s >= Vu_1s ? "SAFE" : "FAIL");
  html += `</div></div>`;

  // Flexural Design
  html += `<div class="modern-section">
    <div class="modern-section-divider">
      <span class="section-divider-title">Flexural Reinforcement</span>
      <span class="section-divider-code">ACI 318-14 §13.3 / §22.3</span>
    </div>
    <div class="modern-results-grid">`;
  html += createRow("Long Dir. M<sub>u</sub>",        Mu_fl.toFixed(2)        + " kNm",  "");
  html += createRow("Long Dir. A<sub>s,req</sub>",    As_fl.toFixed(0)        + " mm²",  "");
  html += createRow("Long Dir. A<sub>s,min</sub>",    As_min_l.toFixed(0)     + " mm²",  "");
  html += createRow("Long Dir. A<sub>s,gov</sub>",    As_fl_gov.toFixed(0)    + " mm²",  "");
  html += createRow("Long Dir. Bar Spacing",          `${n_long}–${db}mm Ø @ ${s_long}mm`, sl_ok ? "PASS" : "FAIL");
  html += createRow("Short Dir. M<sub>u</sub>",       Mu_fs.toFixed(2)        + " kNm",  "");
  html += createRow("Short Dir. A<sub>s,req</sub>",   As_fs.toFixed(0)        + " mm²",  "");
  html += createRow("Short Dir. A<sub>s,min</sub>",   As_min_s.toFixed(0)     + " mm²",  "");
  html += createRow("Short Dir. A<sub>s,gov</sub>",   As_fs_gov.toFixed(0)    + " mm²",  "");
  html += createRow("Short Dir. Bar Spacing",         `${n_short}–${db}mm Ø @ ${s_short}mm`, ss_ok ? "PASS" : "FAIL");
  html += createRow("Max Spacing (3h, 450mm)",        s_max + " mm",                     "");
  html += `</div></div>`;

  // Rebar Schedule
  html += `<div class="modern-section">
    <div class="modern-section-divider">
      <span class="section-divider-title">Rebar Schedule</span>
    </div>`;
  html += createRebarSchedule(rebarBars);
  html += `</div>`;

  html += `</div>`;

  renderResults("footing-results", html, () => {
    drawFootingSection("footingCanvas", B, L, h, cc, cw, cl, db, d_long);
  });
}

// =============================================================================
// PRIVATE — Solve required As per metre width (singly reinforced strip)
// Same Branson inversion pattern used in slab._solveSpacing
// ACI 318-14 §22.3 Whitney stress block
// =============================================================================
function _footingSolveAs(Mu_pm, d, fc, fy) {
  // Mu_pm = moment per unit width (kNm/m)
  const phi  = PHI_FLEX;
  const Rn   = (Mu_pm * 1e6) / (phi * 1000 * d * d);  // MPa
  const term = 1 - (2 * Rn) / (0.85 * fc);
  if (term <= 0) return (0.85 * fc / fy) * 1000 * d;   // over-reinforced fallback
  const rho  = (0.85 * fc / fy) * (1 - Math.sqrt(term));
  return Math.max(rho * 1000 * d, 0.0018 * 1000 * d);  // mm²/m, floor at shrinkage min
}