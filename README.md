# Structural Design Suite

**NSCP 2015 (6th Ed.) · ACI 318-14 · ASCE 7-16**  
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
├── CHANGELOG.md
├── css/
│   └── styles.css
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

Edit **`js/config.js`** only:

```js
const PROJECT_DETAILS = {
  project: "FINAL PROPOSAL",
  name:    "Structural Engineer",
  subject: "MEPCE 225",
};
```

These values populate both the on-screen topbar and the printed computation
sheet title block automatically.

---

## UI Layout

| Region | Description |
|---|---|
| Sidebar | Module navigation (Beam / Column / Slab), collapsible |
| Topbar | Active module title + Project Info panel |
| Content Area | Input sections, Calculate button, Results card |

---

## Features

### Material Presets
Each module has a **Material Presets** panel that auto-fills f'c and fy from
Philippine Standards.

| Preset | Value |
|---|---|
| Concrete — Standard | 21 MPa |
| Concrete — Common | 28 MPa |
| Concrete — High-Strength | 35 MPa |
| Rebar — Grade 33 | 230 MPa |
| Rebar — Grade 40 | 275 MPa |
| Rebar — Grade 60 | 414 / 415 MPa |

### Inline Field Validation
Every required field is validated on Calculate. Errors appear as red borders
with a message directly below the field. All errors clear on the next
Calculate attempt.

### Demand/Capacity Progress Bar
Critical checks render as colour-coded progress bars:

| Fill Colour | Condition |
|---|---|
| Green | Ratio ≤ 85% |
| Amber | Ratio 85–100% |
| Red | Ratio > 100% (over-capacity) |

### Rebar Schedule Table
Every result includes a formatted rebar schedule: Mark, Count, Size, Length,
Location — ready to transcribe to drawings.

### Module Reset
Each module header has a **↺ Reset** button. Restores all inputs to metric
defaults, clears errors, hides result card.

### LocalStorage Persistence
Input values are automatically saved to `localStorage` on every change and
restored on page load. Key: `mepce_struct_state`.

> **Note:** Clearing localStorage is required after upgrading from versions
> prior to this release due to the `s_supp` key format change.

### Print / PDF — Professional Computation Sheet
Every result header has a **⎙ Print** button which triggers a professional
engineering computation sheet layout:

- **Title Block** — Organisation header, 6-field meta grid (project title,
  prepared by, subject, date, design standard, computation type), and an
  engineer-of-record disclaimer
- **Document Header** — Solid navy section header replacing on-screen gradient
- **Sections** — Navy left-accent divider, uppercase bold title, ACI/NSCP
  code badge, alternating row shading, monospace values
- **Status Tags** — Colour fill + solid border for B&W printer readability
- **Rebar Table** — Navy header row, monospace cell data, full border grid
- **Running Footer** — Suite name | Project title | Page number (every page)
- **Page Setup** — A4 portrait, calibrated margins (18/16/22/16 mm)

### Unit System
> **Status: Metric only (disabled)**
> The unit conversion infrastructure is fully implemented in `config.js`
> and `utils.js` (`UNIT_CONVERSIONS`, `UNIT_LABELS`, `convertAllInputs`,
> `updateUnitLabels`) but the UI toggle is commented out pending validation
> constraints. Re-enable by uncommenting the `unit-toggle-container` block
> in `index.html` and the `toggleUnits()` function in `main.js`.

---

## Module Reference

### Beam Design (`beam.js`)

| Feature | Code Reference |
|---|---|
| Min thickness (4 support conditions) | NSCP 2015 Table 409.3.1.1 |
| Singly reinforced flexure | ACI 318-14 §22.3 — Whitney stress block |
| Doubly reinforced flexure | ACI 318-14 §22.3 + §22.2 — iterative Newton, tol. 0.1 N |
| Tension steel yield verification | ACI 318-14 §22.3 — εs vs εy check |
| Min steel area As,min | ACI 318-14 §9.6.1.2 / NSCP 2015 §409.6.1.2 |
| φ factor (strain-based) | ACI 318-14 §21.2.2 |
| Shear design (2-tier spacing cap) | ACI 318-14 §22.5, §9.7.6.2.2 |
| Seismic hoop spacing (Zone 4) | ACI 318-14 §18.4.2 |
| Standard stirrup spacing | ACI 318-14 §9.7.6 |
| Torsion threshold | ACI 318-14 §22.7 |
| Cover adequacy by exposure | NSCP 2015 Table 406.3.2.1 / ACI Table 20.6.1.3.1 |
| Rebar congestion check | NSCP/ACI min. clear spacing — hard stop |

