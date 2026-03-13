/**
 * @file slab.js
 * @description Slab design module — one-way and two-way flat plate.
 *              References: NSCP 2015, ACI 318-14 §7.3, §8, §22.5, §22.6, §24.4
 * @module slab
 * @requires utils.js
 */
"use strict";

const SLAB_COVER = 20;   // Interior exposure — NSCP 2015 Table 420.6.1.3.1

// =============================================================================
// ACI 318-14 TABLE 8.10.3.1 — MOMENT COEFFICIENTS
// Organized by edge condition and aspect ratio β = Ly/Lx
// Format: { beta_range, short_neg, short_pos, long_neg, long_pos }
// =============================================================================

const ACI_MOMENT_COEFFICIENTS = {
  // CASE 1: Interior panels (all edges continuous)
  interior: [
    { beta: 1.0,  cn_s: 0.045, cp_s: 0.036, cn_l: 0.045, cp_l: 0.036 },
    { beta: 1.1,  cn_s: 0.050, cp_s: 0.040, cn_l: 0.039, cp_l: 0.031 },
    { beta: 1.2,  cn_s: 0.055, cp_s: 0.044, cn_l: 0.034, cp_l: 0.027 },
    { beta: 1.3,  cn_s: 0.059, cp_s: 0.048, cn_l: 0.030, cp_l: 0.024 },
    { beta: 1.4,  cn_s: 0.063, cp_s: 0.051, cn_l: 0.027, cp_l: 0.021 },
    { beta: 1.5,  cn_s: 0.067, cp_s: 0.054, cn_l: 0.024, cp_l: 0.019 },
    { beta: 1.75, cn_s: 0.074, cp_s: 0.061, cn_l: 0.019, cp_l: 0.015 },
    { beta: 2.0,  cn_s: 0.081, cp_s: 0.066, cn_l: 0.015, cp_l: 0.012 },
  ],
  
  // CASE 2: One edge discontinuous
  one_edge: [
    { beta: 1.0,  cn_s: 0.053, cp_s: 0.043, cn_l: 0.053, cp_l: 0.043 },
    { beta: 1.1,  cn_s: 0.057, cp_s: 0.046, cn_l: 0.045, cp_l: 0.036 },
    { beta: 1.2,  cn_s: 0.061, cp_s: 0.050, cn_l: 0.039, cp_l: 0.031 },
    { beta: 1.3,  cn_s: 0.065, cp_s: 0.053, cn_l: 0.034, cp_l: 0.027 },
    { beta: 1.4,  cn_s: 0.069, cp_s: 0.056, cn_l: 0.030, cp_l: 0.024 },
    { beta: 1.5,  cn_s: 0.072, cp_s: 0.059, cn_l: 0.027, cp_l: 0.021 },
    { beta: 1.75, cn_s: 0.078, cp_s: 0.064, cn_l: 0.021, cp_l: 0.017 },
    { beta: 2.0,  cn_s: 0.084, cp_s: 0.068, cn_l: 0.017, cp_l: 0.014 },
  ],
  
  // CASE 3: Two adjacent edges discontinuous
  two_edge: [
    { beta: 1.0,  cn_s: 0.061, cp_s: 0.049, cn_l: 0.061, cp_l: 0.049 },
    { beta: 1.1,  cn_s: 0.065, cp_s: 0.052, cn_l: 0.052, cp_l: 0.042 },
    { beta: 1.2,  cn_s: 0.069, cp_s: 0.055, cn_l: 0.045, cp_l: 0.036 },
    { beta: 1.3,  cn_s: 0.072, cp_s: 0.058, cn_l: 0.039, cp_l: 0.031 },
    { beta: 1.4,  cn_s: 0.075, cp_s: 0.061, cn_l: 0.034, cp_l: 0.027 },
    { beta: 1.5,  cn_s: 0.078, cp_s: 0.063, cn_l: 0.030, cp_l: 0.024 },
    { beta: 1.75, cn_s: 0.084, cp_s: 0.068, cn_l: 0.024, cp_l: 0.019 },
    { beta: 2.0,  cn_s: 0.089, cp_s: 0.072, cn_l: 0.019, cp_l: 0.015 },
  ],
  
  // CASE 4: Corner panel (two edges discontinuous at corner)
  corner: [
    { beta: 1.0,  cn_s: 0.055, cp_s: 0.044, cn_l: 0.055, cp_l: 0.044 },
    { beta: 1.1,  cn_s: 0.059, cp_s: 0.047, cn_l: 0.047, cp_l: 0.038 },
    { beta: 1.2,  cn_s: 0.063, cp_s: 0.051, cn_l: 0.041, cp_l: 0.033 },
    { beta: 1.3,  cn_s: 0.066, cp_s: 0.054, cn_l: 0.036, cp_l: 0.029 },
    { beta: 1.4,  cn_s: 0.069, cp_s: 0.056, cn_l: 0.032, cp_l: 0.026 },
    { beta: 1.5,  cn_s: 0.072, cp_s: 0.059, cn_l: 0.028, cp_l: 0.023 },
    { beta: 1.75, cn_s: 0.078, cp_s: 0.064, cn_l: 0.022, cp_l: 0.018 },
    { beta: 2.0,  cn_s: 0.083, cp_s: 0.068, cn_l: 0.018, cp_l: 0.014 },
  ],
};

