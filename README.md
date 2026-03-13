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
  name:    "YOUR NAME",
  subject: "MEPCE 225",
};
```

---

## Module Reference

### Beam Design (`beam.js`)

| Feature | Code Reference |
|---|---|
| Minimum thickness | NSCP 2015 Table 409.3.1.1 |
| Singly reinforced flexure | ACI 318-14 §22.3 (Whitney stress block) |
| Doubly reinforced flexure | ACI 318-14 §22.3 + §22.2 (iterative equilibrium) |
| φ factor (strain-based) | ACI 318-14 §21.2.2 |
| Shear design & spacing | ACI 318-14 §22.5, §9.7.6 |
| Seismic hoop spacing | NSCP 2015 / ACI 318-14 §18 |
| Torsion threshold | ACI 318-14 §22.7 |

**Inputs:**
- Geometry: b, h, clear cover
- Materials: fc', fy, fyt
- Reinforcement: bar count, diameter, stirrup diameter, layers
- Optional compression steel (doubly reinforced mode)
- Loads: Mu, Vu, Tu
- Span and support condition

**Outputs:**
- Section canvas diagram
- Min thickness check (PASS/FAIL)
- Effective depth d
- Net tensile strain εt → ductility classification
- φMn flexural capacity vs Mu demand
- Stirrup spacing or confinement requirement
- Seismic hoop spacing
- Torsion threshold check (if Tu > 0)

---

### Column Design (`column.js`)

| Feature | Code Reference |
|---|---|
| Slenderness ratio kl/r | ACI 318-14 §6.2.5.1 |
| Min eccentricity | ACI 318-14 §6.6.4.5.1 |
| Moment magnification (δns) | ACI 318-14 §6.6.4 |
| P-M interaction diagram | ACI 318-14 §22.4 (compatibility method) |
| Max axial capacity | ACI 318-14 §22.4.2.1 |
| Confinement hoop spacing | ACI 318-14 §18.7.5.3 |

**Inputs:**
- Shape: rectangular (b × h) or circular (D)
- Materials: fc', fy
- Reinforcement: bar count, diameter, tie type & diameter
- Loads: Pu, Mu
- Slenderness: Lu, sway classification

**Outputs:**
- P-M interaction diagram (canvas)
- Section canvas diagram
- Reinforcement ratio check (1%–8%)
- Slenderness ratio → SHORT/SLENDER
- Moment magnification factor (non-sway slender columns)
- Demand point plotted against capacity envelope
- Max axial φPn(max)
- Zone 4 confinement hoop/spiral spacing

---

### Slab Design (`slab.js`)

#### One-Way Slab

| Feature | Code Reference |
|---|---|
| Min thickness | ACI 318-14 Table 7.3.1.1 |
| Flexure — coeff. method | ACI 318-14 §6.5 |
| Temperature/shrinkage steel | ACI 318-14 §24.4.3.2 |
| One-way shear | ACI 318-14 §22.5 |

**Inputs:** fc', fy, h, bar Ø, SDL, LL, span, support condition  
**Outputs:** min thickness check, main bar spacing, temp. steel spacing, shear check

#### Two-Way Flat Plate

| Feature | Code Reference |
|---|---|
| Punching shear | ACI 318-14 §22.6 |
| Moment coefficients | User-specified (NSCP/ACI tables) |
| Flexural bar spacing | ACI 318-14 §8.7.2.2 |

**Inputs:** fc', fy, h, bar Ø, SDL, LL, Lx, column width, moment coefficients  
**Outputs:** punching shear check, bar spacing for all four moment cases

---

## Script Load Order

```html
<script src="js/config.js"></script>   <!-- PROJECT_DETAILS constant -->
<script src="js/utils.js"></script>    <!-- getVal, createRow, getBeta1, etc. -->
<script src="js/canvas.js"></script>   <!-- drawBeamSection, drawColSection, drawPMCurve -->
<script src="js/beam.js"></script>     <!-- calculateBeam() -->
<script src="js/column.js"></script>   <!-- calculateColumn() -->
<script src="js/slab.js"></script>     <!-- calculateSlab() -->
<script src="js/main.js"></script>     <!-- switchTab, toggles, DOMContentLoaded -->
```

Each module depends only on the modules loaded before it. No circular
dependencies.

---

## Extending a Module

To add a new check (e.g. deflection in beam):

1. Open `js/beam.js`
2. Add a private helper `_deflectionCheck(...)` following the JSDoc pattern
3. Call it inside `calculateBeam()` and append `createRow(...)` to `html`
4. No other files need to change

To add a new module (e.g. footing):

1. Create `js/footing.js` with a public `calculateFooting()` function
2. Add the module `<section>` to `index.html`
3. Add a nav `<button>` in `index.html`
4. Load `<script src="js/footing.js">` before `main.js`

---

## Design Standards

| Standard | Usage |
|---|---|
| NSCP 2015 Vol. I | Min thickness, shear walls, seismic detailing, load combos |
| ACI 318-14 | Flexure, shear, torsion, slenderness, P-M interaction |
| NSCP 2015 Seismic Zone 4 | Hoop spacing, confinement requirements |

---

## Browser Compatibility

Tested on Chrome 120+, Firefox 121+, Safari 17+, Edge 120+.  
Requires: ES6 (const/let, arrow functions, template literals), Canvas 2D API.

---

*Last updated: 2026 · University of Mindanao*
