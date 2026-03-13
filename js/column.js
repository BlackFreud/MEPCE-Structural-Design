/**
 * @file column.js
 * @description Column design module.
 *              Covers rectangular and circular tied/spiral columns per:
 *              - NSCP 2015 (Slenderness, Zone 4 Confinement)
 *              - ACI 318-14 (P-M Interaction, Moment Magnification §6.6, §22.4)
 *
 * @module column
 * @requires utils.js
 * @requires canvas.js
 */

"use strict";

// ---------------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------------

/**
 * Main entry point. Reads all column inputs, runs slenderness check,
 * computes moment magnification, generates P-M curve data,
 * renders results HTML, and triggers canvas diagrams.
 */
function calculateColumn() {
  // --- Collect inputs ---
  const b     = getVal("c_b");
  const h     = getVal("c_h");
  const D     = getVal("c_D");
  const fc    = getVal("c_fc");
  const fy    = getVal("c_fy");
  const nb    = getVal("c_nb");
  const db    = getVal("c_db");
  const dt    = getVal("c_dt");
  const Pu   = getVal("c_Pu");
  const Mu   = getVal("c_M2");
  const Lu   = getVal("c_Lu") * 1000;   // m → mm
  const sway  = parseInt(getStr("c_sway"));
  const shape = getStr("c_shape");
  const tie   = getStr("c_tie");

  if ([fc, fy, nb, db, Pu, Mu, Lu].some(isNaN)) {
    alert("Please fill in all required column inputs.");
    return;
  }

  // Governing cross-sectional dimension (depth for rect, D for circular)
  const dim  = shape === "rect" ? h : D;
  const Ag   = shape === "rect" ? b * h : Math.PI * Math.pow(D / 2, 2);
  const As_t = nb * barArea(db);

  // === SLENDERNESS (NSCP 2015 §6.2.5 / ACI 318-14 §6.2.5) ===
  /**
   * Radius of gyration r = 0.3·h (rectangular) or 0.25·D (circular).
   * kl/r compared against 34 (non-sway) or 22 (sway).
   * Ref: ACI 318-14 §6.2.5.1
   */
  const r        = shape === "rect" ? 0.3 * dim : 0.25 * D;
  const klr      = (1.0 * Lu) / r;
  const slenLimit = sway ? 22 : 34;
  const isSlender = klr > slenLimit;

  // === MINIMUM ECCENTRICITY — ACI 318-14 §6.6.4.5.1 ===
  const ecc_min = 15 + 0.03 * dim;   // mm
  let Mc = Math.max(Math.abs(Mu), (Pu * ecc_min) / 1000);

  // === MOMENT MAGNIFICATION — non-sway (ACI 318-14 §6.6.4) ===
  let delta = 1.0;
  if (isSlender && !sway) {
    /**
     * EI per ACI 318-14 §6.6.4.4.4 (simplified):
     * EI = 0.4 · Ec · Ig  (conservative, no creep reduction applied)
     */
    const Ec  = 4700 * Math.sqrt(fc);   // MPa
    const Ig  = shape === "rect"
      ? (b * Math.pow(h, 3)) / 12
      : (Math.PI * Math.pow(D, 4)) / 64;
    const EI  = 0.4 * Ec * Ig;           // N·mm²

    // Critical load Pc — pinned-pinned buckling (k=1)
    const Pc  = (Math.pow(Math.PI, 2) * EI) / Math.pow(Lu, 2) / 1000;  // kN

    // ACI 318-14 Eq. (6.6.4.5.2): δns = Cm / (1 − Pu/(0.75·Pc)) ≥ 1.0
    delta = Math.max(1.0 / (1 - Pu / (0.75 * Pc)), 1.0);
    Mc   *= delta;
  }

  // === P-M INTERACTION DIAGRAM ===
  const pmPoints = _buildPMCurve(shape, b, h, D, fc, fy, nb, db, Ag, As_t);

  // Assess if demand (Mc, Pu) is inside the P-M envelope
  const insideCurve = _isDemandInside(pmPoints, Mc, Pu);

  // === CONFINEMENT — ZONE 4 (NSCP 2015 §418 / ACI 318-14 §18.7.5) ===
  /**
   * Maximum spacing of confining hoops/ties in potential plastic hinge zone:
   *   so ≤ min(b/4 or D/4, 6·db, 150 mm)
   * Ref: ACI 318-14 §18.7.5.3
   */
  const so = Math.floor(Math.min(dim / 4, 6 * db, 150));

  // Reinforcement ratio check
  const rho_g = As_t / Ag;

  // === BUILD RESULT HTML ===
  let html = `<div class="result-header">COLUMN ANALYSIS — ${shape === "rect" ? "RECTANGULAR" : "CIRCULAR"}</div>
              <div class="result-body">`;

  // Canvases
  html += `<div class="chart-wrapper">
    <div class="chart-card">
      <div class="chart-title">P-M INTERACTION DIAGRAM</div>
      <canvas id="pmChart" width="300" height="250"></canvas>
      <div class="chart-legend">
        <div class="legend-item"><span class="dot" style="background:#27ae60"></span>Capacity</div>
        <div class="legend-item"><span class="dot" style="background:#c0392b"></span>Demand (Mc, Pu)</div>
      </div>
    </div>
    <div class="chart-card">
      <div class="chart-title">SECTION PREVIEW</div>
      <div style="display:flex;justify-content:center;">
        <canvas id="colCanvas" width="160" height="160"></canvas>
      </div>
    </div>
  </div>`;

  // --- Section Properties ---
  html += createDivider("SECTION PROPERTIES");
  html += createRow("Gross Area (Ag)",       Ag.toFixed(0) + " mm²",  "");
  html += createRow("Steel Area (As_t)",      As_t.toFixed(0) + " mm²", "");
  html += createRow("Reinf. Ratio (ρg)",      (rho_g * 100).toFixed(2) + " %",
                    rho_g >= 0.01 && rho_g <= 0.08 ? "PASS" : "FAIL");

  // --- Slenderness ---
  html += createDivider(`SLENDERNESS (ACI 318-14 §6.2.5) — LIMIT: kl/r = ${slenLimit}`);
  html += createRow("Slenderness Ratio (kl/r)", klr.toFixed(2), isSlender ? "SLENDER" : "SHORT");
  if (isSlender && !sway) {
    html += createRow("Magnification Factor (δns)", delta.toFixed(3), "");
  }
  html += createRow("Design Moment (Mc)",     Mc.toFixed(2) + " kNm",  "");

  // --- Strength ---
  html += createDivider("AXIAL-FLEXURAL STRENGTH (ACI 318-14 §22.4)");
  html += createRow("P-M Demand vs Capacity", insideCurve ? "Inside envelope" : "Outside envelope",
                    insideCurve ? "SAFE" : "FAIL");

  // --- Max axial ---
  /**
   * Maximum design axial strength:
   * φPn(max) = φ·0.80·[0.85·fc'·(Ag − Ast) + Ast·fy]  (tied)  ACI 318-14 §22.4.2.1
   * φPn(max) = φ·0.85·[0.85·fc'·(Ag − Ast) + Ast·fy]  (spiral)
   */
  const k_type    = tie === "spiral" ? 0.85 : 0.80;
  const phi_col   = tie === "spiral" ? 0.75 : PHI_COMP;
  const Pn_max    = k_type * (0.85 * fc * (Ag - As_t) + As_t * fy);
  const PhiPn_max = phi_col * Pn_max / 1000;   // kN
  html += createRow("Max Axial Capacity (φPn_max)", PhiPn_max.toFixed(1) + " kN",
                    PhiPn_max >= Pu ? "PASS" : "FAIL");

  // --- Confinement ---
  html += createDivider("CONFINEMENT DETAILING — ZONE 4 (ACI 318-14 §18.7.5)");
  html += createRow("Hoop/Spiral Type",    tie === "spiral" ? "Spiral" : "Rectangular Tie", "");
  html += createRow("Confine Hoop Spacing", `${dt}mm Ø @ ${so}mm o.c.`, "");

  html += `</div>`;

  const container = document.getElementById("col-results");
  container.innerHTML = html;
  container.style.display = "block";

  // Draw both canvases after DOM update
  setTimeout(() => {
    drawPMCurve("pmChart", pmPoints, Mc, Pu);
    drawColSection("colCanvas", shape, b, h, D, 40, nb, db);
  }, 80);
}

