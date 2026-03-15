/**
 * @file beam.js
 * @description Beam design module — singly/doubly reinforced rectangular beams.
 *              References: NSCP 2015 Table 409.3.1.1, ACI 318-14 §21.2, §22.3, §22.5, §18
 * @module beam
 * @requires utils.js, canvas.js
 */
"use strict";

/** Support type → span/depth ratio denominator (NSCP 2015 Table 409.3.1.1) */
const BEAM_DENOM = { 1: 16, 2: 18.5, 3: 21, 4: 8 };

// =============================================================================
// PUBLIC API
// =============================================================================

function calculateBeam() {
  clearAllErrors("beam");

  const fields = [
    { id:"b_b",  label:"Width b",       min:100 },
    { id:"b_h",  label:"Depth h",       min:150 },
    { id:"b_cc", label:"Cover",         min:20  },
    { id:"b_fc", label:"fc'",           min:17  },
    { id:"b_fy", label:"fy",            min:230 },
    { id:"b_fyt",label:"fyt",           min:230 },
    { id:"b_n",  label:"Bars (N)",      min:2   },
    { id:"b_db", label:"Bar Ø",         min:10  },
    { id:"b_ds", label:"Stirrup Ø",     min:8   },
    { id:"b_Mu", label:"Mu",            min:0   },
    { id:"b_Vu", label:"Vu",            min:0   },
    { id:"b_L",  label:"Span",          min:0.5 },
  ];
  if (!validateFields(fields)) return;

  const b        = getVal("b_b");
  const h        = getVal("b_h");
  const cc       = getVal("b_cc");
  const exposure = getStr("b_exposure") || "weather";
  const fc       = getVal("b_fc");
  const fy       = getVal("b_fy");
  const fyt      = getVal("b_fyt");
  const L        = getVal("b_L");
  const supp     = parseInt(getStr("b_supp"));
  const db       = getVal("b_db");
  const n        = getVal("b_n");
  const ds       = getVal("b_ds");
  const Mu       = getVal("b_Mu");
  const Vu       = getVal("b_Vu");
  const Tu       = getVal("b_Tu") || 0;
  const layers   = parseInt(getStr("b_layers"));
  const isDoubly = getStr("b_type") === "doubly";
  const isZone4  = (getStr("b_seismic") || "zone4") === "zone4";

  let np = 0, dbp = 0, dp = 0;
  if (isDoubly) {
    if (!validateFields([
      { id:"b_np",  label:"Comp. bars",   min:2  },
      { id:"b_dbp", label:"Comp. bar Ø",  min:10 },
      { id:"b_dp",  label:"d'",           min:40 },
    ])) return;
    np = getVal("b_np"); dbp = getVal("b_dbp"); dp = getVal("b_dp");
  }

  // --- PHYSICAL REALITY GUARDRAILS (Rebar Congestion) ---
  const availWidth = b - 2 * cc - 2 * ds;
  
  // Tension layer check
  const barsPerLayer = layers === 1 ? n : Math.ceil(n / 2);
  if (barsPerLayer > 1) {
    const clearSpacing = (availWidth - (barsPerLayer * db)) / (barsPerLayer - 1);
    const minSpacing = Math.max(25, db); // NSCP/ACI minimum clear spacing
    
    if (clearSpacing < minSpacing) {
      showError("b_b", `Congestion: Spacing (${clearSpacing.toFixed(1)}mm) < min (${minSpacing}mm)`);
      showError("b_n", "Reduce bars, add layers, or widen beam");
      return; // HARD STOP
    }
  } else if (availWidth < db) {
    showError("b_b", "Beam too narrow to fit rebar inside stirrups.");
    return; // HARD STOP
  }

  // Compression layer check (if doubly reinforced)
  if (isDoubly && np > 1) {
    const compSpacing = (availWidth - (np * dbp)) / (np - 1);
    const minCompSpacing = Math.max(25, dbp);
    
    if (compSpacing < minCompSpacing) {
      showError("b_b", `Top Congestion: Spacing (${compSpacing.toFixed(1)}mm) < min (${minCompSpacing}mm)`);
      showError("b_np", "Reduce comp. bars or widen beam");
      return; // HARD STOP
    }
  }

  // --- Effective depth (NSCP 2015 §406.3) ---
  const centroidShift = layers === 2 ? (db + 25) / 2 : 0;
  const d = h - cc - ds - db / 2 - centroidShift;

  const As    = n  * barArea(db);
  const Asp   = isDoubly ? np * barArea(dbp) : 0;
  const beta1 = getBeta1(fc);

  // --- Minimum steel area (ACI 318-14 §9.6.1.2 / NSCP 2015 §409.6.1.2) ---
  // As_min = max( (0.25*sqrt(fc')/fy)*bw*d,  (1.4/fy)*bw*d )
  const As_min    = Math.max(
    (0.25 * Math.sqrt(fc) / fy) * b * d,
    (1.4  / fy)                 * b * d
  );
  const As_min_ok = As >= As_min;

  // --- Cover adequacy (NSCP 2015 Table 406.3.2.1 / ACI 318-14 Table 20.6.1.3.1) ---
  const cc_min    = getMinCover(exposure, db);
  const cc_ok     = cc >= cc_min;

  // --- Serviceability: min thickness (NSCP 2015 Table 409.3.1.1) ---
  const denom  = BEAM_DENOM[supp] || 16;
  const mod    = 0.4 + fy / 700;
  const h_min  = (L * 1000 / denom) * mod;

  // --- Flexural strength ---
  const flex = isDoubly
    ? _doublyFlex(As, Asp, b, d, dp, fc, fy, beta1)
    : _singlyFlex(As, b, d, fc, fy, beta1);
  const { Mn, et, c } = flex;
  const phi   = getPhiFlex(et);
  const PhiMn = phi * Mn;

  // --- Shear ---
  const shear = _shearDesign(b, d, fc, fyt, Vu, ds);

  // --- Torsion threshold (ACI 318-14 §22.7.4) ---
  let torsionHTML = "";
  if (Tu > 0) {
    const Acp = b * h;
    const Pcp = 2 * (b + h);
    const Tth = (0.75 * 0.083 * Math.sqrt(fc) * Acp * Acp) / (Pcp * 1e6);
    
    if (Tu > Tth) {
      showError("b_Tu", `Tu exceeds threshold (${Tth.toFixed(2)} kNm).`);
      showError("b_Tu", "Combined Shear-Torsion design is not currently supported.");
      return; // HARD STOP
    }
    
    torsionHTML = createDivider("TORSION (ACI 318-14 §22.7)")
      + createRow("Torsion Threshold (T<sub>th</sub>)", Tth.toFixed(2) + " kNm", "IGNORE");
  }

  // --- Seismic hoop spacing (ACI 318-14 §18.4.2.4) ---
  const s_hoop = Math.floor(Math.min(d / 4, 8 * db, 24 * ds, 300));

  // --- Rebar schedule (F4) ---
  const rebarBars = [
    { mark:"T1", count:n,  dia:db,  length:`${(L*1000).toFixed(0)}mm`, location:"Tension (Bottom)" },
  ];
  if (isDoubly) rebarBars.push({ mark:"C1", count:np, dia:dbp, length:`${(L*1000).toFixed(0)}mm`, location:"Compression (Top)" });
  rebarBars.push({ mark:"V1", count:2, dia:ds, length:"Per spacing", location:`Stirrups @ ${shear.spacing}` });

  // --- Build Modern HTML ---
  let html = `
    <div class="modern-result-header">
      <div class="modern-result-header-content">
        <div class="modern-result-title">
          <div class="modern-result-main-title">Beam Analysis</div>
          <div class="modern-result-subtitle">${isDoubly ? "Doubly" : "Singly"} Reinforced</div>
        </div>
      </div>
      <button class="btn-print-modern" onclick="window.print()" title="Print / Save as PDF">
        <span class="print-icon">⎙</span>
        <span class="print-text">Print</span>
      </button>
    </div>
    <div class="modern-result-body">`;

  // Section Preview Chart Card
  html += `
    <div class="modern-chart-card">
      <div class="modern-chart-header">
        <span class="chart-header-title">Section Preview</span>
      </div>
      <div class="modern-chart-content">
        <canvas id="beamCanvas" width="260" height="210"></canvas>
      </div>
    </div>`;

  // Geometry Section
  html += `<div class="modern-section">
    <div class="modern-section-divider">
      <span class="section-divider-title">Geometry</span>
      <span class="section-divider-code">ACI 318-14 §9.6.1.2 / NSCP §409.6.1.2</span>
    </div>
    <div class="modern-results-grid">`;
  html += createRow("Effective Depth (d)",                    d.toFixed(1)      + " mm",  "");
  html += createRow("Clear Cover Provided",                   cc.toFixed(0)     + " mm",  "");
  html += createRow("Min Cover Required (exposure)",          cc_min.toFixed(0) + " mm",  cc_ok ? "PASS" : "FAIL");
  html += createRow("Tension Steel (A<sub>s</sub>)",          As.toFixed(0)     + " mm²", "");
  html += createRow("A<sub>s,min</sub> Required",             As_min.toFixed(0) + " mm²", "");
  html += createRow("A<sub>s</sub> vs A<sub>s,min</sub>",     As.toFixed(0)     + " mm²", As_min_ok ? "PASS" : "FAIL");
  if (isDoubly) {
    html += createRow("Comp. Steel (A<sub>s</sub>')",    Asp.toFixed(0) + " mm²",  "");
    html += createRow("Comp. Steel Stress",   flex.fspText,              "");
  }
  html += `</div></div>`;

  // Serviceability Section
  html += `<div class="modern-section">
    <div class="modern-section-divider">
      <span class="section-divider-title">Serviceability — Min Thickness</span>
      <span class="section-divider-code">NSCP 2015 Table 409.3.1.1</span>
    </div>
    <div class="modern-results-grid">`;
  html += createRow("h<sub>min</sub> Required",  h_min.toFixed(0) + " mm", h >= h_min ? "PASS" : "FAIL");
  html += createRow("h Provided",      h.toFixed(0)     + " mm", "");
  html += `</div></div>`;

  // Flexural Strength Section
  html += `<div class="modern-section">
    <div class="modern-section-divider">
      <span class="section-divider-title">Flexural Strength</span>
      <span class="section-divider-code">ACI 318-14 §22.3</span>
    </div>
    <div class="modern-results-grid">`;
  html += createRow("Neutral Axis (c)",     c.toFixed(1)   + " mm",  "");
  html += createRow("Net Tensile Strain",   et.toFixed(5),            et >= 0.005 ? "DUCTILE" : "TRANSITION");
  if (isDoubly) {
    html += createRow(
      "ε<sub>s</sub> tension vs ε<sub>y</sub>",
      flex.tensText,
      flex.tensYield ? "YIELD" : "WARN"
    );
    html += createRow("Comp. Steel Strain",   flex.fspText,   "");
  }
  html += createRow("Strength Factor (φ)",  phi.toFixed(3),           "");
  html += createProgressBar("φM<sub>n</sub> vs M<sub>u</sub>",    Mu, PhiMn,    "kNm");
  html += createRow("φM<sub>n</sub> Capacity",         PhiMn.toFixed(2) + " kNm", PhiMn >= Mu ? "SAFE" : "UNSAFE");
  html += `</div></div>`;

  // Shear Design Section
  html += `<div class="modern-section">
    <div class="modern-section-divider">
      <span class="section-divider-title">Shear Design</span>
      <span class="section-divider-code">ACI 318-14 §22.5</span>
    </div>
    <div class="modern-results-grid">`;
  html += createProgressBar("V<sub>u</sub> vs φV<sub>c</sub>",    Vu,  shear.PhiVc, "kN");
  html += createRow("φV<sub>c</sub> Capacity",         shear.PhiVc.toFixed(2) + " kN", "");
  html += createRow("Stirrup Design",       shear.summary, shear.pass ? "PASS" : "FAIL");
  html += `</div></div>`;

  // Seismic / Detailing Section
  html += `<div class="modern-section">
    <div class="modern-section-divider">
      <span class="section-divider-title">${isZone4 ? "Seismic Detailing — Zone 4" : "Detailing — Standard"}</span>
      <span class="section-divider-code">${isZone4 ? "ACI 318-14 §18.4.2" : "ACI 318-14 §9.7.6"}</span>
    </div>
    <div class="modern-results-grid">`;
  if (isZone4) {
    html += createRow("Confinement Hoop Spacing", `${ds}mm Ø @ ${s_hoop}mm o.c.`, "");
    html += createRow("Hoop Limit",               `min(d/4, 8d<sub>b</sub>, 24d<sub>s</sub>, 300mm)`, "");
  } else {
    const s_std_beam = Math.floor(Math.min(d / 2, 600));
    html += createRow("Standard Max Stirrup Spacing", `${ds}mm Ø @ ${s_std_beam}mm o.c.`, "");
    html += createRow("Note", "Special seismic detailing not required", "");
  }
  html += `</div></div>`;

  // Torsion Section (if applicable)
  if (torsionHTML) {
    html += torsionHTML;
  }

  // Rebar Schedule Section
  html += `<div class="modern-section">
    <div class="modern-section-divider">
      <span class="section-divider-title">Rebar Schedule</span>
    </div>`;
  html += createRebarSchedule(rebarBars);
  html += `</div>`;

  html += `</div>`;

  renderResults("beam-results", html, () => {
    drawBeamSection("beamCanvas", b, h, cc, n, isDoubly ? np : 0, db, ds, layers);
  });
}

