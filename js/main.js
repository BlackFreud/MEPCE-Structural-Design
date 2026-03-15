/**
 * @file main.js
 * @description App bootstrap, tab navigation, UI toggles, module resets,
 *              print preparation, and local storage persistence.
 * @module main
 * @requires config.js
 */
"use strict";

// =============================================================================
// INIT
// =============================================================================

document.addEventListener("DOMContentLoaded", () => {
  // Populate topbar identity fields
  _setEl("display-project", PROJECT_DETAILS.project);
  _setEl("display-name",    PROJECT_DETAILS.name);
  _setEl("display-subject", PROJECT_DETAILS.subject);

  // Load persisted input state before initialising UI
  loadState();

  // Run conditional toggles on load
  toggleBeamType();
  toggleColInputs();
  toggleSlabInputs();

  // Auto-save and clear stale results on any input change
  document.querySelectorAll('.form-input, .form-select').forEach(input => {
    input.addEventListener('input', () => {
      saveState();
      document.querySelectorAll('.results-card').forEach(card => {
        card.style.display = 'none';
      });
    });
  });

  // Wire print preparation — fires just before browser opens the print dialog
  window.addEventListener("beforeprint", _preparePrint);
});

// =============================================================================
// PRINT PREPARATION
// Populates the print title block and footer with live values.
// =============================================================================

function _preparePrint() {

  // 1. Detect active module
  const activeModule = document.querySelector(".module.active");
  const moduleId     = activeModule ? activeModule.id : "";
  const moduleTitles = {
    beam:    "Beam Design — Singly / Doubly Reinforced Rectangular Section",
    column:  "Column Design — Axial-Flexural P-M Interaction",
    slab:    "Slab Design — One-Way / Two-Way Flat Plate",
    footing: "Footing Design — Isolated Spread Footing",
  };
  const moduleTitle = moduleTitles[moduleId] || "Structural Design Computation";

  // 2. Format print date  (DD MMMM YYYY — Philippine practice)
  const now    = new Date();
  const months = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];
  const dateStr = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

  // 3. Fill title block
  _setEl("ptb-project", PROJECT_DETAILS.project || "—");
  _setEl("ptb-name",    PROJECT_DETAILS.name    || "—");
  _setEl("ptb-subject", PROJECT_DETAILS.subject || "—");
  _setEl("ptb-date",    dateStr);
  _setEl("ptb-module",  moduleTitle);

  // 4. Fill footer centre
  _setEl("pfb-project-label", PROJECT_DETAILS.project || "—");
}

// =============================================================================
// SIDEBAR NAVIGATION
// =============================================================================

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (sidebar) sidebar.classList.toggle("collapsed");
}

function switchModule(moduleId, event) {
  document.querySelectorAll(".module").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));

  const section = document.getElementById(moduleId);
  if (section) section.classList.add("active");
  if (event?.currentTarget) event.currentTarget.classList.add("active");

  const titles = { beam:"Beam Design", column:"Column Design", slab:"Slab Design", footing:"Footing Design" };
  _setEl("page-title", titles[moduleId] || "");
}

// =============================================================================
// UI TOGGLES
// =============================================================================

function toggleBeamType() {
  const type  = document.getElementById("b_type")?.value;
  const group = document.getElementById("beam-comp-group");
  if (group) group.style.display = type === "doubly" ? "block" : "none";
}

function toggleColInputs() {
  const isRect = document.getElementById("c_shape")?.value === "rect";
  _show("c_b_grp", isRect);
  _show("c_h_grp", isRect);
  _show("c_D_grp", !isRect);
}

function toggleSlabInputs() {
  const mode = document.getElementById("s_mode")?.value;
  _show("slab-oneway", mode === "1");
  _show("slab-twoway", mode === "2");
}

// =============================================================================
// UNIT SYSTEM TOGGLE (IMP-01 — restored from dead code)
// =============================================================================

function toggleUnits() {
  const toggle       = document.getElementById("unit-toggle");
  const metricLabel  = document.getElementById("label-metric");
  const englishLabel = document.getElementById("label-english");
  if (!toggle) return;

  const newSystem = toggle.classList.contains("active") ? "metric" : "english";
  toggle.classList.toggle("active");
  if (metricLabel)  metricLabel.classList.toggle("active",  newSystem === "metric");
  if (englishLabel) englishLabel.classList.toggle("active", newSystem === "english");

  updateUnitLabels(newSystem);
  convertAllInputs(newSystem);

  // Purge stale results — prevents showing old calculations in wrong units
  document.querySelectorAll('.results-card').forEach(card => {
    card.style.display = 'none';
    card.innerHTML     = '';
  });
}

// =============================================================================
// MATERIAL PRESETS
// =============================================================================

function applyConcretePreset(module) {
  const select = document.getElementById(`concrete-preset-${module}`);
  if (!select?.value) return;
  const fcIds   = { beam:"b_fc", column:"c_fc", slab:"s_fc", footing:"f_fc" };
  const fcInput = document.getElementById(fcIds[module]);
  if (fcInput) { fcInput.value = select.value; clearError(fcIds[module]); }
}

