# Structural Design Suite

**NSCP 2015 / ACI 318-14 · Zone 4 Seismic Ready**  
University of Mindanao · MEPCE 225

A browser-based structural engineering calculator for beam, column, and slab
design. No build tools, no dependencies, no server required — open
`index.html` directly in any modern browser.

---

## Quick Start

```
structural-suite/
├── index.html          ← Open this in your browser
├── README.md
├── CHANGELOG.md        ← Session-by-session change log
├── css/
│   └── styles.css      ← All visual styling
└── js/
    ├── config.js       ← YOUR PROJECT DETAILS (edit this)
    ├── utils.js        ← Shared constants & helpers
    ├── canvas.js       ← Canvas drawing routines
    ├── beam.js         ← Beam calculation module
    ├── column.js       ← Column calculation module
    ├── slab.js         ← Slab calculation module
    └── main.js         ← App bootstrap & UI controllers
```

**To use:** double-click `index.html` or serve from any static web server.

---

## Updating Project Details

Edit **`js/config.js`** only — nothing else needs to change:

```js
const PROJECT_DETAILS = {
  project: "FINAL PROPOSAL",
  name:    "Structural Engineer",
  subject: "MEPCE 225",
};
```

---

## UI Layout

The app uses a **sidebar + main content** dashboard layout:

| Region | Description |
|---|---|
| Sidebar | Module navigation (Beam / Column / Slab), collapsible. Nav icons use text badges (B · C · S). |
| Topbar | Active module title + Project Info panel |
| Content Area | Input sections, calculate button, results card |

### Navigation

```js
switchModule(moduleId, event)   // switches active module + updates page title
toggleSidebar()                 // collapses / expands the sidebar
```

---

## Features

### Material Presets
Each module has a **Material Presets** panel that auto-fills f<sub>c</sub>' and f<sub>y</sub>
from Philippine Standards without overwriting other inputs.

| Preset | Value |
|---|---|
| Concrete — Standard | 21 MPa |
| Concrete — Common | 28 MPa |
| Concrete — High-Strength | 35 MPa |
| Rebar — Grade 33 | 230 MPa |
| Rebar — Grade 40 | 275 MPa |
| Rebar — Grade 60 | 414 / 415 MPa |

### Inline Field Validation (F2)
Every required field is validated on calculate. Errors appear as red borders
with a message directly below the field — no `alert()` dialogs. All errors
are cleared on the next calculate attempt.

### Demand/Capacity Progress Bar (F3)
Critical checks (φM<sub>n</sub> vs M<sub>u</sub>, φV<sub>c</sub> vs V<sub>u</sub>,
P<sub>u</sub> vs φP<sub>n,max</sub>, punching shear) render as colour-coded progress bars:

| Fill Colour | Condition |
|---|---|
| Green | Ratio ≤ 85% |
| Amber | Ratio 85–100% |
| Red | Ratio > 100% (over-capacity) |

### Rebar Schedule Table (F4)
Every result includes a formatted rebar schedule showing Mark, Count, Size,
Length, and Location — ready to transcribe to drawings.

### Module Reset (F5)
Each module header has an **↺ Reset** button. It restores all inputs to
their metric defaults (see `DEFAULTS` object in `main.js`), clears all
errors, and hides the result card.

### LocalStorage Persistence
Input values are automatically saved to `localStorage` on every change
(`saveState`) and restored on page load (`loadState`). Key: `mepce_struct_state`.
Reset also saves the cleared state.

### Print / PDF
Every result header has a **⎙ Print** button. A dedicated `@media print`
stylesheet hides inputs and navigation, printing only the result card with
colour-adjusted status tags.

### Unit System
> **Status: Metric only (disabled)**  
> The UI toggle, CSS, conversion constants (`UNIT_CONVERSIONS`, `UNIT_LABELS`
> in `config.js`), and DOM helpers (`updateUnitLabels`, `convertAllInputs`,
> `getPrecision` in `utils.js`) are fully implemented but the toggle button
> and `toggleUnits()` in `main.js` are commented out due to input validation
> constraints when mixing units.  
> Re-enable by uncommenting the `unit-toggle-container` block in `index.html`
> and the `toggleUnits()` function in `main.js`.

