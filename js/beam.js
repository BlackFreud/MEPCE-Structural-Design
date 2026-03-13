/**
 * @file beam.js
 * @description Beam design module.
 *              Covers singly and doubly reinforced rectangular beams per:
 *              - NSCP 2015 Volume I (Serviceability, Shear, Seismic Detailing)
 *              - ACI 318-14 (Flexural Strength, Strain Limits, Torsion Threshold)
 *
 * @module beam
 * @requires utils.js
 * @requires canvas.js
 */

"use strict";

// ---------------------------------------------------------------------------
// SUPPORT TYPE → span/depth ratio denominators (NSCP 2015 Table 409.3.1.1)
// ---------------------------------------------------------------------------
const BEAM_DENOM = { 1: 16, 2: 18.5, 3: 21, 4: 8 };

// ---------------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------------

/**
 * Main entry point. Reads all beam inputs, runs calculations,
 * renders results HTML, and triggers canvas diagram.
 */
function calculateBeam() {
  // --- Collect inputs ---
  const b      = getVal("b_b");
  const h      = getVal("b_h");
  const cc     = getVal("b_cc");
  const fc     = getVal("b_fc");
  const fy     = getVal("b_fy");
  const fyt    = getVal("b_fyt");
  const L      = getVal("b_L");
  const supp   = parseInt(getStr("b_supp"));
  const db     = getVal("b_db");
  const n      = getVal("b_n");
  const ds     = getVal("b_ds");
  const Mu     = getVal("b_Mu");
  const Vu     = getVal("b_Vu");
  const Tu     = getVal("b_Tu");
  const layers = parseInt(getStr("b_layers"));
  const bType  = getStr("b_type");

  const isDoubly = bType === "doubly";
  let np = 0, dbp = 0, dp = 0;
  if (isDoubly) {
    np  = getVal("b_np");
    dbp = getVal("b_dbp");
    dp  = getVal("b_dp");
  }

  // --- Validate ---
  const inputs = { b, h, cc, fc, fy, fyt, L, db, n, ds, Mu, Vu };
  if (Object.values(inputs).some(isNaN)) {
    alert("Please fill in all required beam inputs.");
    return;
  }

  // === GEOMETRY ===
  /**
   * Effective depth d, accounting for cover, stirrup, bar centroid,
   * and whether bars are in 1 or 2 layers.
   * d = h - cc - ds - db/2 [- (db+25)/2 for 2nd layer centroid shift]
   * Ref: NSCP 2015 §406.3
   */
  const centroidShift = layers === 2 ? (db + 25) / 2 : 0;
  const d = h - cc - ds - db / 2 - centroidShift;

  const As  = n   * barArea(db);
  const Asp = isDoubly ? np * barArea(dbp) : 0;
  const beta1 = getBeta1(fc);

  // === SERVICEABILITY — Minimum Thickness (NSCP 2015 Table 409.3.1.1) ===
  const denom  = BEAM_DENOM[supp] || 16;
  const mod    = 0.4 + (fy / 700);           // Modification for fy ≠ 420 MPa
  const h_min  = ((L * 1000) / denom) * mod;

  // === FLEXURAL STRENGTH ===
  const { Mn, et, c, fspText } = isDoubly
    ? _doublyFlex(As, Asp, b, d, dp, fc, fy, beta1)
    : _singlyFlex(As, b, d, fc, fy, beta1);

  const phi   = getPhiFlex(et);
  const PhiMn = phi * Mn;

  // === SHEAR (ACI 318-14 §22.5) ===
  const shearResult = _shearDesign(b, d, fc, fy, fyt, Vu, ds, n, db);

  // === TORSION THRESHOLD (ACI 318-14 §22.7) ===
  let torsionRow = "";
  if (Tu > 0) {
    const Acp = b * h;
    const Pcp = 2 * (b + h);
    const Tth = (0.75 * 0.083 * Math.sqrt(fc) * Math.pow(Acp, 2)) / (Pcp * 1e6);
    torsionRow = createRow("Torsion Threshold", Tth.toFixed(2) + " kNm", Tu < Tth ? "IGNORE" : "WARN");
  }

  // === BUILD RESULT HTML ===
  let html = `<div class="result-header">BEAM ANALYSIS — ${isDoubly ? "DOUBLY" : "SINGLY"} REINFORCED</div>
              <div class="result-body">`;

  // Canvas placeholder (drawn after HTML injection)
  html += `<div class="chart-card">
    <div class="chart-title">SECTION PREVIEW</div>
    <div style="display:flex;justify-content:center;">
      <canvas id="beamCanvas" width="260" height="210"></canvas>
    </div>
  </div>`;

  // --- Geometry ---
  html += createDivider("GEOMETRY");
  html += createRow("Overall Depth (h)", h.toFixed(0) + " mm", "");
  html += createRow("Effective Depth (d)", d.toFixed(1) + " mm", "");
  html += createRow("Tension Steel Area (As)", As.toFixed(0) + " mm²", "");
  if (isDoubly) {
    html += createRow("Comp. Steel Area (As')", Asp.toFixed(0) + " mm²", "");
    html += createRow("Comp. Steel Stress", fspText, "");
  }

  // --- Serviceability ---
  html += createDivider("SERVICEABILITY (NSCP 2015 TABLE 409.3.1.1)");
  html += createRow("Min Thickness Required", h_min.toFixed(0) + " mm",
                    h >= h_min ? "PASS" : "FAIL");

  // --- Flexure ---
  html += createDivider("FLEXURAL STRENGTH (ACI 318-14 §22.3)");
  html += createRow("Neutral Axis (c)",   c.toFixed(1) + " mm",   "");
  html += createRow("Net Tensile Strain", et.toFixed(5),           et >= 0.005 ? "DUCTILE" : "TRANSITION");
  html += createRow("Strength Factor φ",  phi.toFixed(3),          "");
  html += createRow("φMn Capacity",       PhiMn.toFixed(2) + " kNm", PhiMn >= Mu ? "SAFE" : "UNSAFE");
  html += createRow("Demand Mu",          Mu.toFixed(2) + " kNm",  "");

  // --- Shear ---
  html += createDivider("SHEAR DESIGN (ACI 318-14 §22.5)");
  html += createRow("φVc Concrete Capacity", shearResult.PhiVc.toFixed(2) + " kN", "");
  html += createRow("Shear Design Result",   shearResult.summary,
                    shearResult.pass ? "PASS" : "FAIL");

  // --- Seismic ---
  html += createDivider("SEISMIC DETAILING (NSCP 2015 ZONE 4 / ACI 318-14 §18)");
  const s_hoop = Math.floor(Math.min(d / 4, 8 * db, 24 * ds, 300));
  html += createRow("Confinement Hoop Spacing", `${ds}mm Ø @ ${s_hoop}mm`, "");

  if (torsionRow) {
    html += createDivider("TORSION (ACI 318-14 §22.7)");
    html += torsionRow;
  }

  html += `</div>`;

  const container = document.getElementById("beam-results");
  container.innerHTML = html;
  container.style.display = "block";

  // Draw canvas after DOM update
  setTimeout(() => {
    drawBeamSection("beamCanvas", b, h, cc, n, isDoubly ? np : 0, db, ds, layers);
  }, 80);
}