// =============================================================================
// PRIVATE — Singly Reinforced Flexure
// ACI 318-14 §22.3 — Whitney rectangular stress block
// =============================================================================
function _singlyFlex(As, b, d, fc, fy, beta1) {
  const a  = (As * fy) / (0.85 * fc * b);
  const c  = a / beta1;
  const Mn = (As * fy * (d - a / 2)) / 1e6;
  const et = MAX_CONCRETE_STRAIN * (d - c) / c;
  return { Mn, et, c, fspText: "N/A" };
}

// =============================================================================
// PRIVATE — Doubly Reinforced Flexure
// ACI 318-14 §22.3 + §22.2 — iterative Newton equilibrium
// Tolerance: 0.1 N on ΣF = 0
// =============================================================================
function _doublyFlex(As, Asp, b, d, dp, fc, fy, beta1) {
  let c = d / 3;
  for (let i = 0; i < 300; i++) {
    const esp = MAX_CONCRETE_STRAIN * (c - dp) / c;
    const fsp = steelStress(esp, fy);
    const Cc  = 0.85 * fc * beta1 * c * b;
    const Cs  = Asp * (fsp - 0.85 * fc);
    const T   = As * fy;
    const res = Cc + Cs - T;
    if (Math.abs(res) < 0.1) break;
    c -= res / (0.85 * fc * beta1 * b);
    if (c <= 0) { c = 1; break; }
  }
  const esp     = MAX_CONCRETE_STRAIN * (c - dp) / c;
  const fsp     = steelStress(esp, fy);
  const Cc      = 0.85 * fc * beta1 * c * b;
  const Cs      = Asp * (fsp - 0.85 * fc);
  const Mn      = (Cc * (d - (beta1 * c) / 2) + Cs * (d - dp)) / 1e6;
  const et      = MAX_CONCRETE_STRAIN * (d - c) / c;
  const fspText = `${fsp.toFixed(1)} MPa — ${Math.abs(fsp) >= fy ? "YIELD" : "ELASTIC"}`;

  // --- Tension steel yield verification (ACI 318-14 §22.3) ---
  // Assumption T = As·fy is valid only if εs_tension ≥ εy = fy/Es
  const ey         = fy / ES;
  const es_tens    = MAX_CONCRETE_STRAIN * (d - c) / c;  // same as et
  const tensYield  = es_tens >= ey;
  const tensText   = tensYield
    ? `${es_tens.toFixed(5)} — YIELD`
    : `${es_tens.toFixed(5)} — ELASTIC (εy=${ey.toFixed(5)})`;

  return { Mn, et, c, fspText, tensYield, tensText };
}