// =============================================================================
// GLOBAL HELPER FUNCTIONS (called from HTML)
// =============================================================================

/**
 * Load ACI Table 8.10.3.1 coefficients based on current edge condition and aspect ratio.
 * Called when user clicks "Load from ACI Table" button.
 */
function loadACICoefficients() {
  const Lx = getVal("s_Lx");
  const Ly = getVal("s_Ly");
  
  if (isNaN(Lx) || isNaN(Ly) || Lx <= 0 || Ly <= 0) {
    alert("Please enter valid Lx and Ly values first.");
    return;
  }
  
  if (Lx > Ly) {
    alert("Warning: Lx should be the SHORT span (≤ Ly). Values will be swapped.");
    document.getElementById("s_Lx").value = Ly;
    document.getElementById("s_Ly").value = Lx;
  }
  
  _updateCoefficientsFromTable();
}

/**
 * Update coefficients when edge condition changes.
 * Called automatically by onchange event.
 */
function updateSlabCoefficients() {
  _updateCoefficientsFromTable();
}

/**
 * Internal: Lookup and populate coefficient fields from ACI table.
 */
function _updateCoefficientsFromTable() {
  const Lx = getVal("s_Lx");
  const Ly = getVal("s_Ly");
  const edge = getStr("s_edge_cond");
  
  if (isNaN(Lx) || isNaN(Ly) || Lx <= 0 || Ly <= 0) return;
  
  const beta = Ly / Lx;
  const table = ACI_MOMENT_COEFFICIENTS[edge] || ACI_MOMENT_COEFFICIENTS.interior;
  
  // Find closest beta value (linear interpolation between bracketing values)
  let coeffs;
  if (beta <= table[0].beta) {
    coeffs = table[0];
  } else if (beta >= table[table.length - 1].beta) {
    coeffs = table[table.length - 1];
  } else {
    // Interpolate
    for (let i = 0; i < table.length - 1; i++) {
      if (beta >= table[i].beta && beta <= table[i + 1].beta) {
        const t = (beta - table[i].beta) / (table[i + 1].beta - table[i].beta);
        coeffs = {
          cn_s: table[i].cn_s + t * (table[i + 1].cn_s - table[i].cn_s),
          cp_s: table[i].cp_s + t * (table[i + 1].cp_s - table[i].cp_s),
          cn_l: table[i].cn_l + t * (table[i + 1].cn_l - table[i].cn_l),
          cp_l: table[i].cp_l + t * (table[i + 1].cp_l - table[i].cp_l),
        };
        break;
      }
    }
  }
  
  if (coeffs) {
    document.getElementById("s_cn_s").value = coeffs.cn_s.toFixed(3);
    document.getElementById("s_cp_s").value = coeffs.cp_s.toFixed(3);
    document.getElementById("s_cn_l").value = coeffs.cn_l.toFixed(3);
    document.getElementById("s_cp_l").value = coeffs.cp_l.toFixed(3);
  }
}

