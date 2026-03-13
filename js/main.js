/**
 * @file main.js
 * @description App bootstrap, tab navigation, UI toggles, and module resets (F5).
 * @module main
 * @requires config.js
 */
"use strict";

// =============================================================================
// INIT
// =============================================================================

document.addEventListener("DOMContentLoaded", () => {
  _setHeader("display-project", PROJECT_DETAILS.project);
  _setHeader("display-name",    PROJECT_DETAILS.name);
  _setHeader("display-subject", PROJECT_DETAILS.subject);

  // 1. Load persisted data before initializing UI
  loadState();

  toggleBeamType();
  toggleColInputs();
  toggleSlabInputs();

  // 2. Global listener: Auto-save and clear stale results on input change
  document.querySelectorAll('.form-input, .form-select').forEach(input => {
    input.addEventListener('input', () => {
      saveState(); // Auto-save to LocalStorage
      document.querySelectorAll('.results-card').forEach(card => {
        card.style.display = 'none';
      });
    });
  });
});

function _setHeader(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text || "—";
}

// =============================================================================
// SIDEBAR NAVIGATION
// =============================================================================

/**
 * Toggle sidebar collapsed state
 */
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (sidebar) {
    sidebar.classList.toggle("collapsed");
  }
}

/**
 * Switches the active module and updates navigation state
 * @param {string} moduleId - Target module section ID ("beam", "column", "slab")
 * @param {Event}  event    - Click event from nav button
 */
function switchModule(moduleId, event) {
  // Remove active class from all modules and nav items
  document.querySelectorAll(".module").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));
  
  // Add active class to selected module and nav item
  const section = document.getElementById(moduleId);
  if (section) section.classList.add("active");
  if (event?.currentTarget) event.currentTarget.classList.add("active");
  
  // Update page title
  const titles = {
    beam: "Beam Design",
    column: "Column Design",
    slab: "Slab Design"
  };
  const titleEl = document.getElementById("page-title");
  if (titleEl && titles[moduleId]) {
    titleEl.textContent = titles[moduleId];
  }
}

// =============================================================================
// UI TOGGLES
// =============================================================================

/** Show/hide compression steel inputs for doubly-reinforced beam. */
function toggleBeamType() {
  const type  = document.getElementById("b_type")?.value;
  const group = document.getElementById("beam-comp-group");
  if (group) group.style.display = type === "doubly" ? "block" : "none";
}

/** Show/hide rect vs circular column dimension inputs. */
function toggleColInputs() {
  const isRect = document.getElementById("c_shape")?.value === "rect";
  _show("c_b_grp",  isRect);
  _show("c_h_grp",  isRect);
  _show("c_D_grp",  !isRect);
}

/** Show/hide one-way vs two-way slab input sections. */
function toggleSlabInputs() {
  const mode = document.getElementById("s_mode")?.value;
  _show("slab-oneway", mode === "1");
  _show("slab-twoway", mode === "2");
}

function _show(id, visible) {
  const el = document.getElementById(id);
  if (el) el.style.display = visible ? "flex" : "none";
}

// =============================================================================
// UNIT SYSTEM TOGGLE
// =============================================================================

/**
 * Toggle between metric and english unit systems
 * Updates labels, converts all input values, and updates UI state
 */
/* 
function toggleUnits() {
  const toggle = document.getElementById("unit-toggle");
  const metricLabel = document.getElementById("label-metric");
  const englishLabel = document.getElementById("label-english");
  
  if (!toggle) return;
  
  // Determine new system (toggle state)
  const isCurrentlyMetric = !toggle.classList.contains("active");
  const newSystem = isCurrentlyMetric ? "english" : "metric";
  
  // Update toggle UI
  toggle.classList.toggle("active");
  
  // Update label states
  if (metricLabel) metricLabel.classList.toggle("active", newSystem === "metric");
  if (englishLabel) englishLabel.classList.toggle("active", newSystem === "english");
  
  // Update global state
  CURRENT_UNIT_SYSTEM = newSystem;
  
  // Update all unit labels in DOM
  updateUnitLabels(newSystem);
  
  // Convert all input values
  convertAllInputs(newSystem);

  // CRITICAL FIX: Purge and hide all result cards to prevent stale data reading
  document.querySelectorAll('.results-card').forEach(card => {
    card.style.display = 'none';
    card.innerHTML = ''; 
  });
}

*/
// =============================================================================
// MATERIAL PRESETS
// =============================================================================

