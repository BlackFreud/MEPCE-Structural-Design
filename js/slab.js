/**
 * @file slab.js
 * @description Slab design module.
 *              Covers one-way and two-way flat plate slabs per:
 *              - NSCP 2015 (Minimum thickness, temperature steel)
 *              - ACI 318-14 §8 (One-way), §8.11 (Two-way), §22.6 (Punching shear)
 *
 * @module slab
 * @requires utils.js
 */

"use strict";

// ---------------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------------

/**
 * Main entry point. Reads all slab inputs, routes to the appropriate
 * design method, renders results HTML.
 */
function calculateSlab() {
  const fc   = getVal("s_fc");
  const fy   = getVal("s_fy");
  const h    = getVal("s_h");
  const db   = getVal("s_db");
  const DL   = getVal("s_DL");
  const LL   = getVal("s_LL");
  const mode = getStr("s_mode");

  if ([fc, fy, h, db, DL, LL].some(isNaN)) {
    alert("Please fill in all required slab inputs.");
    return;
  }

  /**
   * Effective depth for slab:
   *   d = h − cover − db/2
   * Cover = 20 mm (interior exposure, NSCP 2015 Table 420.6.1.3.1)
   */
  const COVER = 20;
  const d     = h - COVER - db / 2;

  /**
   * Factored load (per unit area):
   * wu = 1.2·(SDL + γc·h) + 1.6·LL
   * Concrete unit weight γc = 24 kN/m³ (NSCP 2015 §404.2.3)
   * Ref: NSCP 2015 §205 load combinations
   */
  const gamma_c = 24;            // kN/m³
  const wu      = 1.2 * (DL + gamma_c * h / 1000) + 1.6 * LL;

  let html = `<div class="result-header">SLAB ANALYSIS — ${mode === "1" ? "ONE-WAY" : "TWO-WAY (FLAT PLATE)"}</div>
              <div class="result-body">`;

  html += createDivider("SECTION PROPERTIES");
  html += createRow("Effective Depth (d)",  d.toFixed(1) + " mm", "");
  html += createRow("Factored Load (wu)",   wu.toFixed(3) + " kPa", "");

  if (mode === "1") {
    html += _oneWay(fc, fy, h, db, d, wu);
  } else {
    html += _twoWay(fc, fy, h, db, d, wu);
  }

  html += `</div>`;

  const container = document.getElementById("slab-results");
  container.innerHTML = html;
  container.style.display = "block";
}

// ---------------------------------------------------------------------------
// PRIVATE HELPERS
// ---------------------------------------------------------------------------

/**
 * Computes minimum steel area per unit width (per ACI 318-14 §24.4.3.2 /
 * NSCP 2015 §424.4.3.2) for temperature and shrinkage.
 *
 * As_min = ρ_min × b × h  where b = 1000 mm per metre strip
 *
 * @param {number} h - Slab thickness (mm).
 * @returns {number} Minimum steel area (mm²/m).
 */
function _asMin(h) {
  return 0.0018 * 1000 * h;   // ρ_min = 0.0018 for Grade 275–420
}

/**
 * Determines bar spacing for a given moment demand in a 1-m-wide strip.
 * Floors the spacing to the nearest 5 mm; applies ACI 318-14 §8.7.2.2 max-spacing limits.
 *
 * @param {number} Mu_strip - Factored moment per unit width (kNm/m).
 * @param {number} d        - Effective depth (mm).
 * @param {number} fc       - Concrete compressive strength (MPa).
 * @param {number} fy       - Steel yield strength (MPa).
 * @param {number} db       - Bar diameter (mm).
 * @param {number} h        - Slab thickness (mm).
 * @returns {number} Design bar spacing (mm).
 */