function applyRebarPreset(module) {
  const select = document.getElementById(`rebar-preset-${module}`);
  if (!select?.value) return;
  const fyIds   = { beam:"b_fy", column:"c_fy", slab:"s_fy", footing:"f_fy" };
  const fyInput = document.getElementById(fyIds[module]);
  if (fyInput) { fyInput.value = select.value; clearError(fyIds[module]); }
}

// =============================================================================
// MODULE RESET
// All new fields from this audit session are included below.
// =============================================================================

const DEFAULTS = {
  // BEAM
  b_type:"singly", b_b:300, b_h:500, b_cc:40,
  b_fc:28, b_fy:414, b_fyt:275,
  b_n:4, b_db:20, b_ds:10, b_layers:"1",
  b_np:2, b_dbp:20, b_dp:65,
  b_Mu:150, b_Vu:100, b_Tu:0,
  b_wDL:0, b_wLL:0,
  b_L:6.0, b_supp:"2",
  b_seismic:"zone4", b_exposure:"weather",

  // COLUMN
  c_shape:"rect", c_b:400, c_h:400, c_D:400,
  c_cc:40, c_fc:28, c_fy:415,
  c_nb:8, c_db:20, c_tie:"tied", c_dt:10, c_hx:200,
  c_Pu:1000, c_M2:150, c_M1:80, c_curv:"1", c_Lu:3.0,
  c_sway:"0", c_k:1.0,
  c_seismic:"zone4", c_bdns:0.6, c_exposure:"weather",

  // SLAB
  s_mode:"1", s_fc:21, s_fy:275, s_h:125, s_db:10,
  s_DL:1.5, s_LL:1.9,
  s_L:3.0, s_supp:"oe",
  s_exposure:"interior",
  s_Lx:3.0, s_Ly:4.0, s_col_w:400, s_col_h:400,
  s_col_pos:"40",
  s_edge_cond:"interior",
  s_cn_s:0.045, s_cp_s:0.036, s_cn_l:0.032, s_cp_l:0.026,

  // FOOTING
  f_fc:21, f_fy:275,
  f_B:2000, f_L:2000, f_h:500, f_cc:75, f_db:16,
  f_cw:400, f_cl:400,
  f_Pu:1200, f_Mu:0, f_qa:150,
};

function resetModule(moduleId) {
  clearAllErrors(moduleId);

  const section = document.getElementById(moduleId);
  if (!section) return;

  section.querySelectorAll("input, select").forEach(el => {
    if (DEFAULTS[el.id] !== undefined) el.value = DEFAULTS[el.id];
  });

  const resultIds = { beam:"beam-results", column:"col-results", slab:"slab-results", footing:"footing-results" };
  const resEl     = document.getElementById(resultIds[moduleId]);
  if (resEl) { resEl.style.display = "none"; resEl.innerHTML = ""; }

  if (moduleId === "beam")   toggleBeamType();
  if (moduleId === "column") toggleColInputs();
  if (moduleId === "slab")   toggleSlabInputs();

  saveState();
}

// =============================================================================
// LOCAL STORAGE PERSISTENCE
// Key bumped to v2 — avoids loading stale pre-audit field values.
// =============================================================================

const STORAGE_KEY = "mepce_struct_state_v2";

function saveState() {
  const state = {};
  document.querySelectorAll('.form-input, .form-select').forEach(el => {
    if (el.id) state[el.id] = el.value;
  });
  // Persist active unit system so it survives page refresh
  state.__unitSystem = CURRENT_UNIT_SYSTEM;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;
  try {
    const state = JSON.parse(saved);

    // Restore unit system before restoring values so labels are correct
    if (state.__unitSystem && state.__unitSystem !== CURRENT_UNIT_SYSTEM) {
      const toggle       = document.getElementById("unit-toggle");
      const metricLabel  = document.getElementById("label-metric");
      const englishLabel = document.getElementById("label-english");
      if (toggle) {
        toggle.classList.toggle("active", state.__unitSystem === "english");
        if (metricLabel)  metricLabel.classList.toggle("active",  state.__unitSystem === "metric");
        if (englishLabel) englishLabel.classList.toggle("active", state.__unitSystem === "english");
      }
      updateUnitLabels(state.__unitSystem);
      CURRENT_UNIT_SYSTEM = state.__unitSystem;
    }

    Object.keys(state).forEach(id => {
      if (id === '__unitSystem') return;   // skip meta key
      const el = document.getElementById(id);
      if (el) el.value = state[id];
    });
  } catch (e) {
    console.warn("[main] Could not restore saved state:", e);
  }
}

// =============================================================================
// PRIVATE HELPERS
// =============================================================================

function _setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text || "—";
}

function _show(id, visible) {
  const el = document.getElementById(id);
  if (el) el.style.display = visible ? "flex" : "none";
}