/**
 * Apply concrete strength preset to a module
 * @param {string} module - Module name ("beam", "column", "slab")
 */
function applyConcretePreset(module) {
  const selectId = `concrete-preset-${module}`;
  const select = document.getElementById(selectId);
  
  if (!select || !select.value) return;
  
  const value = select.value;
  
  // Map module to fc' input ID
  const fcIds = {
    beam: "b_fc",
    column: "c_fc",
    slab: "s_fc"
  };
  
  const fcInput = document.getElementById(fcIds[module]);
  if (fcInput) {
    fcInput.value = value;
    
    // Clear any validation errors on this field
    clearError(fcIds[module]);
  }
}

/**
 * Apply rebar grade preset to a module
 * @param {string} module - Module name ("beam", "column", "slab")
 */
function applyRebarPreset(module) {
  const selectId = `rebar-preset-${module}`;
  const select = document.getElementById(selectId);
  
  if (!select || !select.value) return;
  
  const value = select.value;
  
  // Map module to fy input ID
  const fyIds = {
    beam: "b_fy",
    column: "c_fy",
    slab: "s_fy"
  };
  
  const fyInput = document.getElementById(fyIds[module]);
  if (fyInput) {
    fyInput.value = value;
    
    // Clear any validation errors on this field
    clearError(fyIds[module]);
  }
}

// =============================================================================
// MODULE RESET (F5)
// =============================================================================

/**
 * Default values for each input field, keyed by element ID.
 * Extend this object when new fields are added.
 */
const DEFAULTS = {
  // Beam
  b_type:"singly", b_b:300, b_h:500, b_cc:40, b_fc:28, b_fy:414, b_fyt:275,
  b_n:4, b_db:20, b_ds:10, b_layers:"1", b_np:2, b_dbp:20, b_dp:65,
  b_Mu:150, b_Vu:100, b_Tu:0, b_L:6.0, b_supp:"1",
  // Column
  c_shape:"rect", c_b:400, c_h:400, c_D:400, c_cc:40,
  c_fc:28, c_fy:415, c_nb:8, c_db:20, c_tie:"tied", c_dt:10,
  c_Pu:1000, c_M2:150, c_Lu:3.0, c_sway:"0",
  // Slab
  s_mode:"1", s_fc:21, s_fy:275, s_h:125, s_db:10,
  s_DL:1.5, s_LL:1.9, s_L:3.0, s_supp:"0.125",
  s_Lx:3.0, s_Ly:4.0, s_col_w:400, s_edge_cond:"interior",
  s_cn_s:0.045, s_cp_s:0.036, s_cn_l:0.032, s_cp_l:0.026,
};

/**
 * Resets all inputs in a module section to their default values,
 * clears validation errors, and hides the results box.
 *
 * @param {string} moduleId - The section element ID ("beam", "column", "slab").
 */
function resetModule(moduleId) {
  clearAllErrors(moduleId);

  const section = document.getElementById(moduleId);
  if (!section) return;

  // Reset every input and select within the section
  section.querySelectorAll("input, select").forEach(el => {
    if (DEFAULTS[el.id] !== undefined) {
      el.value = DEFAULTS[el.id];
    }
  });

  // Hide results box
  const resultIds = { beam:"beam-results", column:"col-results", slab:"slab-results" };
  const resEl = document.getElementById(resultIds[moduleId]);
  if (resEl) { resEl.style.display = "none"; resEl.innerHTML = ""; }

  // Re-run toggles so conditional groups show correctly
  if (moduleId === "beam")   { toggleBeamType(); }
  if (moduleId === "column") { toggleColInputs(); }
  if (moduleId === "slab")   { toggleSlabInputs(); }
  
  // Save the reset state to LocalStorage
  saveState();
}

// =============================================================================
// LOCAL STORAGE PERSISTENCE
// =============================================================================

const STORAGE_KEY = "mepce_struct_state";

/** Saves all current input values to LocalStorage */
function saveState() {
  const state = {};
  document.querySelectorAll('.form-input, .form-select').forEach(el => {
    if (el.id) state[el.id] = el.value;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** Loads saved values from LocalStorage and populates the DOM */
function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;
  
  try {
    const state = JSON.parse(saved);
    Object.keys(state).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = state[id];
    });
  } catch (e) {
    console.warn("Could not load saved state", e);
  }
}