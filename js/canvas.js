/**
 * @file canvas.js
 * @description Canvas 2D drawing routines.
 *              All functions share a consistent signature:
 *              drawXxx(canvasId, ...params) — R2 fix.
 *              Functions: drawBeamSection, drawColSection, drawPMCurve, drawSlabSection
 * @module canvas
 * @requires utils.js
 */
"use strict";

const COLOR = {
  concrete: "#d8d5cf",
  stirrup:  "#2980b9",
  bar:      "#c0392b",
  axis:     "#444",
  curve:    "#27ae60",
  point:    "#c0392b",
  text:     "#555",
  border:   "#888",
  grid:     "#efefef",
};

// =============================================================================
// BEAM SECTION
// =============================================================================

/**
 * @param {string} canvasId
 * @param {number} b       Width (mm)
 * @param {number} h       Depth (mm)
 * @param {number} cc      Clear cover (mm)
 * @param {number} n       Tension bars
 * @param {number} np      Compression bars (0 = singly)
 * @param {number} db      Tension bar Ø (mm)
 * @param {number} ds      Stirrup Ø (mm)
 * @param {number} layers  1 or 2
 */
function drawBeamSection(canvasId, b, h, cc, n, np, db, ds, layers) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const PAD   = 28;
  const scale = Math.min((W - 2 * PAD) / b, (H - 2 * PAD) / h);
  const rW    = b * scale, rH = h * scale;
  const x0    = (W - rW) / 2, y0 = (H - rH) / 2;

  // Concrete
  ctx.fillStyle   = COLOR.concrete;
  ctx.fillRect(x0, y0, rW, rH);
  ctx.strokeStyle = COLOR.border;
  ctx.lineWidth   = 2;
  ctx.strokeRect(x0, y0, rW, rH);

  // Stirrup
  const inset = cc * scale;
  ctx.strokeStyle = COLOR.stirrup;
  ctx.lineWidth   = Math.max(1.5, ds * scale * 0.4);
  ctx.strokeRect(x0 + inset, y0 + inset, rW - 2 * inset, rH - 2 * inset);

  // Bars
  const barRad = Math.max((db / 2) * scale, 4);
  ctx.fillStyle = COLOR.bar;

  if (layers === 1) {
    _barRow(ctx, n, x0, y0 + rH - inset - barRad, rW, inset, barRad);
  } else {
    const rowGap = (db + 25) * scale;
    const yBot   = y0 + rH - inset - barRad;
    _barRow(ctx, Math.ceil(n / 2),  x0, yBot,          rW, inset, barRad);
    _barRow(ctx, Math.floor(n / 2), x0, yBot - rowGap, rW, inset, barRad);
  }

  if (np > 0) {
    _barRow(ctx, np, x0, y0 + inset + barRad, rW, inset, barRad);
  }

  // Labels
  ctx.fillStyle = COLOR.text;
  ctx.font      = "bold 11px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillText(`b = ${b}`, W / 2, y0 - 10);
  ctx.save();
  ctx.translate(x0 - 14, y0 + rH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`h = ${h}`, 0, 0);
  ctx.restore();
}

function _barRow(ctx, count, x0, yPos, width, inset, radius) {
  const avail = width - 2 * inset - 2 * radius;
  for (let i = 0; i < count; i++) {
    const cx = x0 + inset + radius + (count > 1 ? (i * avail) / (count - 1) : avail / 2);
    ctx.beginPath(); ctx.arc(cx, yPos, radius, 0, 2 * Math.PI); ctx.fill();
  }
}

// =============================================================================
// COLUMN SECTION
// =============================================================================

/**
 * @param {string} canvasId
 * @param {string} shape  "rect" | "circ"
 * @param {number} b      Width (mm)
 * @param {number} h      Depth (mm)
 * @param {number} D      Diameter (mm)
 * @param {number} cc     Cover (mm)
 * @param {number} nb     Total bars
 * @param {number} db     Bar Ø (mm)
 */