---

## Module Reference

### Beam Design (`beam.js`)

| Feature | Code Reference |
|---|---|
| Minimum thickness | NSCP 2015 Table 409.3.1.1 |
| Singly reinforced flexure | ACI 318-14 §22.3 (Whitney stress block) |
| Doubly reinforced flexure | ACI 318-14 §22.3 + §22.2 (iterative Newton, tol. 0.1 N) |
| φ factor (strain-based) | ACI 318-14 §21.2.2 |
| Shear design & spacing | ACI 318-14 §22.5, §9.7.6 |
| Seismic hoop spacing | NSCP 2015 / ACI 318-14 §18.4.2 |
| Torsion threshold | ACI 318-14 §22.7 |
| Rebar congestion check | NSCP/ACI min. clear spacing — hard stop |

**Inputs:**
- Geometry: b, h, clear cover
- Materials: f<sub>c</sub>', f<sub>y</sub>, f<sub>yt</sub>
- Reinforcement: bar count, diameter, stirrup diameter, layers (1 or 2)
- Optional compression steel (doubly reinforced): N', d<sub>b</sub>', d'
- Loads: M<sub>u</sub>, V<sub>u</sub>, T<sub>u</sub> (optional)
- Span and support condition

**Outputs:**
- Section preview canvas (centered, visible when printed)
- h<sub>min</sub> check PASS/FAIL
- Effective depth d, steel areas A<sub>s</sub> / A<sub>s</sub>'
- Compression steel stress and yield status (doubly reinforced)
- Net tensile strain ε<sub>t</sub> → DUCTILE / TRANSITION
- φM<sub>n</sub> vs M<sub>u</sub> progress bar + SAFE/UNSAFE
- φV<sub>c</sub> vs V<sub>u</sub> progress bar + stirrup spacing
- Seismic confinement hoop spacing
- T<sub>th</sub> check (if T<sub>u</sub> > 0)
- Rebar schedule table

**Congestion Guard:**  
Clear spacing between bars is checked against `max(25mm, d`<sub>`b`</sub>`)` before any
calculation. Violations in the tension or compression layer produce a
descriptive error and halt calculation.

---

### Column Design (`column.js`)

| Feature | Code Reference |
|---|---|
| Slenderness ratio kl/r | ACI 318-14 §6.2.5.1 |
| Min eccentricity | ACI 318-14 §6.6.4.5.1 |
| Moment magnification (δ<sub>ns</sub>) | ACI 318-14 §6.6.4.4 (non-sway only) |
| P-M interaction diagram | ACI 318-14 §22.4 — 80-step linear c-sweep |
| Max axial capacity | ACI 318-14 §22.4.2.1 |
| Confinement hoop spacing (s<sub>o</sub>) | ACI 318-14 §18.7.5.3 |
| Confinement zone length (l<sub>o</sub>) | ACI 318-14 §18.7.5.1 |
| Standard tie spacing (s) | ACI 318-14 §25.7.2.1 |