// =============================================================================
// PRIVATE — Shear Design (ACI 318-14 §22.5)
// =============================================================================
function _shearDesign(b, d, fc, fyt, Vu, ds) {
  const Vc    = (0.17 * Math.sqrt(fc) * b * d) / 1000;
  const PhiVc = PHI_SHEAR * Vc;
  const Av    = 2 * barArea(ds);
  let summary = "", pass = true, spacing = "N/A";

  if (Vu <= 0.5 * PhiVc) {
    summary = "Vu ≤ 0.5φVc — No stirrups required";
  } else if (Vu <= PhiVc) {
    const s = Math.floor(d / 2);
    spacing = `${s}mm`;
    summary = `Min stirrups — Use ${ds}mm Ø @ ${s}mm`;
  } else {
    const Vs_req  = Vu / PHI_SHEAR - Vc;
    const Vc_lim  = (0.66 * Math.sqrt(fc) * b * d) / 1000;
    if (Vs_req > Vc_lim) {
      summary = "Section too small — increase beam dimensions"; pass = false;
    } else {
      const s_calc  = (Av * fyt * d) / (Vs_req * 1000);
      const Vs_lim2 = (0.33 * Math.sqrt(fc) * b * d) / 1000;
      // ACI 318-14 §9.7.6.2.2:
      //   Vs > 0.33√fc'·bw·d  →  s_max = min(d/4, 300mm)
      //   Vs ≤ 0.33√fc'·bw·d  →  s_max = min(d/2, 600mm)
      const s_max = Vs_req > Vs_lim2
        ? Math.min(d / 4, 300)
        : Math.min(d / 2, 600);
      const s_final = Math.floor(Math.min(s_calc, s_max));
      spacing = `${s_final}mm`;
      summary = `Use ${ds}mm Ø stirrups @ ${s_final}mm o.c.`;
    }
  }
  return { PhiVc, summary, pass, spacing };
}