function drawColSection(canvasId, shape, b, h, D, cc, nb, db) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2;
  const PAD = 20;

  if (shape === "rect") {
    const scale = Math.min((W - 2 * PAD) / b, (H - 2 * PAD) / h);
    const rw = b * scale, rh = h * scale;
    const inset = cc * scale;
    const barRad = Math.max((db / 2) * scale, 4);

    ctx.fillStyle   = COLOR.concrete;
    ctx.fillRect(cx - rw / 2, cy - rh / 2, rw, rh);
    ctx.strokeStyle = COLOR.border; ctx.lineWidth = 2;
    ctx.strokeRect(cx - rw / 2, cy - rh / 2, rw, rh);

    ctx.strokeStyle = COLOR.stirrup; ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - rw/2 + inset, cy - rh/2 + inset, rw - 2*inset, rh - 2*inset);

    ctx.fillStyle = COLOR.bar;
    const bx = rw / 2 - inset - barRad;
    const by = rh / 2 - inset - barRad;
    [[cx-bx,cy-by],[cx+bx,cy-by],[cx+bx,cy+by],[cx-bx,cy+by]].forEach(([x,y]) => {
      ctx.beginPath(); ctx.arc(x, y, barRad, 0, 2*Math.PI); ctx.fill();
    });
  } else {
    const scale  = (Math.min(W, H) - 2 * PAD) / D;
    const rad    = D * scale / 2;
    const inset  = cc * scale;
    const barRad = Math.max((db / 2) * scale, 4);
    const ring   = rad - inset - barRad;

    ctx.fillStyle   = COLOR.concrete;
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 2*Math.PI); ctx.fill();
    ctx.strokeStyle = COLOR.border; ctx.lineWidth = 2; ctx.stroke();

    ctx.strokeStyle = COLOR.stirrup; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, rad - inset, 0, 2*Math.PI); ctx.stroke();

    ctx.fillStyle = COLOR.bar;
    for (let i = 0; i < nb; i++) {
      const ang = (i / nb) * 2 * Math.PI - Math.PI / 2;
      ctx.beginPath(); ctx.arc(cx + Math.cos(ang)*ring, cy + Math.sin(ang)*ring, barRad, 0, 2*Math.PI); ctx.fill();
    }
  }
}

// =============================================================================
// P-M INTERACTION CURVE
// =============================================================================

/**
 * @param {string} canvasId
 * @param {Array<{x:number,y:number}>} points  φMn (kNm) vs φPn (kN)
 * @param {number} Mu  Demand moment (kNm)
 * @param {number} Pu  Demand axial (kN)
 */
function drawPMCurve(canvasId, points, Mu, Pu) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const m  = { top:20, right:16, bottom:36, left:50 };
  const pW = W - m.left - m.right;
  const pH = H - m.top  - m.bottom;

  // FIX-02: only plot points with Pn ≥ 0 (tension half not shown on standard diagram)
  const valid = points.filter(p => isFinite(p.x) && isFinite(p.y) && p.y >= 0);
  if (!valid.length) return;

  const maxX = Math.max(...valid.map(p => p.x), Math.abs(Mu)) * 1.28 || 1;
  const maxY = Math.max(...valid.map(p => p.y), Pu)            * 1.20 || 1;

  const toC = (x, y) => ({
    px: m.left  + (Math.max(0, x) / maxX) * pW,
    py: m.top   + pH - (Math.max(0, y) / maxY) * pH,
  });

  // --- Grid ---
  ctx.strokeStyle = COLOR.grid; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const {px} = toC(maxX / 4 * i, 0);
    const {py} = toC(0, maxY / 4 * i);
    ctx.beginPath(); ctx.moveTo(px, m.top);   ctx.lineTo(px, m.top + pH);  ctx.stroke();
    ctx.beginPath(); ctx.moveTo(m.left, py);  ctx.lineTo(m.left + pW, py); ctx.stroke();
  }

  // --- Axes ---
  ctx.strokeStyle = COLOR.axis; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(m.left, m.top); ctx.lineTo(m.left, m.top + pH); ctx.lineTo(m.left + pW, m.top + pH);
  ctx.stroke();

  // FIX-02: set clip region so nothing draws outside plot area
  ctx.save();
  ctx.beginPath();
  ctx.rect(m.left, m.top, pW, pH);
  ctx.clip();

  // --- Capacity fill under curve ---
  ctx.beginPath();
  valid.forEach((p, i) => { const {px,py} = toC(p.x, p.y); i===0?ctx.moveTo(px,py):ctx.lineTo(px,py); });
  // Close back to origin along x-axis
  const {px: lastPx} = toC(valid[valid.length - 1].x, 0);
  const {py: basePy} = toC(0, 0);
  ctx.lineTo(lastPx, basePy);
  ctx.lineTo(m.left, basePy);
  ctx.closePath();
  ctx.fillStyle = "rgba(39,174,96,0.09)"; ctx.fill();

  // --- Capacity curve line ---
  ctx.beginPath();
  valid.forEach((p, i) => { const {px,py} = toC(p.x, p.y); i===0?ctx.moveTo(px,py):ctx.lineTo(px,py); });
  ctx.strokeStyle = "#27ae60"; ctx.lineWidth = 2.5; ctx.lineJoin = "round"; ctx.stroke();

  // --- Demand point ---
  const {px:dpx, py:dpy} = toC(Math.abs(Mu), Pu);
  ctx.beginPath(); ctx.arc(dpx, dpy, 6, 0, 2*Math.PI);
  ctx.fillStyle = COLOR.point; ctx.fill();
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke();

  ctx.restore(); // release clip

  // --- Axis labels ---
  ctx.fillStyle = COLOR.text; ctx.font = "bold 10px 'Courier New',monospace"; ctx.textAlign = "center";
  ctx.fillText("Mn (kNm)", m.left + pW / 2, H - 4);
  ctx.save(); ctx.translate(12, m.top + pH / 2); ctx.rotate(-Math.PI/2);
  ctx.fillText("Pn (kN)", 0, 0); ctx.restore();

  // --- Tick values ---
  ctx.font = "9px 'Courier New',monospace"; ctx.fillStyle = "#999";
  for (let i = 0; i <= 4; i++) {
    const {px} = toC(maxX/4*i, 0); const {py} = toC(0, maxY/4*i);
    ctx.textAlign = "center"; ctx.fillText((maxX/4*i).toFixed(0), px, m.top+pH+14);
    ctx.textAlign = "right";  ctx.fillText((maxY/4*i).toFixed(0), m.left-4, py+3);
  }
}

