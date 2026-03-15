/**
 * @file utils.js
 * @description Shared utility functions used across all calculation modules.
 * @module utils
 */
"use strict";

const ES = 200000;
const PHI_FLEX = 0.90;
const PHI_SHEAR = 0.75;
const PHI_COMP = 0.65;
const STRAIN_TENSION = 0.005;
const STRAIN_COMPRESSION = 0.002;
const MAX_CONCRETE_STRAIN = 0.003;
const GAMMA_CONCRETE = 24;

function getVal(id) {
  const el = document.getElementById(id);
  if (!el) { console.warn(`[utils] #${id} not found`); return NaN; }
  return parseFloat(el.value);
}
function getStr(id) {
  const el = document.getElementById(id);
  if (!el) { console.warn(`[utils] #${id} not found`); return ""; }
  return el.value.trim();
}

// F2 — Inline validation
function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add("input-error");
  let errEl = el.parentElement.querySelector(".field-error");
  if (!errEl) { errEl = document.createElement("span"); errEl.className = "field-error"; el.parentElement.appendChild(errEl); }
  errEl.textContent = msg;
}
function clearError(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("input-error");
  const e = el.parentElement?.querySelector(".field-error");
  if (e) e.textContent = "";
}
function clearAllErrors(parentId) {
  const p = document.getElementById(parentId);
  if (!p) return;
  p.querySelectorAll(".input-error").forEach(e => e.classList.remove("input-error"));
  p.querySelectorAll(".field-error").forEach(e => e.textContent = "");
}
function validateFields(fields) {
  let valid = true;
  fields.forEach(({ id, label, min }) => {
    const val = getVal(id);
    if (isNaN(val)) { showError(id, `${label} is required`); valid = false; }
    else if (min !== undefined && val < min) { showError(id, `Must be ≥ ${min}`); valid = false; }
    else clearError(id);
  });
  return valid;
}

// Result row builder
const TAG_MAP = {
  PASS:"pass",SAFE:"pass",DUCTILE:"pass",SHORT:"pass",YIELD:"pass",IGNORE:"pass",OK:"pass",
  FAIL:"fail",UNSAFE:"fail",SLENDER:"fail",
  TRANSITION:"warn",ELASTIC:"warn",WARN:"warn",
};
function createRow(label, value, status = "") {
  const tagClass = TAG_MAP[status] || "info";
  const tag = status ? `<span class="tag ${tagClass}">${status}</span>` : "";
  return `<div class="result-row"><span class="result-label">${label}</span><span class="result-value">${value} ${tag}</span></div>`;
}
function createDivider(title) {
  return `<div class="section-divider">${title}</div>`;
}

// F3 — Capacity progress bar
function createProgressBar(label, demand, capacity, unit) {
  const ratio  = demand / capacity;
  const pct    = (ratio * 100).toFixed(1);
  const barPct = Math.min(ratio * 100, 100);
  const color  = ratio > 1 ? "var(--danger)" : ratio > 0.85 ? "var(--warning)" : "var(--success)";
  return `<div class="result-row progress-row">
    <span class="result-label">${label}</span>
    <div class="progress-wrap">
      <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${barPct}%;background:${color}"></div></div>
      <span class="progress-label ${ratio > 1 ? "over" : ""}">${demand.toFixed(2)} / ${capacity.toFixed(2)} ${unit} (${pct}%)</span>
    </div>
  </div>`;
}