**Inputs:**
- Geometry: b, h, clear cover
- **Exposure category** *(new)*: Interior / Exposed to weather / In contact with soil
- Materials: f'c, fy, fyt
- Reinforcement: bar count, diameter, stirrup diameter, layers (1 or 2)
- Optional compression steel (doubly reinforced): N', d'b, d'
- Loads: Mu, Vu, Tu (optional)
- Span and support condition: Simply Supported / One End Continuous /
  Both Ends Continuous / Cantilever
- **Seismic zone** *(new)*: Zone 4 (Special) / Standard / Non-Seismic

**Outputs:**
- Section preview canvas
- Cover adequacy PASS/FAIL vs exposure-derived minimum
- As vs As,min PASS/FAIL
- h_min check PASS/FAIL (correct denominator for all four support conditions)
- Net tensile strain εt → DUCTILE / TRANSITION
- Tension steel yield check YIELD / WARN (doubly reinforced)
- Compression steel strain and yield status (doubly reinforced)
- φMn vs Mu progress bar + SAFE/UNSAFE
- φVc vs Vu progress bar + stirrup spacing (with correct 300mm cap)
- Seismic confinement hoops (Zone 4) or standard spacing note
- Torsion threshold Tth (if Tu > 0)
- Rebar schedule table

---

### Column Design (`column.js`)

| Feature | Code Reference |
|---|---|
| Slenderness ratio kl/r | ACI 318-14 §6.2.5.1 |
| Effective length factor k | ACI 318-14 §6.6.4.3 |
| Min eccentricity | ACI 318-14 §6.6.4.5.1 |
| Moment magnification δns with βdns | ACI 318-14 §6.6.4.4 (non-sway) |
| P-M interaction diagram | ACI 318-14 §22.4 — 80-step linear c-sweep |
| Max axial capacity φPn,max | ACI 318-14 §22.4.2.1 |
| Confinement hoop spacing so (3 conditions) | ACI 318-14 §18.7.5.3 |
| Confinement zone length lo | ACI 318-14 §18.7.5.1 |
| Standard tie spacing | ACI 318-14 §25.7.2.1 |
| Cover adequacy by exposure | NSCP 2015 Table 406.3.2.1 |

**Inputs:**
- Shape: rectangular (b × h) or circular (D)
- Materials: f'c, fy
- Reinforcement: bar count, diameter, tie type (tied/spiral), tie diameter
- **hx — max hoop leg spacing** *(new)*: used for so condition (c)
- Clear cover + **Exposure category** *(new)*
- Loads: Pu, Mu
- Slenderness: Lu, sway classification
- **k — effective length factor** *(new)*: user-entered, sway-bounded
- **βdns — sustained load ratio** *(new)*: applied to EI per §6.6.4.4.4
- **Seismic zone** *(new)*: Zone 4 (Special) / Standard

**Outputs:**
- P-M interaction diagram canvas
- Section preview canvas
- Cover adequacy PASS/FAIL
- Steel ratio ρg PASS/FAIL (1%–8%)
- k_eff with SWAY/NON-SWAY tag
- kl/r → SHORT / SLENDER
- βdns + δns (when slender non-sway)
- Design moment Mc
- P-M demand inside/outside envelope + SAFE/FAIL
- Pu vs φPn,max progress bar
- All three so conditions shown + governing value
- Seismic detailing (lo, so, s) or standard tie spacing
- Rebar schedule table

**P-M Curve Notes:**
Uniform 80-step linear c-sweep from c = 4·dim to c ≈ 0. Circular sections
use chord-sector integration for the Whitney block. d_eff and d' derived from
actual cover + actual tie diameter (dt). Points with φPn < 0 filtered before
plotting.

