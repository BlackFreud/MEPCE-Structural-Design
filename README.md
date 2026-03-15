# Structural Design Suite

**NSCP 2015 (6th Ed.) · ACI 318-14 · ASCE 7-16**  
University of Mindanao · MEPCE 225

A browser-based structural engineering calculator for beam, column, slab,
and footing design. No build tools, no dependencies, no server required —
open `index.html` directly in any modern browser.

---

## Quick Start

```
structural-suite/
├── index.html          ← Open this in your browser
├── README.md
├── CHANGELOG.md
├── css/
│   └── styles.css      ← All visual styling
└── js/
    ├── config.js       ← YOUR PROJECT DETAILS (edit this)
    ├── utils.js        ← Shared constants, helpers, FIELD_CONVERSIONS
    ├── canvas.js       ← Canvas drawing routines
    ├── beam.js         ← Beam calculation module
    ├── column.js       ← Column calculation module
    ├── slab.js         ← Slab calculation module
    ├── footing.js      ← Footing calculation module (new)
    └── main.js         ← App bootstrap & UI controllers
```

**To use:** double-click `index.html` or serve from any static web server.

---

## Updating Project Details

Edit **`js/config.js`** only:

```js
const PROJECT_DETAILS = {
  project: "FINAL PROPOSAL",
  name:    "STRUCTURAL ENGINEER",
  subject: "MEPCE 225",
};
```

These values populate both the on-screen topbar and the printed computation
sheet title block automatically.

---

## UI Layout

| Region | Description |
|---|---|
| Sidebar | Module navigation (B / C / S / F), collapsible |
| Topbar | Active module title + Unit toggle + Project Info |
| Content Area | Input sections, Calculate button, Results card |

---

## Features

### Material Presets
All four modules have a **Material Presets** panel auto-filling f'c and fy
from Philippine Standards.

| Preset | Value |
|---|---|
| Concrete — Standard | 21 MPa |
| Concrete — Common | 28 MPa |
| Concrete — High-Strength | 35 MPa |
| Rebar — Grade 33 | 230 MPa |
| Rebar — Grade 40 | 275 MPa |
| Rebar — Grade 60 | 414 / 415 MPa |

### Inline Field Validation
Every required field validated on Calculate. Red border + message under
field. All errors cleared on next Calculate attempt. Minimum thresholds
automatically scale to the active unit system.

### Demand/Capacity Progress Bar
Critical checks rendered as colour-coded progress bars:

| Fill | Condition |
|---|---|
| Green | Ratio ≤ 85% |
| Amber | Ratio 85–100% |
| Red | Ratio > 100% |

### Rebar Schedule Table
Every result includes Mark, Count, Size, Length, Location — ready to
transcribe to drawings.

### Module Reset
Per-module **↺ Reset** button restores all inputs to metric defaults.

### LocalStorage Persistence
Input values and active unit system saved to `localStorage` on every change
and restored on page load. Key: `mepce_struct_state_v2`.

> **Note:** Clear localStorage when upgrading from pre-v2 versions.

### Unit System Toggle *(now active)*
Metric ↔ English toggle in the topbar. All input fields convert and unit
labels update. Minimum validation thresholds scale to active system.
Active unit system persists across page refreshes.

### Print / PDF — Professional Computation Sheet
Every result header has a **⎙ Print** button producing a formal engineering
computation sheet:
- **Title block** — 6-field meta grid (project, engineer, subject, date,
  design standard, computation type) + engineer-of-record disclaimer
- **Navy section headers** with uppercase titles and ACI/NSCP code badges
- Alternating row shading, monospace values, colour-coded status tags
- Rebar schedule table with navy header row
- Running footer — suite name | project | page number
- A4 portrait with calibrated margins (18/16/22/16 mm)

---

## Module Reference

### Beam Design (`beam.js`)

| Feature | Code Reference |
|---|---|
| Min thickness — 4 support conditions | NSCP 2015 Table 409.3.1.1 |
| Singly reinforced flexure | ACI 318-14 §22.3 — Whitney stress block |
| Doubly reinforced flexure | ACI 318-14 §22.3 + §22.2 — iterative Newton |
| Tension steel yield verification | ACI 318-14 §22.3 |
| Min steel As,min | ACI 318-14 §9.6.1.2 / NSCP §409.6.1.2 |
| φ factor (strain-based) | ACI 318-14 §21.2.2 |
| Shear design — 2-tier spacing cap | ACI 318-14 §22.5, §9.7.6.2.2 |
| Seismic hoop spacing | ACI 318-14 §18.4.2 |
| Standard stirrup spacing | ACI 318-14 §9.7.6 |
| Torsion threshold | ACI 318-14 §22.7 |
| Cover adequacy by exposure | NSCP 2015 Table 406.3.2.1 |
| **Deflection check — immediate + long-term** | **ACI 318-14 §24.2 / NSCP §424.2** |
| **Crack control — bar spacing limit** | **ACI 318-14 §24.3.2 / NSCP §424.3.2** |
| Rebar congestion guard | NSCP/ACI min. clear spacing |