// =============================================================================
// SLAB SECTION (FIX-03)
// =============================================================================

/**
 * Draws a slab cross-section showing thickness, cover, bar layer,
 * and key dimension callouts.
 *
 * @param {string} canvasId  - Target <canvas> ID.
 * @param {number} h         - Slab thickness (mm).
 * @param {number} db        - Bar diameter (mm).
 * @param {number} cover     - Clear cover (mm).
 * @param {number} spacing   - Bar spacing (mm) — used in label only.
 * @param {number} spanMm    - Span in mm — used in label only.
 */
function drawSlabSection(canvasId, h, db, cover, spacing, spanMm) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx  = canvas.getContext("2d");
  const W    = canvas.width;
  const H    = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Layout constants
  const PAD_H  = 48;   // horizontal padding (room for dim arrows)
  const PAD_V  = 36;   // vertical padding
  const slabW  = W - 2 * PAD_H;
  const SCALE  = Math.min((H - 2 * PAD_V) / h, slabW / 1200);
  const slabPx = Math.min(slabW, 1200 * SCALE);  // drawn width
  const slabHpx = h * SCALE;

  const x0 = (W - slabPx) / 2;
  const y0 = (H - slabHpx) / 2;

  // --- Concrete body ---
  ctx.fillStyle   = COLOR.concrete;
  ctx.fillRect(x0, y0, slabPx, slabHpx);
  ctx.strokeStyle = COLOR.border;
  ctx.lineWidth   = 1.5;
  ctx.strokeRect(x0, y0, slabPx, slabHpx);

  // --- Hatch pattern on concrete (cross-section convention) ---
  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.lineWidth   = 1;
  const HATCH = 14;
  for (let hx = x0; hx < x0 + slabPx; hx += HATCH) {
    ctx.beginPath(); ctx.moveTo(hx, y0); ctx.lineTo(hx + slabHpx, y0 + slabHpx); ctx.stroke();
  }
  ctx.restore();

  // --- Cover zone indicator ---
  const coverPx = cover * SCALE;
  const barRad  = Math.max((db / 2) * SCALE, 4);
  const barY    = y0 + slabHpx - coverPx - barRad;

  // Dotted cover line
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "rgba(41,128,185,0.5)";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(x0, barY + barRad + coverPx);
  ctx.lineTo(x0 + slabPx, barY + barRad + coverPx);
  ctx.stroke();
  ctx.setLineDash([]);

  // --- Reinforcing bars (evenly spaced across width) ---
  const barCount   = Math.max(3, Math.min(8, Math.floor(slabPx / Math.max(spacing * SCALE, 30))));
  const barSpacePx = slabPx / (barCount + 1);

  ctx.fillStyle = COLOR.bar;
  for (let i = 1; i <= barCount; i++) {
    const bx = x0 + i * barSpacePx;
    ctx.beginPath();
    ctx.arc(bx, barY, barRad, 0, 2 * Math.PI);
    ctx.fill();
  }

  // --- Dimension lines ---
  ctx.strokeStyle = "#555";
  ctx.fillStyle   = "#555";
  ctx.lineWidth   = 1;
  ctx.font        = "bold 10px 'Courier New', monospace";
  ctx.textAlign   = "right";

  // Height arrow (left side)
  const arrowX = x0 - 14;
  _dimArrow(ctx, arrowX, y0, arrowX, y0 + slabHpx);
  ctx.save();
  ctx.translate(arrowX - 6, y0 + slabHpx / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText(`h = ${h} mm`, 0, 0);
  ctx.restore();

  // Cover dimension (right side small arrow)
  const covX = x0 + slabPx + 14;
  _dimArrow(ctx, covX, barY + barRad, covX, y0 + slabHpx);
  ctx.textAlign = "left";
  ctx.font      = "9px 'Courier New', monospace";
  ctx.fillStyle = "#2980b9";
  ctx.fillText(`cover=${cover}`, covX + 5, barY + barRad + coverPx / 2 + 3);

  // --- Labels ---
  ctx.fillStyle   = "#333";
  ctx.font        = "bold 10px 'Courier New', monospace";
  ctx.textAlign   = "center";

  // Bar label
  ctx.fillStyle = COLOR.bar;
  ctx.fillText(`${db}mm Ø @ ${spacing}mm`, W / 2, y0 + slabHpx + 18);

  // Span label at top
  ctx.fillStyle = COLOR.text;
  ctx.font      = "9px 'Courier New', monospace";
  if (spanMm > 0) ctx.fillText(`Span = ${(spanMm / 1000).toFixed(2)} m`, W / 2, y0 - 10);
}

