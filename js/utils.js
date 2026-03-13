/**
 * @file utils.js
 * @description Shared utility functions used across all calculation modules.
 *              Includes HTML result-row builder, tag generator, and safe input parsing.
 * @module utils
 */

"use strict";

// ---------------------------------------------------------------------------
// CONSTANTS — named so magic numbers never appear in logic files
// ---------------------------------------------------------------------------

/**
 * @constant {number} ES - Elastic modulus of steel (MPa), NSCP 2015 §406.2.
 */
const ES = 200000;

/**
 * @constant {number} PHI_FLEX - Flexure strength reduction factor (ACI 318-14 §21.2).
 */
const PHI_FLEX = 0.90;

/**
 * @constant {number} PHI_SHEAR - Shear strength reduction factor (ACI 318-14 §21.2).
 */
const PHI_SHEAR = 0.75;

/**
 * @constant {number} PHI_COMP - Compression-controlled strength reduction factor.
 */
const PHI_COMP = 0.65;

/**
 * @constant {number} STRAIN_TENSION - Tension-controlled strain limit (ACI 318-14 §21.2.2).
 */
const STRAIN_TENSION = 0.005;

/**
 * @constant {number} STRAIN_COMPRESSION - Compression-controlled strain limit.
 */
const STRAIN_COMPRESSION = 0.002;

/**
 * @constant {number} MAX_CONCRETE_STRAIN - Assumed ultimate concrete strain.
 */
const MAX_CONCRETE_STRAIN = 0.003;

// ---------------------------------------------------------------------------
// INPUT HELPERS
// ---------------------------------------------------------------------------

/**
 * Safely retrieves a numeric value from an input element by ID.
 * Returns NaN (and logs a warning) if the element is missing or value is blank.
 *
 * @param {string} id - The DOM element ID.
 * @returns {number} Parsed float or NaN.
 */
function getVal(id) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn(`[utils] Element #${id} not found.`);
    return NaN;
  }
  return parseFloat(el.value);
}

/**
 * Retrieves a string value from a select or input element.
 *
 * @param {string} id - The DOM element ID.
 * @returns {string} Trimmed string value.
 */
function getStr(id) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn(`[utils] Element #${id} not found.`);
    return "";
  }
  return el.value.trim();
}

// ---------------------------------------------------------------------------
// RESULT ROW BUILDER
// ---------------------------------------------------------------------------

/**
 * Status keywords mapped to CSS tag classes.
 * @type {Object.<string, string>}
 */
const TAG_MAP = {
  PASS:       "pass",
  SAFE:       "pass",
  DUCTILE:    "pass",
  SHORT:      "pass",
  YIELD:      "pass",
  IGNORE:     "pass",
  FAIL:       "fail",
  UNSAFE:     "fail",
  SLENDER:    "fail",
  TRANSITION: "fail",
  ELASTIC:    "fail",
  WARN:       "warn",
};

/**
 * Builds an HTML result row with an optional status tag.
 *
 * @param {string} label  - Left-side descriptive label.
 * @param {string} value  - Computed result string (e.g. "300.00 mm").
 * @param {string} [status] - Optional status keyword (e.g. "PASS", "FAIL").
 * @returns {string} HTML string for the result row.
 */
function createRow(label, value, status = "") {
  const tagClass = TAG_MAP[status] || "info";
  const tag = status
    ? `<span class="tag ${tagClass}">${status}</span>`
    : "";
  return `
    <div class="result-row">
      <span class="result-label">${label}</span>
      <span>${value} ${tag}</span>
    </div>`;
}

/**
 * Builds a styled section divider for grouping results.
 *
 * @param {string} title - Divider label text.
 * @returns {string} HTML string for the section divider.
 */
function createDivider(title) {
  return `<div class="section-divider">${title}</div>`;
}

// ---------------------------------------------------------------------------
// MATERIAL HELPERS
// ---------------------------------------------------------------------------

/**
 * Computes the Whitney stress block factor β₁ per ACI 318-14 §22.2.2.4.3.
 * β₁ = 0.85 for fc' ≤ 28 MPa, reduces 0.05 per 7 MPa above 28, min 0.65.
 *
 * @param {number} fc - Concrete compressive strength (MPa).
 * @returns {number} β₁ factor.
 */
function getBeta1(fc) {
  return fc <= 28 ? 0.85 : Math.max(0.65, 0.85 - (0.05 * (fc - 28)) / 7);
}

/**
 * Computes the φ (phi) flexural strength reduction factor based on net
 * tensile strain εt per ACI 318-14 §21.2.2.
 *
 * @param {number} et - Net tensile strain at extreme tension steel.
 * @returns {number} φ factor (0.65 – 0.90).
 */
function getPhiFlex(et) {
  if (et >= STRAIN_TENSION)     return PHI_FLEX;
  if (et <= STRAIN_COMPRESSION) return PHI_COMP;
  return PHI_COMP + (et - STRAIN_COMPRESSION) * (250 / 3);
}

/**
 * Computes steel stress, clamped between -fy and +fy (elastic perfectly-plastic).
 *
 * @param {number} strain - Steel strain.
 * @param {number} fy     - Yield strength (MPa).
 * @returns {number} Steel stress (MPa).
 */
function steelStress(strain, fy) {
  return Math.min(Math.max(strain * ES, -fy), fy);
}

/**
 * Computes the gross cross-sectional area of a bar in mm².
 *
 * @param {number} db - Bar diameter (mm).
 * @returns {number} Bar area (mm²).
 */
function barArea(db) {
  return Math.PI * Math.pow(db / 2, 2);
}