---

### Slab Design (`slab.js`)

#### One-Way Slab

| Feature | Code Reference |
|---|---|
| Min thickness (4 conditions) | NSCP 2015 Table 406.3.1.1 / ACI 318-14 Table 7.3.1.1 |
| Load combinations (governing) | NSCP 2015 §205.3.1 / ASCE 7-16 §2.3.1 |
| Moment coefficient method | ACI 318-14 §6.5 |
| Min steel (fy-adjusted) | ACI 318-14 §24.4.3.2 |
| One-way shear | ACI 318-14 §22.5 |
| Cover by exposure | NSCP 2015 Table 406.3.2.1 |

**Inputs:** f'c, fy, h, bar Ø, **exposure category** *(new)*, SDL, LL, span,
support condition *(now 4 options: ss/oe/be/ca)*

**Outputs:**
- Cover (exposure-based) + effective depth d
- Both load combinations (1.4D and 1.2D+1.6L) with governing tag
- h_min PASS/FAIL
- Main bar spacing + temp/shrinkage spacing (fy-adjusted As,min)
- φVc vs Vu progress bar + SAFE/FAIL
- Section preview canvas
- Rebar schedule table

#### Two-Way Flat Plate

| Feature | Code Reference |
|---|---|
| Min thickness | ACI 318-14 Table 8.3.1.1 (correct flat plate formula) |
| Load combinations (governing) | NSCP 2015 §205.3.1 / ASCE 7-16 §2.3.1 |
| Punching shear (3 equations) | ACI 318-14 §22.6.5.2 |
| Rectangular column support | ACI 318-14 §22.6 — bo = 2(c1+c2+2d) |
| Moment coefficients | ACI 318-14 Table 8.10.3.1 |
| Strip widths | ACI 318-14 §8.4.1.5 |
| Moment distribution | ACI 318-14 Table 8.4.2.2.2 |
| Min steel (fy-adjusted) | ACI 318-14 §24.4.3.2 |

**Inputs:** f'c, fy, h, bar Ø, **exposure category** *(new)*, SDL, LL,
Lx, Ly, **c1 and c2 column dimensions** *(c2 is new)*, edge condition,
four moment coefficients

**Outputs:**
- Cover + effective depth d
- Both load combinations with governing tag
- Aspect ratio β check
- h_min PASS/FAIL *(correct formula: Ln×(0.8+fy/1400)/36)*
- Punching shear: **all three Vc equations shown**, governing labeled, βc from
  actual column dims, φVc vs Vu progress bar + SAFE/FAIL
- Strip widths (column + middle, short + long)
- Bar spacing for all 8 strip-moment cases
- Rebar schedule table

**ACI Coefficient Helper:**
The **Load from ACI Table** button interpolates coefficients from the built-in
table (β = 1.0–2.0, four edge conditions) and auto-fills the four fields.

---

## Canvas Drawing Functions (`canvas.js`)

| Function | Signature | Description |
|---|---|---|
| `drawBeamSection` | `(canvasId, b, h, cc, n, np, db, ds, layers)` | Rectangular beam cross-section |
| `drawColSection` | `(canvasId, shape, b, h, D, cc, nb, db)` | Rectangular or circular column |
| `drawPMCurve` | `(canvasId, points, Mu, Pu)` | P-M diagram with demand point |
| `drawSlabSection` | `(canvasId, h, db, cover, spacing, spanMm)` | Slab strip with hatch & callouts |

---

## Utility Functions (`utils.js`)

