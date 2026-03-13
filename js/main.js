/**
 * @file main.js
 * @description Application bootstrap and UI controller.
 *              Handles:
 *              - Header population from config.js
 *              - Tab navigation (Beam / Column / Slab)
 *              - UI toggle handlers for conditional input groups
 *
 * @module main
 * @requires config.js
 */

"use strict";

// ---------------------------------------------------------------------------
// INIT
// ---------------------------------------------------------------------------

/**
 * Runs on DOMContentLoaded. Populates header fields from PROJECT_DETAILS
 * (defined in config.js) and sets initial UI state.
 */
document.addEventListener("DOMContentLoaded", () => {
  // Populate header display fields
  _setHeader("display-project", PROJECT_DETAILS.project);
  _setHeader("display-name",    PROJECT_DETAILS.name);
  _setHeader("display-subject", PROJECT_DETAILS.subject);

  // Ensure correct initial UI states
  toggleBeamType();
  toggleColInputs();
  toggleSlabInputs();
});

/**
 * Sets the text content of a header display element safely.
 *
 * @param {string} id    - Target element ID.
 * @param {string} text  - Value to display.
 */
function _setHeader(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text || "—";
}

// ---------------------------------------------------------------------------
// TAB NAVIGATION
// ---------------------------------------------------------------------------

/**
 * Switches the active module tab.
 * Removes "active" from all nav buttons and module sections,
 * then applies it to the target tab and its nav button.
 *
 * @param {string} tabId  - The ID of the target module section.
 * @param {Event}  e      - The click event from the nav button.
 */
function switchTab(tabId, e) {
  document.querySelectorAll(".module").forEach(el => el.classList.remove("active"));
  document.querySelectorAll("nav button").forEach(el => el.classList.remove("active"));

  const section = document.getElementById(tabId);
  if (section) section.classList.add("active");

  // Mark the clicked button active
  if (e && e.currentTarget) {
    e.currentTarget.classList.add("active");
  }
}

// ---------------------------------------------------------------------------
// UI TOGGLE HANDLERS
// ---------------------------------------------------------------------------

/**
 * Shows or hides the compression reinforcement input group
 * based on the selected beam design type (singly vs doubly).
 *
 * Called by the "Design Type" <select> onChange.
 */
function toggleBeamType() {
  const type    = document.getElementById("b_type")?.value;
  const group   = document.getElementById("beam-comp-group");
  if (group) group.style.display = type === "doubly" ? "block" : "none";
}

/**
 * Shows / hides rectangular or circular dimension inputs
 * depending on selected column shape.
 *
 * Called by the "Shape" <select> onChange.
 */
function toggleColInputs() {
  const shape  = document.getElementById("c_shape")?.value;
  const isRect = shape === "rect";
  _show("c_b_grp", isRect);
  _show("c_h_grp", isRect);
  _show("c_D_grp", !isRect);
}

/**
 * Shows one-way or two-way input sections based on selected slab design method.
 *
 * Called by the "Design Method" <select> onChange.
 */
function toggleSlabInputs() {
  const mode = document.getElementById("s_mode")?.value;
  _show("slab-oneway", mode === "1");
  _show("slab-twoway", mode === "2");
}

// ---------------------------------------------------------------------------
// INTERNAL
// ---------------------------------------------------------------------------

/**
 * Toggles display on a flex container or block element by ID.
 *
 * @param {string}  id      - Element ID.
 * @param {boolean} visible - True = show (flex), False = hide.
 */
function _show(id, visible) {
  const el = document.getElementById(id);
  if (el) el.style.display = visible ? "flex" : "none";
}