// F4 — Rebar schedule table
function createRebarSchedule(bars) {
  const rows = bars.map(b => `<tr><td>${b.mark}</td><td>${b.count}</td><td>${b.dia}mm Ø</td><td>${b.length || "—"}</td><td>${b.location}</td></tr>`).join("");
  return `<div class="table-wrapper"><table class="rebar-table">
    <thead><tr><th>Mark</th><th>Count</th><th>Size</th><th>Length</th><th>Location</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

// R3+R4 — Inject HTML then fire callback after browser paint
function renderResults(containerId, html, afterPaint) {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = html;
  c.style.display = "block";
  if (typeof afterPaint === "function") {
    requestAnimationFrame(() => requestAnimationFrame(afterPaint));
  }
}

// Material helpers
function getBeta1(fc) {
  return fc <= 28 ? 0.85 : Math.max(0.65, 0.85 - (0.05 * (fc - 28)) / 7);
}
function getPhiFlex(et) {
  if (et >= STRAIN_TENSION)     return PHI_FLEX;
  if (et <= STRAIN_COMPRESSION) return PHI_COMP;
  return PHI_COMP + (et - STRAIN_COMPRESSION) * (250 / 3);
}
function steelStress(strain, fy) {
  return Math.min(Math.max(strain * ES, -fy), fy);
}
function barArea(db) {
  return Math.PI * Math.pow(db / 2, 2);
}

/**
 * Minimum clear cover by exposure — NSCP 2015 Table 406.3.2.1 / ACI 318-14 Table 20.6.1.3.1
 * @param {string} exposure - "interior" | "weather" | "soil"
 * @param {number} db       - Bar diameter (mm)
 * @returns {number} Minimum cover (mm)
 */
function getMinCover(exposure, db) {
  if (exposure === "soil")    return 75;
  if (exposure === "weather") return db > 20 ? 50 : 40;
  return 20;  // interior — not exposed
}

// =============================================================================
// UNIT CONVERSION FUNCTIONS
// =============================================================================

/**
 * Convert length values between metric and english
 * @param {number} value - Input value
 * @param {boolean} toEnglish - true = metric→english, false = english→metric
 * @param {string} type - "mm" or "m"
 * @returns {number} Converted value
 */
function convertLength(value, toEnglish, type = "mm") {
  if (type === "mm") {
    return toEnglish ? value * UNIT_CONVERSIONS.mm_to_in : value / UNIT_CONVERSIONS.mm_to_in;
  } else {
    return toEnglish ? value * UNIT_CONVERSIONS.m_to_ft : value / UNIT_CONVERSIONS.m_to_ft;
  }
}

function convertStress(value, toEnglish) {
  return toEnglish ? value * UNIT_CONVERSIONS.MPa_to_ksi : value / UNIT_CONVERSIONS.MPa_to_ksi;
}

function convertForce(value, toEnglish) {
  return toEnglish ? value * UNIT_CONVERSIONS.kN_to_kip : value / UNIT_CONVERSIONS.kN_to_kip;
}

function convertMoment(value, toEnglish) {
  return toEnglish ? value * UNIT_CONVERSIONS.kNm_to_kipft : value / UNIT_CONVERSIONS.kNm_to_kipft;
}

function convertPressure(value, toEnglish) {
  return toEnglish ? value * UNIT_CONVERSIONS.kPa_to_psf : value / UNIT_CONVERSIONS.kPa_to_psf;
}
// =============================================================================
// DOM UPDATE FUNCTIONS
// =============================================================================

/**
 * Update all unit labels in the DOM based on current unit system
 * @param {string} system - "metric" or "english"
 */
function updateUnitLabels(system) {
  document.querySelectorAll('[data-unit-type]').forEach(el => {
    const unitType = el.getAttribute('data-unit-type');
    if (UNIT_LABELS[system] && UNIT_LABELS[system][unitType]) {
      el.textContent = UNIT_LABELS[system][unitType];
    }
  });
}

/**
 * Convert all input values when unit system changes
 * @param {string} toSystem - "metric" or "english"
 */
function convertAllInputs(toSystem) {
  // No-op guard — prevents double-conversion if system hasn't changed
  if (toSystem === CURRENT_UNIT_SYSTEM) return;
  CURRENT_UNIT_SYSTEM = toSystem;

  const toEnglish = toSystem === "english";
  
  // Mapping of input IDs to their conversion types
  const inputConversions = {
    // Beam inputs
    b_b:   { type: 'length', unit: 'mm' },
    b_h:   { type: 'length', unit: 'mm' },
    b_cc:  { type: 'length', unit: 'mm' },
    b_fc:  { type: 'stress' },
    b_fy:  { type: 'stress' },
    b_fyt: { type: 'stress' },
    b_db:  { type: 'length', unit: 'mm' },
    b_ds:  { type: 'length', unit: 'mm' },
    b_dbp: { type: 'length', unit: 'mm' },
    b_dp:  { type: 'length', unit: 'mm' },
    b_Mu:  { type: 'moment' },
    b_Vu:  { type: 'force' },
    b_Tu:  { type: 'moment' },
    b_L:   { type: 'length', unit: 'm' },
    
    // Column inputs
    c_b:   { type: 'length', unit: 'mm' },
    c_h:   { type: 'length', unit: 'mm' },
    c_D:   { type: 'length', unit: 'mm' },
    c_cc:  { type: 'length', unit: 'mm' },
    c_fc:  { type: 'stress' },
    c_fy:  { type: 'stress' },
    c_db:  { type: 'length', unit: 'mm' },
    c_dt:  { type: 'length', unit: 'mm' },
    c_Pu:  { type: 'force' },
    c_M2:  { type: 'moment' },
    c_Lu:  { type: 'length', unit: 'm' },
    
    // Slab inputs
    s_fc:    { type: 'stress' },
    s_fy:    { type: 'stress' },
    s_h:     { type: 'length', unit: 'mm' },
    s_db:    { type: 'length', unit: 'mm' },
    s_DL:    { type: 'pressure' },
    s_LL:    { type: 'pressure' },
    s_L:     { type: 'length', unit: 'm' },
    s_Lx:    { type: 'length', unit: 'm' },
    s_Ly:    { type: 'length', unit: 'm' },
    s_col_w: { type: 'length', unit: 'mm' },
  };
  
  // Convert each input
  Object.keys(inputConversions).forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    
    const currentValue = parseFloat(el.value);
    if (isNaN(currentValue)) return;
    
    const { type, unit } = inputConversions[id];
    let convertedValue;
    
    switch(type) {
      case 'length':
        convertedValue = convertLength(currentValue, toEnglish, unit);
        break;
      case 'stress':
        convertedValue = convertStress(currentValue, toEnglish);
        break;
      case 'force':
        convertedValue = convertForce(currentValue, toEnglish);
        break;
      case 'moment':
        convertedValue = convertMoment(currentValue, toEnglish);
        break;
      case 'pressure':
        convertedValue = convertPressure(currentValue, toEnglish);
        break;
      default:
        return;
    }
    
    // Update input with converted value (round to reasonable precision)
    el.value = convertedValue.toFixed(getPrecision(type, unit));
  });
}

/**
 * Get appropriate decimal precision for a given measurement type
 * @param {string} type - Measurement type
 * @param {string} unit - Unit (mm or m)
 * @returns {number} Number of decimal places
 */
function getPrecision(type, unit) {
  switch(type) {
    case 'length':
      return unit === 'mm' ? 1 : 2;  // mm: 1 decimal, m/ft: 2 decimals
    case 'stress':
      return 2;  // MPa/ksi: 2 decimals
    case 'force':
      return 1;  // kN/kip: 1 decimal
    case 'moment':
      return 2;  // kNm/kip-ft: 2 decimals
    case 'pressure':
      return 2;  // kPa/psf: 2 decimals
    default:
      return 2;
  }
}