// =============================================================================
// PUBLIC API
// =============================================================================

function calculateSlab() {
  clearAllErrors("slab");

  const fields = [
    { id:"s_fc", label:"fc'",       min:17  },
    { id:"s_fy", label:"fy",        min:230 },
    { id:"s_h",  label:"Thickness", min:75  },
    { id:"s_db", label:"Bar Ø",     min:8   },
    { id:"s_DL", label:"SDL",       min:0   },
    { id:"s_LL", label:"LL",        min:0   },
  ];
  if (!validateFields(fields)) return;

  const fc   = getVal("s_fc");
  const fy   = getVal("s_fy");
  const h    = getVal("s_h");
  const db   = getVal("s_db");
  const DL   = getVal("s_DL");
  const LL   = getVal("s_LL");
  const mode = getStr("s_mode");

  // d = h − cover − db/2
  const d  = h - SLAB_COVER - db / 2;
  // wu = 1.2(SDL + γc·h) + 1.6·LL — NSCP 2015 §205
  const wu = 1.2 * (DL + GAMMA_CONCRETE * h / 1000) + 1.6 * LL;

  let html = `
    <div class="modern-result-header">
      <div class="modern-result-header-content">
        <div class="modern-result-icon">🏗️</div>
        <div class="modern-result-title">
          <div class="modern-result-main-title">Slab Analysis</div>
          <div class="modern-result-subtitle">${mode === "1" ? "One-Way Slab" : "Two-Way Flat Plate"}</div>
        </div>
      </div>
      <button class="btn-print-modern" onclick="window.print()" title="Print / Save as PDF">
        <span class="print-icon">⎙</span>
        <span class="print-text">Print</span>
      </button>
    </div>
    <div class="modern-result-body">`;

  html += `<div class="modern-section">
    <div class="modern-section-divider">
      <span class="section-divider-icon">📏</span>
      <span class="section-divider-title">Section Properties</span>
    </div>
    <div class="modern-results-grid">`;
  html += createRow("Effective Depth (d)", d.toFixed(1) + " mm",   "");
  html += createRow("Factored Load (wu)",  wu.toFixed(3) + " kPa", "");
  html += `</div></div>`;

  html += mode === "1" ? _oneWay(fc, fy, h, db, d, wu) : _twoWay(fc, fy, h, db, d, wu);
  html += `</div>`;

  // For one-way, draw slab section after DOM paints
  if (mode === "1") {
    const L_val   = getVal("s_L") || 0;
    const s_main  = _solveSpacing(
      parseFloat(getStr("s_supp")) * wu * L_val * L_val,
      h - SLAB_COVER - db / 2, fc, fy, db, h
    );
    renderResults("slab-results", html, () => {
      drawSlabSection("slabCanvas", h, db, SLAB_COVER, s_main, L_val * 1000);
    });
  } else {
    renderResults("slab-results", html);
  }
}

// =============================================================================
// PRIVATE HELPERS
// =============================================================================

/**
 * As_min for temperature/shrinkage — ACI 318-14 §24.4.3.2
 * ρ_min = 0.0018 for Grade 275–420
 */
function _asMin(h) { return 0.0018 * 1000 * h; }

/**
 * Solve bar spacing for a 1-m-wide strip.
 * Max spacing: lesser of 3h or 450 mm — ACI 318-14 §8.7.2.2
 */