**Inputs:**
- Shape: rectangular (b × h) or circular (D)
- Materials: f<sub>c</sub>', f<sub>y</sub>
- Reinforcement: bar count, diameter, tie type, tie diameter
- Clear cover (used directly for d<sub>eff</sub> and d' in P-M sweep)
- Loads: P<sub>u</sub>, M<sub>u</sub>
- Slenderness: L<sub>u</sub>, sway classification

**Outputs:**
- P-M interaction diagram canvas (clipped, negative P<sub>n</sub> filtered)
- Section preview canvas
- Reinforcement ratio ρ<sub>g</sub> PASS/FAIL (1%–8%)
- Slenderness kl/r → SHORT / SLENDER
- Design moment M<sub>c</sub> (with δ<sub>ns</sub> if applicable)
- P-M demand: inside/outside envelope + SAFE/FAIL
- P<sub>u</sub> vs φP<sub>n,max</sub> progress bar
- Seismic detailing: l<sub>o</sub>, s<sub>o</sub> (ends), s (mid-height)
- Rebar schedule table

**P-M Curve Notes:**  
Uniform 80-step linear c-sweep from c = 4·dim to c ≈ 0. Circular sections
use chord-sector integration for the Whitney block. Points with φP<sub>n</sub> < 0
are filtered before plotting; `ctx.clip()` prevents overdraw outside the
plot boundary.

---

### Slab Design (`slab.js`)

#### One-Way Slab

| Feature | Code Reference |
|---|---|
| Min thickness | ACI 318-14 Table 7.3.1.1 |
| Moment coefficient method | ACI 318-14 §6.5 |
| Temperature/shrinkage steel | ACI 318-14 §24.4.3.2 |
| One-way shear | ACI 318-14 §22.5 |

**Inputs:** f<sub>c</sub>', f<sub>y</sub>, h, bar Ø, SDL, LL, span, support condition
(Simply Supported w<sub>u</sub>L²/8 or Continuous w<sub>u</sub>L²/10)

**Outputs:**
- Section preview canvas (thickness, cover, bar spacing callouts, span label)
- h<sub>min</sub> PASS/FAIL
- Factored moment M<sub>u</sub>
- Main bar spacing (bottom) + temp/shrinkage spacing (top)
- φV<sub>c</sub> vs V<sub>u</sub> progress bar + SAFE/FAIL
- Rebar schedule table

#### Two-Way Flat Plate

| Feature | Code Reference |
|---|---|
| Punching shear | ACI 318-14 §22.6 |
| Moment coefficients | ACI 318-14 Table 8.10.3.1 |
| Flexural bar spacing | ACI 318-14 §8.7.2.2 |

**Inputs:** f<sub>c</sub>', f<sub>y</sub>, h, bar Ø, SDL, LL, L<sub>x</sub>,
L<sub>y</sub>, column width, edge condition, four moment coefficients

**Outputs:**
- Aspect ratio β = L<sub>y</sub>/L<sub>x</sub> check
- h<sub>min</sub> PASS/FAIL
- Punching shear (b<sub>o</sub>, φV<sub>c</sub> vs V<sub>u</sub>, SAFE/FAIL)
- Strip widths (column + middle, short + long direction)
- Bar spacing for all four moment cases (−short, +short, −long, +long)
- Rebar schedule table

**ACI Coefficient Helper:**  
A **Load from ACI Table 8.10.3.1** button (styled as a standard section card)
interpolates coefficients from the built-in table (β = 1.0–2.0, four edge
conditions) and auto-fills the four coefficient fields.

---

## Canvas Drawing Functions (`canvas.js`)

| Function | Signature | Description |
|---|---|---|
| `drawBeamSection` | `(canvasId, b, h, cc, n, np, db, ds, layers)` | Rectangular beam cross-section |
| `drawColSection` | `(canvasId, shape, b, h, D, cc, nb, db)` | Rectangular or circular column |
| `drawPMCurve` | `(canvasId, points, Mu, Pu)` | P-M diagram with demand point |
| `drawSlabSection` | `(canvasId, h, db, cover, spacing, spanMm)` | Slab strip with hatch & callouts |

All functions use a double `requestAnimationFrame` via `renderResults()` to
guarantee the canvas is in the DOM before drawing.

---

## Utility Functions (`utils.js`)

| Function | Purpose |
|---|---|
| `getVal(id)` | Read numeric input value |
| `getStr(id)` | Read string/select value |
| `validateFields(fields)` | Batch validation with inline errors |
| `showError(id, msg)` / `clearError(id)` | Per-field error display |
| `clearAllErrors(parentId)` | Clear all errors in a module section |
| `createRow(label, value, status)` | Result row with colour-coded tag. Accepts HTML in `label` for sub/superscript. |
| `createDivider(title)` | Section divider inside result body |
| `createProgressBar(label, demand, capacity, unit)` | Demand/capacity bar. Accepts HTML in `label`. |
| `createRebarSchedule(bars)` | Formatted rebar schedule table |
| `renderResults(containerId, html, afterPaint)` | Inject HTML + rAF callback |
| `getBeta1(fc)` | ACI 318-14 β₁ factor |
| `getPhiFlex(et)` | Strain-based φ factor |
| `steelStress(strain, fy)` | Clamped steel stress (±f<sub>y</sub>) |
| `barArea(db)` | Bar cross-sectional area (πd<sub>b</sub>²/4) |
| `updateUnitLabels(system)` | Updates `data-unit-type` span text (reserved) |
| `convertAllInputs(toSystem)` | Converts all input values (reserved) |

---

## Script Load Order

```html
<script src="js/config.js"></script>   <!-- PROJECT_DETAILS, UNIT_CONVERSIONS, presets -->
<script src="js/utils.js"></script>    <!-- getVal, createRow, getBeta1, etc. -->
<script src="js/canvas.js"></script>   <!-- draw* functions -->
<script src="js/beam.js"></script>     <!-- calculateBeam() -->
<script src="js/column.js"></script>   <!-- calculateColumn() -->
<script src="js/slab.js"></script>     <!-- calculateSlab(), loadACICoefficients() -->
<script src="js/main.js"></script>     <!-- switchModule, toggles, resets, localStorage -->
```

Each module depends only on modules loaded before it. No circular dependencies.

---

## Extending the App

**Add a check to an existing module (e.g. deflection in beam):**

1. Open `js/beam.js`
2. Add a private helper `_deflectionCheck(...)` following the JSDoc pattern
3. Append its result HTML inside `calculateBeam()` before `renderResults()`
4. No other files need to change

**Add a new module (e.g. footing):**

1. Create `js/footing.js` with a public `calculateFooting()` function
2. Add `<section class="module" id="footing">` to `index.html`
3. Add `<button class="nav-item" onclick="switchModule('footing', event)"><span class="nav-item-icon">F</span>...` to the sidebar
4. Add `"footing": "Footing Design"` to the `titles` map in `switchModule()` in `main.js`
5. Add footing field defaults to `DEFAULTS` in `main.js`
6. Load `<script src="js/footing.js">` before `main.js`

---

## Constants Reference

| Constant | Value | Source |
|---|---|---|
| `ES` | 200,000 MPa | Steel modulus |
| `PHI_FLEX` | 0.90 | ACI 318-14 §21.2.2 |
| `PHI_SHEAR` | 0.75 | ACI 318-14 §21.2.1 |
| `PHI_COMP` | 0.65 | ACI 318-14 §21.2.2 |
| `MAX_CONCRETE_STRAIN` | 0.003 | ACI 318-14 §22.2.2.1 |
| `GAMMA_CONCRETE` | 24 kN/m³ | NSCP 2015 |
| `SLAB_COVER` | 20 mm | NSCP 2015 Table 420.6.1.3.1 (interior) |

---

## Known Limitations

| Item | Status |
|---|---|
| Unit toggle (Metric ↔ English) | Disabled — infrastructure complete, toggle commented out |
| Combined shear-torsion design | Not implemented — T<sub>u</sub> > T<sub>th</sub> is a hard stop |
| Sway frame moment magnification | Not implemented — SLENDER flag only |
| Deflection checks | Not implemented for any module |

---

## Design Standards

| Standard | Usage |
|---|---|
| NSCP 2015 Vol. I | Min thickness, load combinations, seismic detailing |
| ACI 318-14 | Flexure, shear, torsion, slenderness, P-M interaction, slab coefficients |
| NSCP 2015 Seismic Zone 4 | Hoop/spiral spacing, confinement zones |

---

## Browser Compatibility

Tested on Chrome 120+, Firefox 121+, Safari 17+, Edge 120+.  
Requires: ES6 (const/let, arrow functions, template literals), Canvas 2D API, localStorage.

---

*Last updated: 2026 · University of Mindanao*