function _solveSpacing(Mu_strip, d, fc, fy, db, h) {
  const phi  = PHI_FLEX;
  const As_min = _asMin(h);

  let As = As_min;   // Default to minimum

  if (Mu_strip > 0) {
    const Rn   = (Mu_strip * 1e6) / (phi * 1000 * d * d);
    const term = 1 - (2 * Rn) / (0.85 * fc);
    if (term > 0) {
      const rho = (0.85 * fc / fy) * (1 - Math.sqrt(term));
      As = Math.max(rho * 1000 * d, As_min);
    }
  }

  // s = Ab / As × 1000  (bars per metre strip)
  const Ab = barArea(db);
  // Max spacing per ACI 318-14 §8.7.2.2: lesser of 3h or 450 mm
  const s_max = Math.min(3 * h, 450);
  const s     = Math.floor(Math.min((Ab / As) * 1000, s_max) / 5) * 5;
  return Math.max(s, 75);   // Practical minimum spacing = 75 mm
}

// ---------------------------------------------------------------------------
// ONE-WAY SLAB
// ---------------------------------------------------------------------------

/**
 * One-way slab design. Uses moment coefficient method for simple or
 * continuous spans (NSCP 2015 Table 406.5.2 / ACI 318-14 §6.5).
 *
 * @param {number} fc  - fc' (MPa).
 * @param {number} fy  - fy (MPa).
 * @param {number} h   - Slab thickness (mm).
 * @param {number} db  - Bar diameter (mm).
 * @param {number} d   - Effective depth (mm).
 * @param {number} wu  - Factored load (kPa).
 * @returns {string} HTML result rows.
 */
function _oneWay(fc, fy, h, db, d, wu) {
  const L    = getVal("s_L");
  const coef = parseFloat(getStr("s_supp"));   // 0.125 simple, 0.10 continuous

  if (isNaN(L)) return "<p style='color:red'>Span length is required.</p>";

  /**
   * Minimum slab thickness per ACI 318-14 Table 7.3.1.1
   * h_min = L/20 for simply supported, L/24 continuous.
   * Modification for fy: ×(0.4 + fy/700)
   */
  const h_min_coef = coef === 0.125 ? 20 : 24;
  const h_min = (L * 1000 / h_min_coef) * (0.4 + fy / 700);

  // Moment per unit width (kNm/m)
  const Mu_pos = coef * wu * L * L;

  const s_main  = _solveSpacing(Mu_pos, d, fc, fy, db, h);
  const s_shrink = _solveSpacing(0, d, fc, fy, db, h);   // min = temp/shrinkage

  let html = createDivider("SERVICEABILITY (ACI 318-14 TABLE 7.3.1.1)");
  html += createRow("Min Thickness (h_min)", h_min.toFixed(0) + " mm", h >= h_min ? "PASS" : "FAIL");
  html += createRow("Factored Moment (Mu)", Mu_pos.toFixed(3) + " kNm/m", "");

  html += createDivider("FLEXURAL REINFORCEMENT");
  html += createRow("Main Steel (bottom)", `${db}mm Ø @ ${s_main}mm`, "");
  html += createRow("Temp/Shrinkage Steel",`${db}mm Ø @ ${s_shrink}mm`, "");

  // One-way shear capacity (per metre width)
  html += createDivider("SHEAR CHECK (ACI 318-14 §22.5)");
  const Vc_1m  = (0.17 * Math.sqrt(fc) * 1000 * d) / 1000;   // kN/m
  const PhiVc  = PHI_SHEAR * Vc_1m;
  const Vu_1m  = wu * L / 2;                                   // Simple support max
  html += createRow("Max Shear (Vu)", Vu_1m.toFixed(2) + " kN/m", "");
  html += createRow("Shear Capacity (φVc)", PhiVc.toFixed(2) + " kN/m",
                    PhiVc >= Vu_1m ? "SAFE" : "FAIL");

  return html;
}

// ---------------------------------------------------------------------------
// TWO-WAY SLAB (FLAT PLATE)
// ---------------------------------------------------------------------------