function _solveSpacing(Mu_strip, d, fc, fy, db, h) {
  const As_min = _asMin(h);
  let As = As_min;

  if (Mu_strip > 0) {
    const Rn   = (Mu_strip * 1e6) / (PHI_FLEX * 1000 * d * d);
    const term = 1 - (2 * Rn) / (0.85 * fc);
    if (term > 0) {
      const rho = (0.85 * fc / fy) * (1 - Math.sqrt(term));
      As = Math.max(rho * 1000 * d, As_min);
    }
  }

  const Ab    = barArea(db);
  const s_max = Math.min(3 * h, 450);
  const s     = Math.floor(Math.min((Ab / As) * 1000, s_max) / 5) * 5;
  return Math.max(s, 75);
}

// =============================================================================
// ONE-WAY SLAB
// =============================================================================
function _oneWay(fc, fy, h, db, d, wu) {
  if (!validateFields([{ id:"s_L", label:"Span", min:0.5 }])) return "";

  const L    = getVal("s_L");
  const coef = parseFloat(getStr("s_supp"));   // 0.125 or 0.10

  // Min thickness — ACI 318-14 Table 7.3.1.1
  const h_min_denom = coef === 0.125 ? 20 : 24;
  const h_min = (L * 1000 / h_min_denom) * (0.4 + fy / 700);

  // Moment (uses selected coefficient — C1 fix already in place)
  const Mu_pos = coef * wu * L * L;

  const s_main   = _solveSpacing(Mu_pos, d, fc, fy, db, h);
  const s_shrink = _solveSpacing(0,      d, fc, fy, db, h);

  // One-way shear (per metre width) — ACI 318-14 §22.5
  const Vc_1m = (0.17 * Math.sqrt(fc) * 1000 * d) / 1000;
  const PhiVc = PHI_SHEAR * Vc_1m;
  const Vu_1m = wu * L / 2;

  const rebarBars = [
    { mark:"S1", count:"—", dia:db, length:`${(L*1000).toFixed(0)}mm`, location:"Main Steel (Bottom)" },
    { mark:"T1", count:"—", dia:db, length:"Perpendicular",             location:`Temp/Shrinkage @ ${s_shrink}mm` },
  ];

  let html = `
    <div class="modern-chart-card">
      <div class="modern-chart-header">
        <span class="chart-header-icon">📐</span>
        <span class="chart-header-title">Section Preview — One-Way Slab</span>
      </div>
      <div class="modern-chart-content">
        <canvas id="slabCanvas" width="460" height="160"></canvas>
      </div>
    </div>`;

  html += `<div class="modern-section">
    <div class="modern-section-divider">
      <span class="section-divider-icon">📊</span>
      <span class="section-divider-title">Serviceability — Min Thickness</span>
      <span class="section-divider-code">ACI 318-14 Table 7.3.1.1</span>
    </div>
    <div class="modern-results-grid">`;
  html += createRow("h_min Required", h_min.toFixed(0) + " mm", h >= h_min ? "PASS" : "FAIL");
  html += createRow("Factored Moment (Mu)", Mu_pos.toFixed(3) + " kNm/m", "");
  html += `</div></div>`;

  html += `<div class="modern-section">
    <div class="modern-section-divider">
      <span class="section-divider-icon">⚡</span>
      <span class="section-divider-title">Flexural Reinforcement</span>
    </div>
    <div class="modern-results-grid">`;
  html += createRow("Main Steel (Bottom)",    `${db}mm Ø @ ${s_main}mm`,   "");
  html += createRow("Temp / Shrinkage (Top)", `${db}mm Ø @ ${s_shrink}mm`, "");
  html += `</div></div>`;

  html += `<div class="modern-section">
    <div class="modern-section-divider">
      <span class="section-divider-icon">✂️</span>
      <span class="section-divider-title">Shear Check</span>
      <span class="section-divider-code">ACI 318-14 §22.5</span>
    </div>
    <div class="modern-results-grid">`;
  html += createProgressBar("Vu vs φVc", Vu_1m, PhiVc, "kN/m");
  html += createRow("φVc Capacity", PhiVc.toFixed(2) + " kN/m", PhiVc >= Vu_1m ? "SAFE" : "FAIL");
  html += `</div></div>`;

  html += `<div class="modern-section">
    <div class="modern-section-divider">
      <span class="section-divider-icon">📋</span>
      <span class="section-divider-title">Rebar Schedule</span>
    </div>`;
  html += createRebarSchedule(rebarBars);
  html += `</div>`;

  return html;
}