// ---------------------------------------------------------------------------
// PRIVATE HELPERS
// ---------------------------------------------------------------------------

/**
 * Generates P-M interaction diagram points using compatibility-based method.
 * Sweeps the neutral axis depth c from pure compression (c → ∞) to
 * pure tension (c → 0) to trace the full envelope.
 * Ref: ACI 318-14 §22.4
 *
 * @param {string} shape  - "rect" or "circ".
 * @param {number} b      - Width (mm) — rectangular.
 * @param {number} h      - Depth (mm) — rectangular.
 * @param {number} D      - Diameter (mm) — circular.
 * @param {number} fc     - Concrete compressive strength (MPa).
 * @param {number} fy     - Steel yield strength (MPa).
 * @param {number} nb     - Number of bars.
 * @param {number} db     - Bar diameter (mm).
 * @param {number} Ag     - Gross cross-sectional area (mm²).
 * @param {number} As_t   - Total steel area (mm²).
 * @returns {Array<{x: number, y: number}>} Array of φPn vs φMn points in kN, kNm.
 */
function _buildPMCurve(shape, b, h, D, fc, fy, nb, db, Ag, As_t) {
  const dim    = shape === "rect" ? h : D;
  const beta1  = getBeta1(fc);
  const d      = dim - 40 - 10 - db / 2;     // Approximate d
  const d_p    = 40 + 10 + db / 2;           // Approximate d'
  const As_face = As_t / 2;                  // Split top / bottom

  // Maximum axial capacity (upper bound clamp)
  const Pn_max = 0.80 * (0.85 * fc * (Ag - As_t) + As_t * fy);

  const points  = [];
  const N_STEPS = 60;

  for (let i = 0; i <= N_STEPS; i++) {
    // Sweep c from 3·dim → ~0 (pure tension)
    const t = i / N_STEPS;
    const c = dim * (3 * (1 - t) + 0.01 * t);
    if (c <= 0) continue;

    const a   = Math.min(beta1 * c, shape === "rect" ? h : D);
    const es_s = MAX_CONCRETE_STRAIN * (d - c) / c;
    const es_p = MAX_CONCRETE_STRAIN * (c - d_p) / c;
    const fs_s  = steelStress(es_s, fy);
    const fs_p  = steelStress(es_p, fy);

    let Cc, Mn_arm;
    if (shape === "rect") {
      Cc     = 0.85 * fc * a * b;
      Mn_arm = dim / 2 - a / 2;
    } else {
      // Circular: approximate Whitney block as fraction of circle area
      const alpha  = 2 * Math.acos(Math.max(-1, Math.min(1, 1 - (2 * a) / D)));
      const Ac     = (D * D / 8) * (alpha - Math.sin(alpha));
      Cc     = 0.85 * fc * Ac;
      Mn_arm = dim / 2 - (D * Math.sin(alpha / 2)) / (3 * (alpha - Math.sin(alpha)) / 2 + 1e-9) * 0.5;
    }

    const Cs   = As_face * (fs_p - 0.85 * fc);
    const Ts   = As_face * (-fs_s);

    let Pn = Cc + Cs + Ts;
    const Mn = Math.abs(
      Cc * Mn_arm +
      Cs * (dim / 2 - d_p) +
      Ts * (d - dim / 2)
    ) / 1e6;  // kNm

    // Clamp to max axial (ACI 318-14 §22.4.2.1)
    if (Pn > Pn_max) Pn = Pn_max;

    // φ factor based on strain
    const et  = MAX_CONCRETE_STRAIN * (d - c) / c;
    const phi = getPhiFlex(et);
    const clampedPhi = Pn > 0 ? Math.max(phi, PHI_COMP) : phi;

    points.push({ x: Math.abs(Mn * clampedPhi), y: (Pn * clampedPhi) / 1000 });
  }

  // Sort by moment for clean curve rendering
  return points.sort((a, b) => a.y - b.y);
}

/**
 * Checks if a demand point (Mu, Pu) lies inside the convex P-M envelope.
 * Uses a simple approach: the demand must be to the left/below the curve.
 *
 * @param {Array<{x: number, y: number}>} pts - Sorted P-M curve points.
 * @param {number} Mu - Design moment demand (kNm).
 * @param {number} Pu - Axial load demand (kN).
 * @returns {boolean} True if demand is inside (safe).
 */
function _isDemandInside(pts, Mu, Pu) {
  if (!pts.length) return false;
  // Find curve point with closest Pn to Pu, check if Mn_cap ≥ Mu
  let minDist = Infinity;
  let safe = false;
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i], p2 = pts[i + 1];
    if ((p1.y <= Pu && Pu <= p2.y) || (p2.y <= Pu && Pu <= p1.y)) {
      // Linear interpolation of x at Pu
      const frac  = (Pu - p1.y) / (p2.y - p1.y + 1e-9);
      const Mn_cap = p1.x + frac * (p2.x - p1.x);
      if (Math.abs(Pu - (p1.y + p2.y) / 2) < minDist) {
        minDist = Math.abs(Pu - (p1.y + p2.y) / 2);
        safe = Math.abs(Mu) <= Mn_cap;
      }
    }
  }
  return safe;
}