// ---------------------------------------------------------------------------
// PRIVATE HELPERS
// ---------------------------------------------------------------------------

/**
 * Singly reinforced flexural analysis.
 * Ref: ACI 318-14 §22.3 — Rectangular Stress Block method.
 *
 * @param {number} As     - Tension steel area (mm²).
 * @param {number} b      - Beam width (mm).
 * @param {number} d      - Effective depth (mm).
 * @param {number} fc     - Concrete strength (MPa).
 * @param {number} fy     - Steel yield strength (MPa).
 * @param {number} beta1  - Whitney stress block factor.
 * @returns {{Mn: number, et: number, c: number, fspText: string}}
 */
function _singlyFlex(As, b, d, fc, fy, beta1) {
  const a  = (As * fy) / (0.85 * fc * b);
  const c  = a / beta1;
  const Mn = (As * fy * (d - a / 2)) / 1e6;     // kNm
  const et = MAX_CONCRETE_STRAIN * (d - c) / c;
  return { Mn, et, c, fspText: "N/A" };
}

/**
 * Doubly reinforced flexural analysis using iterative equilibrium.
 * Iterates on neutral axis depth c until ΣF = 0 (tolerance: 0.1 N).
 * Ref: ACI 318-14 §22.3 + §22.2 (compression steel compatibility).
 *
 * @param {number} As     - Tension steel area (mm²).
 * @param {number} Asp    - Compression steel area (mm²).
 * @param {number} b      - Beam width (mm).
 * @param {number} d      - Effective depth (mm).
 * @param {number} dp     - Depth to comp. steel centroid (mm).
 * @param {number} fc     - Concrete strength (MPa).
 * @param {number} fy     - Steel yield strength (MPa).
 * @param {number} beta1  - Whitney stress block factor.
 * @returns {{Mn: number, et: number, c: number, fspText: string}}
 */