// =============================================================================
// TWO-WAY FLAT PLATE
// =============================================================================
function _twoWay(fc, fy, h, db, d, wu) {
  if (!validateFields([
    { id:"s_Lx",    label:"Short span Lx", min:1   },
    { id:"s_Ly",    label:"Long span Ly",  min:1   },
    { id:"s_col_w", label:"Column width",  min:150 },
  ])) return "";

  const Lx    = getVal("s_Lx");
  const Ly    = getVal("s_Ly");
  const col_w = getVal("s_col_w");
  
  // Ensure Lx ≤ Ly (Lx is short span)
  if (Lx > Ly) {
    showError("s_Lx", "Lx must be ≤ Ly (short span)");
    return "";
  }
  
  // Aspect ratio
  const beta = Ly / Lx;

  // --- ONE-WAY SLAB LIMIT ENFORCER ---
  if (beta > 2.0) {
    showError("s_Ly", `Aspect ratio β = ${beta.toFixed(2)} > 2.0.`);
    showError("s_Ly", "Slab acts as One-Way. Please switch to the One-Way Slab module.");
    return ""; // HARD STOP
  }
  
  // ==========================================================================
  // MIN THICKNESS CHECK — ACI 318-14 Table 8.3.1.1
  // For flat plates without edge beams: h_min = Ln/30 (fy=414), adjust for fy
  // ==========================================================================
  const Ln      = Lx * 1000 - col_w;  // Clear span (mm)
  const h_min_base = Ln / 30;
  const h_min   = h_min_base * (0.4 + fy / 700);  // Modification for fy ≠ 414
  
  // ==========================================================================
  // PUNCHING SHEAR — ACI 318-14 §22.6
  // Critical perimeter bo at d/2 from column face
  // ==========================================================================
  const bo    = 4 * (col_w + d);
  const Vu_p  = wu * Lx * Ly;
  const Vc_p  = (0.33 * Math.sqrt(fc) * bo * d) / 1000;
  const PhiVc = PHI_SHEAR * Vc_p;

  // ==========================================================================
  // MOMENT COEFFICIENTS — User input or loaded from ACI Table 8.10.3.1
  // ==========================================================================
  const cn_s = parseFloat(getStr("s_cn_s")) || 0;
  const cp_s = parseFloat(getStr("s_cp_s")) || 0;
  const cn_l = parseFloat(getStr("s_cn_l")) || 0;
  const cp_l = parseFloat(getStr("s_cp_l")) || 0;

  // Total factored moments per unit width (kNm/m)
  const Mu_ns_total = cn_s * wu * Lx * Lx;
  const Mu_ps_total = cp_s * wu * Lx * Lx;
  const Mu_nl_total = cn_l * wu * Ly * Ly;
  const Mu_pl_total = cp_l * wu * Ly * Ly;

  // ==========================================================================
  // COLUMN STRIP & MIDDLE STRIP WIDTHS — ACI 318-14 §8.4.1.5
  // Column strip width = 0.25 × min(Lx, Ly) on each side of column centerline
  // Middle strip = remaining width
  // ==========================================================================
  const L1 = Math.min(Lx, Ly) * 1000;  // mm
  const L2 = Math.max(Lx, Ly) * 1000;  // mm
  
  const col_strip_width_short = 0.5 * L1;  // Total width (both sides of column)
  const mid_strip_width_short = Ly * 1000 - col_strip_width_short;
  
  const col_strip_width_long  = 0.5 * L1;
  const mid_strip_width_long  = Lx * 1000 - col_strip_width_long;

  // ==========================================================================
  // MOMENT DISTRIBUTION — ACI 318-14 Table 8.4.2.2.2 & Table 8.4.2.2.3
  // 
  // For flat plates (α₁L₂/L₁ = 0):
  // 
  // SHORT DIRECTION (perpendicular to Ly):
  //   Negative moment: 75% to column strip, 25% to middle strip
  //   Positive moment: 60% to column strip, 40% to middle strip
  // 
  // LONG DIRECTION (perpendicular to Lx):
  //   For β ≥ 2.0: 100% to column strip, 0% to middle strip
  //   For β < 2.0: Interpolate
  // ==========================================================================
  
  // Short direction distribution
  const short_neg_col_frac = 0.75;
  const short_pos_col_frac = 0.60;
  
  // Long direction distribution (varies with aspect ratio β)
  let long_neg_col_frac, long_pos_col_frac;
  if (beta >= 2.0) {
    long_neg_col_frac = 1.0;
    long_pos_col_frac = 1.0;
  } else {
    // Linear interpolation: at β=1.0 → 75%, at β=2.0 → 100%
    long_neg_col_frac = 0.75 + (beta - 1.0) * 0.25;
    long_pos_col_frac = 0.60 + (beta - 1.0) * 0.40;
  }
  
  // Moments in column strips (kNm total)
  const Mu_ns_col = Mu_ns_total * short_neg_col_frac * (Ly * 1000);  // Total moment in strip
  const Mu_ps_col = Mu_ps_total * short_pos_col_frac * (Ly * 1000);
  const Mu_nl_col = Mu_nl_total * long_neg_col_frac  * (Lx * 1000);
  const Mu_pl_col = Mu_pl_total * long_pos_col_frac  * (Lx * 1000);
  
  // Moments in middle strips (kNm total)
  const Mu_ns_mid = Mu_ns_total * (1 - short_neg_col_frac) * (Ly * 1000);
  const Mu_ps_mid = Mu_ps_total * (1 - short_pos_col_frac) * (Ly * 1000);
  const Mu_nl_mid = Mu_nl_total * (1 - long_neg_col_frac)  * (Lx * 1000);
  const Mu_pl_mid = Mu_pl_total * (1 - long_pos_col_frac)  * (Lx * 1000);
  
  // Moments per unit width for each strip (kNm/m)
  const Mu_ns_col_per_m = Mu_ns_col / (col_strip_width_short / 1000);
  const Mu_ps_col_per_m = Mu_ps_col / (col_strip_width_short / 1000);
  const Mu_ns_mid_per_m = Mu_ns_mid / (mid_strip_width_short / 1000);
  const Mu_ps_mid_per_m = Mu_ps_mid / (mid_strip_width_short / 1000);
  
  const Mu_nl_col_per_m = Mu_nl_col / (col_strip_width_long / 1000);
  const Mu_pl_col_per_m = Mu_pl_col / (col_strip_width_long / 1000);
  const Mu_nl_mid_per_m = Mu_nl_mid / (mid_strip_width_long / 1000);
  const Mu_pl_mid_per_m = Mu_pl_mid / (mid_strip_width_long / 1000);

  // ==========================================================================
  // REINFORCEMENT DESIGN
  // ==========================================================================
  
  // Short direction - column strip
  const s_ns_col = _solveSpacing(Mu_ns_col_per_m, d, fc, fy, db, h);
  const s_ps_col = _solveSpacing(Mu_ps_col_per_m, d, fc, fy, db, h);
  
  // Short direction - middle strip
  const s_ns_mid = _solveSpacing(Mu_ns_mid_per_m, d, fc, fy, db, h);
  const s_ps_mid = _solveSpacing(Mu_ps_mid_per_m, d, fc, fy, db, h);
  
  // Long direction - column strip
  const s_nl_col = _solveSpacing(Mu_nl_col_per_m, d, fc, fy, db, h);
  const s_pl_col = _solveSpacing(Mu_pl_col_per_m, d, fc, fy, db, h);
  
  // Long direction - middle strip
  const s_nl_mid = _solveSpacing(Mu_nl_mid_per_m, d, fc, fy, db, h);
  const s_pl_mid = _solveSpacing(Mu_pl_mid_per_m, d, fc, fy, db, h);

  // ==========================================================================
  // REBAR SCHEDULE — Enhanced with strip-specific details
  // ==========================================================================
  const rebarBars = [
    { mark:"S-CS", count:"—", dia:db, length:`${(Ly*1000).toFixed(0)}mm`, location:`Short Neg. (Column Strip @ ${s_ns_col}mm)` },
    { mark:"S+CS", count:"—", dia:db, length:`${(Ly*1000).toFixed(0)}mm`, location:`Short Pos. (Column Strip @ ${s_ps_col}mm)` },
    { mark:"S-MS", count:"—", dia:db, length:`${(Ly*1000).toFixed(0)}mm`, location:`Short Neg. (Middle Strip @ ${s_ns_mid}mm)` },
    { mark:"S+MS", count:"—", dia:db, length:`${(Ly*1000).toFixed(0)}mm`, location:`Short Pos. (Middle Strip @ ${s_ps_mid}mm)` },
    { mark:"L-CS", count:"—", dia:db, length:`${(Lx*1000).toFixed(0)}mm`, location:`Long Neg. (Column Strip @ ${s_nl_col}mm)` },
    { mark:"L+CS", count:"—", dia:db, length:`${(Lx*1000).toFixed(0)}mm`, location:`Long Pos. (Column Strip @ ${s_pl_col}mm)` },
    { mark:"L-MS", count:"—", dia:db, length:`${(Lx*1000).toFixed(0)}mm`, location:`Long Neg. (Middle Strip @ ${s_nl_mid}mm)` },
    { mark:"L+MS", count:"—", dia:db, length:`${(Lx*1000).toFixed(0)}mm`, location:`Long Pos. (Middle Strip @ ${s_pl_mid}mm)` },
  ];

  // ==========================================================================
  // BUILD MODERN OUTPUT HTML
  // ==========================================================================
  let html = `<div class="modern-section">
    <div class="modern-section-divider">
      <span class="section-divider-icon">📐</span>
      <span class="section-divider-title">Panel Geometry & Aspect Ratio</span>
    </div>
    <div class="modern-results-grid">`;
  html += createRow("Short Span (Lx)",    Lx.toFixed(2) + " m",  "");
  html += createRow("Long Span (Ly)",     Ly.toFixed(2) + " m",  "");
  html += createRow("Aspect Ratio (β)",   beta.toFixed(2),        beta <= 2.0 ? "OK" : "WARN");
  if (beta > 2.0) html += createRow("Note", "β > 2.0: Long direction acts as one-way", "WARN");
  html += `</div></div>`;

  html += `<div class="modern-section">
    <div class="modern-section-divider">
      <span class="section-divider-icon">📊</span>
      <span class="section-divider-title">Min Thickness</span>
      <span class="section-divider-code">ACI 318-14 Table 8.3.1.1</span>
    </div>
    <div class="modern-results-grid">`;
  html += createRow("h_min Required",  h_min.toFixed(0) + " mm", h >= h_min ? "PASS" : "FAIL");
  html += createRow("h Provided",      h.toFixed(0)     + " mm", "");
  html += `</div></div>`;
  
  html += `<div class="modern-section">
    <div class="modern-section-divider">
      <span class="section-divider-icon">🔨</span>
      <span class="section-divider-title">Punching Shear</span>
      <span class="section-divider-code">ACI 318-14 §22.6</span>
    </div>
    <div class="modern-results-grid">`;
  html += createRow("Critical Perimeter (bo)", bo.toFixed(0) + " mm", "");
  html += createProgressBar("Vu vs φVc (Punching)", Vu_p, PhiVc, "kN");
  html += createRow("φVc Capacity", PhiVc.toFixed(1) + " kN", PhiVc >= Vu_p ? "SAFE" : "FAIL");
  html += `</div></div>`;

  html += `<div class="modern-section">
    <div class="modern-section-divider">
      <span class="section-divider-icon">📏</span>
      <span class="section-divider-title">Strip Widths</span>
      <span class="section-divider-code">ACI 318-14 §8.4.1.5</span>
    </div>
    <div class="modern-results-grid">`;
  html += createRow("Short Dir. Column Strip", (col_strip_width_short/1000).toFixed(2) + " m", "");
  html += createRow("Short Dir. Middle Strip", (mid_strip_width_short/1000).toFixed(2) + " m", "");
  html += createRow("Long Dir. Column Strip",  (col_strip_width_long/1000).toFixed(2)  + " m", "");
  html += createRow("Long Dir. Middle Strip",  (mid_strip_width_long/1000).toFixed(2)  + " m", "");
  html += `</div></div>`;

  html += `<div class="modern-section">
    <div class="modern-section-divider">
      <span class="section-divider-icon">⚡</span>
      <span class="section-divider-title">Short Direction — Column Strip</span>
    </div>
    <div class="modern-results-grid">`;
  html += createRow("Neg. Moment",     Mu_ns_col_per_m.toFixed(3) + " kNm/m", "");
  html += createRow("Neg. Steel (top)", `${db}mm Ø @ ${s_ns_col}mm`, "");
  html += createRow("Pos. Moment",     Mu_ps_col_per_m.toFixed(3) + " kNm/m", "");
  html += createRow("Pos. Steel (bot)", `${db}mm Ø @ ${s_ps_col}mm`, "");
  html += `</div></div>`;

  html += `<div class="modern-section">
    <div class="modern-section-divider">
      <span class="section-divider-icon">⚡</span>
      <span class="section-divider-title">Short Direction — Middle Strip</span>
    </div>
    <div class="modern-results-grid">`;
  html += createRow("Neg. Moment",     Mu_ns_mid_per_m.toFixed(3) + " kNm/m", "");
  html += createRow("Neg. Steel (top)", `${db}mm Ø @ ${s_ns_mid}mm`, "");
  html += createRow("Pos. Moment",     Mu_ps_mid_per_m.toFixed(3) + " kNm/m", "");
  html += createRow("Pos. Steel (bot)", `${db}mm Ø @ ${s_ps_mid}mm`, "");
  html += `</div></div>`;

  html += `<div class="modern-section">
    <div class="modern-section-divider">
      <span class="section-divider-icon">⚡</span>
      <span class="section-divider-title">Long Direction — Column Strip</span>
    </div>
    <div class="modern-results-grid">`;
  html += createRow("Neg. Moment",     Mu_nl_col_per_m.toFixed(3) + " kNm/m", "");
  html += createRow("Neg. Steel (top)", `${db}mm Ø @ ${s_nl_col}mm`, "");
  html += createRow("Pos. Moment",     Mu_pl_col_per_m.toFixed(3) + " kNm/m", "");
  html += createRow("Pos. Steel (bot)", `${db}mm Ø @ ${s_pl_col}mm`, "");
  html += `</div></div>`;

  html += `<div class="modern-section">
    <div class="modern-section-divider">
      <span class="section-divider-icon">⚡</span>
      <span class="section-divider-title">Long Direction — Middle Strip</span>
    </div>
    <div class="modern-results-grid">`;
  html += createRow("Neg. Moment",     Mu_nl_mid_per_m.toFixed(3) + " kNm/m", "");
  html += createRow("Neg. Steel (top)", `${db}mm Ø @ ${s_nl_mid}mm`, "");
  html += createRow("Pos. Moment",     Mu_pl_mid_per_m.toFixed(3) + " kNm/m", "");
  html += createRow("Pos. Steel (bot)", `${db}mm Ø @ ${s_pl_mid}mm`, "");
  html += `</div></div>`;

  html += `<div class="modern-section">
    <div class="modern-section-divider">
      <span class="section-divider-icon">📋</span>
      <span class="section-divider-title">Rebar Schedule — Strip-by-Strip Layout</span>
    </div>`;
  html += createRebarSchedule(rebarBars);
  html += `</div>`;

  return html;
}