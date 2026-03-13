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