/**
 * Internal: draws a dimension arrow between two points.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x1 @param {number} y1  Start point
 * @param {number} x2 @param {number} y2  End point
 */
function _dimArrow(ctx, x1, y1, x2, y2) {
  const TICK = 5;
  ctx.beginPath();
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.stroke();
  // Tick marks
  ctx.beginPath(); ctx.moveTo(x1 - TICK, y1); ctx.lineTo(x1 + TICK, y1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2 - TICK, y2); ctx.lineTo(x2 + TICK, y2); ctx.stroke();
}
// =============================================================================
// FOOTING SECTION — Plan + Elevation side-by-side
// =============================================================================

/**
 * Draws footing plan view (left) and elevation cross-section (right).
 * @param {string} canvasId
 * @param {number} B      Footing width (mm)
 * @param {number} L      Footing length (mm)
 * @param {number} h      Footing depth (mm)
 * @param {number} cc     Clear cover (mm)
 * @param {number} cw     Column width (mm)
 * @param {number} cl     Column length (mm)
 * @param {number} db     Bar diameter (mm)
 * @param {number} d      Effective depth (mm)
 */
function drawFootingSection(canvasId, B, L, h, cc, cw, cl, db, d) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const PAD   = 24;
  const halfW = W / 2 - 4;

  // ---- PLAN VIEW (left half) ----
  const scaleP = Math.min((halfW - 2 * PAD) / B, (H - 2 * PAD) / L);
  const pW = B * scaleP, pH = L * scaleP;
  const px0 = PAD + (halfW - 2 * PAD - pW) / 2;
  const py0 = PAD + (H - 2 * PAD - pH) / 2;

  // Footing outline
  ctx.fillStyle = COLOR.concrete;
  ctx.fillRect(px0, py0, pW, pH);
  ctx.strokeStyle = COLOR.border; ctx.lineWidth = 1.5;
  ctx.strokeRect(px0, py0, pW, pH);

  // Column footprint
  const cpW = cw * scaleP, cpL = cl * scaleP;
  const cpx = px0 + (pW - cpW) / 2, cpy = py0 + (pH - cpL) / 2;
  ctx.fillStyle = "#bbb";
  ctx.fillRect(cpx, cpy, cpW, cpL);
  ctx.strokeStyle = "#666"; ctx.lineWidth = 1;
  ctx.strokeRect(cpx, cpy, cpW, cpL);

  // Rebar grid (plan) — show as dots
  const barR = Math.max(2, db * scaleP * 0.35);
  ctx.fillStyle = COLOR.bar;
  const nL = Math.max(2, Math.min(5, Math.floor(B / 300)));
  const nS = Math.max(2, Math.min(5, Math.floor(L / 300)));
  const insetP = cc * scaleP;
  for (let i = 0; i < nL; i++) {
    const bx = px0 + insetP + (pW - 2 * insetP) * i / (nL - 1);
    ctx.beginPath(); ctx.arc(bx, py0 + pH / 2, barR, 0, 2 * Math.PI); ctx.fill();
  }
  for (let j = 0; j < nS; j++) {
    const by = py0 + insetP + (pH - 2 * insetP) * j / (nS - 1);
    ctx.beginPath(); ctx.arc(px0 + pW / 2, by, barR, 0, 2 * Math.PI); ctx.fill();
  }

  // Plan label
  ctx.fillStyle = COLOR.text; ctx.font = "bold 10px 'Courier New',monospace";
  ctx.textAlign = "center";
  ctx.fillText("PLAN", px0 + pW / 2, py0 - 8);
  ctx.font = "9px 'Courier New',monospace";
  ctx.fillText(`B=${B}`, px0 + pW / 2, py0 + pH + 14);
  ctx.save();
  ctx.translate(px0 - 12, py0 + pH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`L=${L}`, 0, 0);
  ctx.restore();

  // Divider
  ctx.strokeStyle = "#ddd"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(W / 2, PAD); ctx.lineTo(W / 2, H - PAD); ctx.stroke();

  // ---- ELEVATION (right half) ----
  const ex0 = W / 2 + 4;
  const scaleE = Math.min((halfW - 2 * PAD) / B, (H - 2 * PAD) / (h + 60));
  const eW = B * scaleE, eH = h * scaleE;
  const ex = ex0 + PAD + (halfW - 2 * PAD - eW) / 2;
  const ey = PAD + 30 + (H - 2 * PAD - 30 - eH) / 2;

  // Column stub above footing
  const ecpW = cw * scaleE;
  const ecH  = Math.min(30, H * 0.15);
  ctx.fillStyle = "#bbb";
  ctx.fillRect(ex + (eW - ecpW) / 2, ey - ecH, ecpW, ecH);
  ctx.strokeStyle = "#666"; ctx.lineWidth = 1;
  ctx.strokeRect(ex + (eW - ecpW) / 2, ey - ecH, ecpW, ecH);

  // Footing body
  ctx.fillStyle = COLOR.concrete;
  ctx.fillRect(ex, ey, eW, eH);
  ctx.strokeStyle = COLOR.border; ctx.lineWidth = 1.5;
  ctx.strokeRect(ex, ey, eW, eH);

  // Hatch
  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.07)"; ctx.lineWidth = 1;
  const hatchGap = 12;
  for (let hx = ex; hx < ex + eW; hx += hatchGap) {
    ctx.beginPath(); ctx.moveTo(hx, ey); ctx.lineTo(hx + eH, ey + eH); ctx.stroke();
  }
  ctx.restore();

  // Bottom rebar row
  const barRadE = Math.max(2.5, db * scaleE * 0.4);
  const barYe   = ey + eH - cc * scaleE - barRadE;
  ctx.fillStyle = COLOR.bar;
  const nBarsE  = Math.max(3, Math.min(6, Math.floor(B / 250)));
  const insetE  = cc * scaleE;
  for (let i = 0; i < nBarsE; i++) {
    const bx = ex + insetE + (eW - 2 * insetE) * i / (nBarsE - 1);
    ctx.beginPath(); ctx.arc(bx, barYe, barRadE, 0, 2 * Math.PI); ctx.fill();
  }

  // Cover dotted line
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = "rgba(41,128,185,0.5)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(ex, barYe + barRadE + cc * scaleE);
  ctx.lineTo(ex + eW, barYe + barRadE + cc * scaleE); ctx.stroke();
  ctx.setLineDash([]);

  // Dimension labels
  ctx.fillStyle = COLOR.text; ctx.font = "bold 10px 'Courier New',monospace";
  ctx.textAlign = "center";
  ctx.fillText("ELEVATION", ex + eW / 2, ey - ecH - 8);
  ctx.font = "9px 'Courier New',monospace";
  ctx.fillText(`B=${B}`, ex + eW / 2, ey + eH + 14);
  ctx.fillStyle = "#2980b9";
  ctx.fillText(`cc=${cc}`, ex + eW + 28, barYe + cc * scaleE / 2 + 3);
  ctx.fillStyle = COLOR.text;
  ctx.save();
  ctx.translate(ex + eW + 14, ey + eH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`h=${h}`, 0, 0);
  ctx.restore();
}