**Inputs:**
- Geometry: b, h, clear cover, exposure category
- Materials: f'c, fy, fyt, seismic zone
- Reinforcement: bar count, diameter, stirrup diameter, layers
- Optional compression steel (doubly reinforced)
- Loads: Mu, Vu, Tu (optional)
- Service loads: wDL and wLL (kN/m) — feeds deflection + crack checks
- Span, support condition (4 options)

**Deflection check — `_deflectionCheck()` (ACI 318-14 §24.2):**

| Output | Description |
|---|---|
| Ec, fr, Ig, Icr | Material and section properties |
| Mcr | Cracking moment |
| Ie | Effective inertia via Branson's formula — clamped [Icr, Ig] |
| Ma | Service moment from wDL+wLL or back-calc from Mu/1.4 |
| Δi (immediate) | 5wL⁴/384EcIe × support multiplier |
| λΔ = ξ/(1+50ρ') | Long-term multiplier (ξ=2.0 sustained) |
| Δlive vs L/360 | PASS/FAIL + progress bar |
| Δtotal vs L/240 | PASS/FAIL + progress bar |

**Crack control — `_crackCheck()` (ACI 318-14 §24.3.2):**

| Output | Description |
|---|---|
| fs | Service steel stress from Ma or (2/3)fy fallback |
| cc_tens | Clear cover to tension bar face = cc + ds |
| s_allow | min(380(280/fs)−2.5cc, 300(280/fs)) |
| s_act | Actual c/c bar spacing |
| PASS/FAIL | s_act vs s_allow + progress bar |

---

### Column Design (`column.js`)

| Feature | Code Reference |
|---|---|
| **Slenderness limit 34−12(M1/M2)** | **ACI 318-14 §6.2.5.1** |
| Effective length factor k | ACI 318-14 §6.6.4.3 |
| Min eccentricity | ACI 318-14 §6.6.4.5.1 |
| Moment magnification δns with βdns | ACI 318-14 §6.6.4.4 |
| P-M interaction diagram | ACI 318-14 §22.4 — 80-step c-sweep |
| Max axial capacity φPn,max | ACI 318-14 §22.4.2.1 |
| Confinement hoop spacing so (3 conditions) | ACI 318-14 §18.7.5.3 |
| Confinement zone length lo | ACI 318-14 §18.7.5.1 |
| Standard tie spacing | ACI 318-14 §25.7.2.1 |
| Cover adequacy by exposure | NSCP 2015 Table 406.3.2.1 |

**New inputs:**
- M1 (smaller end moment, magnitude)
- Curvature: single (+1) or double (−1)
- k — effective length factor with sway-aware bounds

**M1/M2 slenderness limit:**
```
slenLimit = sway ? 22 : clamp(34 − 12 × (M1/M2 × curv), 0, 40)
```
Output shows derivation formula and limit value in section title.

---

### Slab Design (`slab.js`)

#### One-Way Slab

| Feature | Code Reference |
|---|---|
| Min thickness — 4 conditions | NSCP 2015 Table 406.3.1.1 |
| Load combinations (both 1.4D and 1.2D+1.6L) | NSCP 2015 §205.3.1 |
| Moment coefficient | ACI 318-14 §6.5 |
| Min steel (fy-adjusted) | ACI 318-14 §24.4.3.2 |
| One-way shear | ACI 318-14 §22.5 |

#### Two-Way Flat Plate

| Feature | Code Reference |
|---|---|
| Min thickness — flat plate formula | ACI 318-14 Table 8.3.1.1 |
| Punching shear — 3 equations + rectangular column | ACI 318-14 §22.6.5.2 |
| **αs by column position: interior / edge / corner** | **ACI 318-14 §22.6.5.2** |
| Moment coefficients — ACI Table helper | ACI 318-14 Table 8.10.3.1 |
| Strip widths and moment distribution | ACI 318-14 §8.4 |

**αs values:** Interior = 40, Edge = 30, Corner = 20.
Output shows αs label and all three Vc equation values.

---

### Footing Design (`footing.js`) — *new module*

| Feature | Code Reference |
|---|---|
| Soil bearing pressure check | NSCP 2015 §105 |
| Factored net upward pressure qu | ACI 318-14 §13 |
| Punching (two-way) shear — 3 equations | ACI 318-14 §22.6.5.2 |
| One-way (beam) shear — both directions | ACI 318-14 §22.5 |
| Flexural reinforcement — both directions | ACI 318-14 §13.3 / §22.3 |
| As,min (temperature + shrinkage) | ACI 318-14 §13.3.4.2 |
| Max bar spacing | ACI 318-14 §7.7.2.3 |

**Inputs:**

| Input | Description |
|---|---|
| f'c, fy | Material strengths |
| B, L | Footing plan dimensions (mm) |
| h, cc, db | Depth, cover, bar diameter |
| cw, cl | Column width and length |
| Pu, Mu | Factored loads (Mu = 0 for concentric) |
| qa | Allowable net bearing pressure (kPa) |

**Outputs:**
- Plan + elevation canvas (side-by-side)
- q_avg, q_max, q_min vs qa — PASS/FAIL + tension-edge warning
- Punching shear: βc, bo, 3 Vc equations, governing, φVc vs Vu
- One-way shear both directions
- Flexural steel: req'd, min, governing, spacing — PASS/FAIL
- Rebar schedule (long direction + short direction)

---

## Canvas Drawing Functions (`canvas.js`)

| Function | Description |
|---|---|
| `drawBeamSection` | Rectangular beam cross-section |
| `drawColSection` | Rectangular or circular column |
| `drawPMCurve` | P-M interaction diagram |
| `drawSlabSection` | Slab strip with hatch + callouts |
| `drawFootingSection` | **Plan view + elevation side-by-side** |

---

## Utility Functions (`utils.js`)

| Function | Purpose |
|---|---|
| `getVal(id)` / `getStr(id)` | Read numeric / string values |
| `validateFields(fields)` | Batch validation — min scaled to unit system |
| `showError / clearError / clearAllErrors` | Inline field errors |
| `createRow / createProgressBar / createRebarSchedule / renderResults` | Result HTML builders |
| `getBeta1(fc)` | ACI 318-14 β1 |
| `getPhiFlex(et)` | Strain-based φ |
| `steelStress(strain, fy)` | Clamped ±fy |
| `barArea(db)` | πdb²/4 |
| `getMinCover(exposure, db)` | NSCP Table 406.3.2.1 |
| `convertLength / Stress / Force / Moment / Pressure` | Metric ↔ English |
| `convertForcePerLength(value, toEnglish)` | kN/m ↔ kip/ft |
| `convertAllInputs(toSystem)` | Toggle all fields |
| `updateUnitLabels(system)` | Update unit label spans |
| `FIELD_CONVERSIONS` | Map of all input IDs → conversion type |

---

## Constants (`utils.js`)

| Constant | Value | Source |
|---|---|---|
| `ES` | 200,000 MPa | Steel modulus |
| `PHI_FLEX` | 0.90 | ACI 318-14 §21.2.2 |
| `PHI_SHEAR` | 0.75 | ACI 318-14 §21.2.1 |
| `PHI_COMP` | 0.65 | ACI 318-14 §21.2.2 |
| `MAX_CONCRETE_STRAIN` | 0.003 | ACI 318-14 §22.2.2.1 |
| `GAMMA_CONCRETE` | 24 kN/m³ | NSCP 2015 |
| `SLAB_COVER` | 20 mm | Absolute minimum floor |

---

## Script Load Order

```html
<script src="js/config.js"></script>
<script src="js/utils.js"></script>
<script src="js/canvas.js"></script>
<script src="js/beam.js"></script>
<script src="js/column.js"></script>
<script src="js/slab.js"></script>
<script src="js/footing.js"></script>
<script src="js/main.js"></script>
```

---

## Adding New Modules

Follow the six-step recipe documented in the previous README. All module
hooks are now in `main.js`: add to `titles`, `applyConcretePreset`,
`applyRebarPreset`, `resetModule`, `DEFAULTS`, `FIELD_CONVERSIONS`, and
`_preparePrint`.

---

## Design Standards

| Standard | Application |
|---|---|
| NSCP 2015 (6th Ed.) Vol. I | Load combinations, min thickness, cover, seismic, bearing |
| ACI 318-14 | Flexure, shear, torsion, slenderness, P-M, slab, footing |
| ASCE 7-16 | Load combinations (governs with NSCP §205) |

---

## Known Limitations

| Item | Status |
|---|---|
| Combined shear-torsion design | Not implemented — Tu > Tth is hard stop |
| Sway frame δs (B2 amplifier) | Not implemented — SLENDER flagged only |
| αs edge/corner — footing module | Hardcoded 40 (interior) |
| Biaxial column bending Mx + My | Not implemented |
| Punching shear reinforcement (studs) | Not implemented — FAIL only |
| Deflection check — slab module | Not implemented |
| Load builder pre-calc panel | Planned — next feature |

---

## Changelog Summary

| Session | Items |
|---|---|
| Audit — Bug Fixes (5) + Non-Compliance (5) + IMP (6) + Print | 17 |
| Feature 1 — Beam deflection check (ACI §24.2) | 1 |
| Feature 2 — αs column position selector (slab) | 1 |
| Feature 3 — M1/M2 slenderness limit (ACI §6.2.5.1) | 1 |
| Feature 4 — Crack width check (ACI §24.3.2) | 1 |
| Feature 5 — Unit toggle activation | 1 |
| Feature 6 — Spread footing module | 1 |
| **Total items** | **23** |

See `CHANGELOG.md` for full session-by-session detail.

---

*Last updated: March 2026 · University of Mindanao · MEPCE 225*