| Function | Purpose |
|---|---|
| `getVal(id)` | Read numeric input value |
| `getStr(id)` | Read string/select value |
| `validateFields(fields)` | Batch validation with inline errors |
| `showError / clearError` | Per-field error display |
| `clearAllErrors(parentId)` | Clear all errors in a module section |
| `createRow(label, value, status)` | Result row with colour-coded tag |
| `createProgressBar(label, demand, capacity, unit)` | Demand/capacity bar |
| `createRebarSchedule(bars)` | Formatted rebar schedule table |
| `renderResults(containerId, html, afterPaint)` | Inject HTML + rAF callback |
| `getBeta1(fc)` | ACI 318-14 β1 factor |
| `getPhiFlex(et)` | Strain-based φ factor |
| `steelStress(strain, fy)` | Clamped steel stress (±fy) |
| `barArea(db)` | Bar cross-sectional area |
| `getMinCover(exposure, db)` | *(new)* Min cover by exposure per NSCP Table 406.3.2.1 |
| `convertLength / Stress / Force / Moment / Pressure` | *(restored)* Unit conversions metric ↔ English |
| `convertAllInputs(toSystem)` | Convert all inputs on unit toggle (with no-op guard) |
| `updateUnitLabels(system)` | Update data-unit-type span labels |

---

## Constants Reference (`utils.js`)

| Constant | Value | Source |
|---|---|---|
| `ES` | 200,000 MPa | Steel modulus of elasticity |
| `PHI_FLEX` | 0.90 | ACI 318-14 §21.2.2 |
| `PHI_SHEAR` | 0.75 | ACI 318-14 §21.2.1 |
| `PHI_COMP` | 0.65 | ACI 318-14 §21.2.2 |
| `MAX_CONCRETE_STRAIN` | 0.003 | ACI 318-14 §22.2.2.1 |
| `GAMMA_CONCRETE` | 24 kN/m³ | NSCP 2015 |
| `SLAB_COVER` | 20 mm | Absolute minimum floor — NSCP 2015 Table 420.6.1.3.1 |

---

## Script Load Order

```html
<script src="js/config.js"></script>   <!-- PROJECT_DETAILS, UNIT_CONVERSIONS, presets -->
<script src="js/utils.js"></script>    <!-- getVal, createRow, getBeta1, getMinCover, etc. -->
<script src="js/canvas.js"></script>   <!-- draw* functions -->
<script src="js/beam.js"></script>     <!-- calculateBeam(), BEAM_DENOM -->
<script src="js/column.js"></script>   <!-- calculateColumn() -->
<script src="js/slab.js"></script>     <!-- calculateSlab(), SUPPORT_MAP, ACI_MOMENT_COEFFICIENTS -->
<script src="js/main.js"></script>     <!-- switchModule, toggles, resets, localStorage -->
```

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
3. Add a `<button class="nav-item" ...>` to the sidebar in `index.html`
4. Add `"footing": "Footing Design"` to the `titles` map in `main.js`
5. Add footing field defaults to the `DEFAULTS` object in `main.js`
6. Load `<script src="js/footing.js">` before `main.js`

---

## Design Standards

| Standard | Application |
|---|---|
| NSCP 2015 (6th Ed.) Vol. I | Load combinations, min thickness, cover, seismic detailing |
| ACI 318-14 | Flexure, shear, torsion, slenderness, P-M interaction, slab design |
| ASCE 7-16 | Load combinations (governs with NSCP §205) |

---

## Known Limitations

| Item | Status |
|---|---|
| Unit toggle (Metric ↔ English) | Infrastructure complete — toggle commented out |
| Combined shear-torsion design | Not implemented — Tu > Tth is a hard stop |
| Sway frame moment magnification | Not implemented — SLENDER flagged, δs not computed |
| Deflection checks | Not implemented for any module |
| M1/M2 ratio for slenderness limit | Conservative 34 used — (34 − 12M1/M2) not yet wired |
| αs for edge/corner punching | 40 (interior) assumed — edge (30) and corner (20) not selectable |

---

## Browser Compatibility

Tested on Chrome 120+, Firefox 121+, Safari 17+, Edge 120+.  
Requires: ES6, Canvas 2D API, localStorage.

---

## Changelog Summary (Current Release)

| Category | Count | Items |
|---|---|---|
| Critical Bug Fixes | 5 | BUG-01 through BUG-05 |
| Code Non-Compliance | 5 | NC-01 through NC-05 |
| Improvements | 6 | IMP-01 through IMP-06 |
| Print Refinement | 1 | Full @media print rewrite |
| **Total** | **17** | |

See `CHANGELOG.md` for full session-by-session detail.

---

*Last updated: 2026 · University of Mindanao*