/**
 * Two-way flat plate slab design.
 * Computes punching shear capacity and column strip / middle strip
 * reinforcement using input moment coefficients.
 *
 * @param {number} fc  - fc' (MPa).
 * @param {number} fy  - fy (MPa).
 * @param {number} h   - Slab thickness (mm).
 * @param {number} db  - Bar diameter (mm).
 * @param {number} d   - Effective depth (mm).
 * @param {number} wu  - Factored load (kPa).
 * @returns {string} HTML result rows.
 */
function _twoWay(fc, fy, h, db, d, wu) {
  const Lx   = getVal("s_Lx");
  const col_w = getVal("s_col_w");

  if (isNaN(Lx) || isNaN(col_w)) return "<p style='color:red'>Span and column width are required.</p>";

  /**
   * Punching shear perimeter:
   * bo = 4·(c + d)  — critical perimeter at d/2 from column face.
   * Ref: ACI 318-14 §22.6.4.1
   */
  const bo    = 4 * (col_w + d);                               // mm
  const Vu    = wu * Lx * Lx;                                   // kN — conservative tributary

  /**
   * Punching shear capacity — ACI 318-14 §22.6.5.2 (min of three equations):
   * Vc = 0.33√fc·bo·d  (interior column, β ≥ 2 governs minimum)
   */
  const Vc    = (0.33 * Math.sqrt(fc) * bo * d) / 1000;        // kN
  const PhiVc = PHI_SHEAR * Vc;

  // Moment coefficients from inputs
  const cn_s = parseFloat(getStr("s_cn_s") || "0");
  const cp_s = parseFloat(getStr("s_cp_s") || "0.05");
  const cn_l = parseFloat(getStr("s_cn_l") || "0");
  const cp_l = parseFloat(getStr("s_cp_l") || "0.05");

  const Mu_ns = cn_s * wu * Lx * Lx;   // Negative short direction (kNm/m)
  const Mu_ps = cp_s * wu * Lx * Lx;   // Positive short direction
  const Mu_nl = cn_l * wu * Lx * Lx;   // Negative long direction
  const Mu_pl = cp_l * wu * Lx * Lx;   // Positive long direction

  let html = createDivider("PUNCHING SHEAR (ACI 318-14 §22.6)");
  html += createRow("Critical Perimeter (bo)", bo.toFixed(0) + " mm", "");
  html += createRow("Punching Demand (Vu)",     Vu.toFixed(1) + " kN", "");
  html += createRow("Punching Capacity (φVc)",  PhiVc.toFixed(1) + " kN",
                    PhiVc >= Vu ? "SAFE" : "FAIL");

  html += createDivider("REINFORCEMENT — SHORT DIRECTION");
  html += createRow("Negative Moment", Mu_ns.toFixed(3) + " kNm/m",   "");
  if (Mu_ns > 0)
    html += createRow("Neg. Steel (top)",   `${db}mm Ø @ ${_solveSpacing(Mu_ns, d, fc, fy, db, h)}mm`, "");
  html += createRow("Positive Moment", Mu_ps.toFixed(3) + " kNm/m",   "");
  html += createRow("Pos. Steel (bot)",  `${db}mm Ø @ ${_solveSpacing(Mu_ps, d, fc, fy, db, h)}mm`, "");

  html += createDivider("REINFORCEMENT — LONG DIRECTION");
  html += createRow("Negative Moment", Mu_nl.toFixed(3) + " kNm/m",   "");
  if (Mu_nl > 0)
    html += createRow("Neg. Steel (top)",   `${db}mm Ø @ ${_solveSpacing(Mu_nl, d, fc, fy, db, h)}mm`, "");
  html += createRow("Positive Moment", Mu_pl.toFixed(3) + " kNm/m",   "");
  html += createRow("Pos. Steel (bot)",  `${db}mm Ø @ ${_solveSpacing(Mu_pl, d, fc, fy, db, h)}mm`, "");

  return html;
}