function _doublyFlex(As, Asp, b, d, dp, fc, fy, beta1) {
  let c = d / 3;
  const TMAX = 200;
  const TOL  = 0.1;                  // N — force equilibrium tolerance

  for (let i = 0; i < TMAX; i++) {
    const esp   = MAX_CONCRETE_STRAIN * (c - dp) / c;
    const fsp   = steelStress(esp, fy);
    const Cc    = 0.85 * fc * beta1 * c * b;
    const Cs    = Asp * (fsp - 0.85 * fc);
    const T     = As * fy;
    const res   = Cc + Cs - T;
    if (Math.abs(res) < TOL) break;
    c = c - res / (0.85 * fc * beta1 * b);   // Newton step
  }

  const esp  = MAX_CONCRETE_STRAIN * (c - dp) / c;
  const fsp  = steelStress(esp, fy);
  const Cc   = 0.85 * fc * beta1 * c * b;
  const Cs   = Asp * (fsp - 0.85 * fc);
  const Mn   = (Cc * (d - (beta1 * c) / 2) + Cs * (d - dp)) / 1e6;  // kNm
  const et   = MAX_CONCRETE_STRAIN * (d - c) / c;
  const fspText = `${fsp.toFixed(1)} MPa — ${Math.abs(fsp) >= fy ? "YIELD" : "ELASTIC"}`;
  return { Mn, et, c, fspText };
}

/**
 * Shear design per ACI 318-14 §22.5.
 * Determines if stirrups are required and computes spacing.
 *
 * @param {number} b    - Beam width (mm).
 * @param {number} d    - Effective depth (mm).
 * @param {number} fc   - Concrete compressive strength (MPa).
 * @param {number} fy   - Longitudinal steel fy (MPa).
 * @param {number} fyt  - Stirrup yield strength (MPa).
 * @param {number} Vu   - Factored shear (kN).
 * @param {number} ds   - Stirrup diameter (mm).
 * @param {number} n    - Number of longitudinal bars (for min Av check).
 * @param {number} db   - Longitudinal bar diameter (mm).
 * @returns {{PhiVc: number, summary: string, pass: boolean}}
 */
function _shearDesign(b, d, fc, fy, fyt, Vu, ds, n, db) {
  // ACI 318-14 Eq. (22.5.5.1) — Simplified Vc
  const Vc    = (0.17 * Math.sqrt(fc) * b * d) / 1000;   // kN
  const PhiVc = PHI_SHEAR * Vc;
  const Av    = 2 * barArea(ds);                          // Two legs per stirrup

  let summary = "";
  let pass    = true;

  if (Vu <= 0.5 * PhiVc) {
    summary = "Vu ≤ 0.5φVc — No stirrups required";
  } else if (Vu <= PhiVc) {
    summary = `Min stirrups req'd — Use ${ds}mm @ ${Math.floor(d / 2)}mm`;
  } else {
    const Vs_req  = Vu / PHI_SHEAR - Vc;                 // Required Vs (kN)
    const Vc_lim  = (0.66 * Math.sqrt(fc) * b * d) / 1000;

    if (Vs_req > Vc_lim) {
      summary = "Section too small — increase beam size";
      pass    = false;
    } else {
      // ACI 318-14 §22.5.8.5.3
      const s_calc = (Av * fyt * d) / (Vs_req * 1000);
      // Max spacing: d/4 when Vs > 0.33√fc·bw·d, else d/2 (§9.7.6.2.2)
      const Vs_limit = (0.33 * Math.sqrt(fc) * b * d) / 1000;
      const s_max = Math.min(Vs_req > Vs_limit ? d / 4 : d / 2, 600);
      const s_final = Math.floor(Math.min(s_calc, s_max));
      summary = `Use ${ds}mm Ø stirrups @ ${s_final}mm`;
    }
  }

  return { PhiVc, summary, pass };
}