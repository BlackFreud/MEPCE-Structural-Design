/**
 * @file config.js
 * @description Central configuration file for project identity, unit system,
 *              and material presets.
 * @module config
 */

// =============================================================================
// PROJECT DETAILS
// =============================================================================

/**
 * @constant {Object} PROJECT_DETAILS
 * @property {string} project - Project name shown in header
 * @property {string} name    - Engineer / student name
 * @property {string} subject - Course or subject code
 */
const PROJECT_DETAILS = {
  project: "FINAL PROPOSAL",
  name:    "STRUCTURAL ENGINEER",
  subject: "MEPCE 225",
};

// =============================================================================
// UNIT SYSTEM CONFIGURATION
// =============================================================================

/**
 * Current unit system — toggleable via UI
 * @type {string} "metric" | "english"
 */
let CURRENT_UNIT_SYSTEM = "metric";

/**
 * Unit conversion factors
 * @constant {Object}
 */
const UNIT_CONVERSIONS = {
  // Length conversions
  mm_to_in:   1 / 25.4,        // millimeters → inches
  m_to_ft:    3.28084,         // meters → feet
  
  // Stress conversions
  MPa_to_ksi: 0.145038,        // megapascals → ksi
  
  // Force conversions
  kN_to_kip:  0.224809,        // kilonewtons → kips
  
  // Moment conversions
  kNm_to_kipft: 0.737562,      // kN·m → kip·ft
  
  // Pressure conversions
  kPa_to_psf: 20.8854,         // kilopascals → psf
};

/**
 * Unit labels for each measurement type
 * @constant {Object}
 */
const UNIT_LABELS = {
  metric: {
    length_mm:  "(mm)",
    length_m:   "(m)",
    stress:     "(MPa)",
    force:      "(kN)",
    moment:     "(kNm)",
    pressure:   "(kPa)",
  },
  english: {
    length_mm:  "(in)",
    length_m:   "(ft)",
    stress:     "(ksi)",
    force:      "(kip)",
    moment:     "(kip-ft)",
    pressure:   "(psf)",
  },
};

// =============================================================================
// MATERIAL PRESETS — PHILIPPINE STANDARDS
// =============================================================================

/**
 * Standard concrete strength presets (Philippine practice)
 * @constant {Object}
 */
const CONCRETE_PRESETS = {
  21: "21 MPa (Standard)",
  28: "28 MPa (Common)",
  35: "35 MPa (High-Strength)",
};

/**
 * Standard rebar grade presets (Philippine practice)
 * Values in MPa
 * @constant {Object}
 */
const REBAR_PRESETS = {
  230: "Grade 33 (230 MPa)",
  275: "Grade 40 (275 MPa)",
  414: "Grade 60 (414 MPa)",
  415: "Grade 60 (415 MPa)",  // Alternative value for column default
};

/**
 * Preset descriptions for UI display
 * @constant {Object}
 */
const PRESET_INFO = {
  concrete: {
    title: "Concrete Strength",
    subtitle: "Philippine Standards",
  },
  rebar: {
    title: "Rebar Grade",
    subtitle: "Philippine Standards",
  },
};