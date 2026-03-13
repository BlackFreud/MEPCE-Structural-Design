/**
 * @file canvas.js
 * @description All HTML5 Canvas drawing routines:
 *              - Beam cross-section (singly & doubly reinforced)
 *              - Column cross-section (rectangular & circular)
 *              - P-M Interaction Curve
 * @module canvas
 */

"use strict";

// ---------------------------------------------------------------------------
// THEME COLORS (mirrors CSS variables for canvas use)
// ---------------------------------------------------------------------------
const COLOR = {
  concrete:  "#d8d5cf",
  stirrup:   "#2980b9",
  bar:       "#c0392b",
  axis:      "#444",
  curve:     "#27ae60",
  point:     "#c0392b",
  text:      "#555",
  border:    "#888",
  gridLine:  "#e8e8e8",
};

// ---------------------------------------------------------------------------
// BEAM SECTION
// ---------------------------------------------------------------------------

/**
 * Draws a beam cross-section schematic on a canvas element.
 * Shows concrete outline, stirrup rectangle, tension bars (1 or 2 layers),
 * and optional compression bars at the top.
 *
 * @param {string} canvasId - ID of the target <canvas> element.
 * @param {number} b        - Beam width (mm).
 * @param {number} h        - Beam overall depth (mm).
 * @param {number} cc       - Clear cover to stirrup (mm).
 * @param {number} n        - Number of tension bars.
 * @param {number} np       - Number of compression bars (0 = singly reinforced).
 * @param {number} db       - Tension bar diameter (mm).
 * @param {number} ds       - Stirrup bar diameter (mm).
 * @param {number} layers   - Number of tension bar layers (1 or 2).
 */
function drawBeamSection(canvasId, b, h, cc, n, np, db, ds, layers) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const PAD = 24;
  const scale = Math.min((W - 2 * PAD) / b, (H - 2 * PAD) / h);
  const rectW = b * scale;
  const rectH = h * scale;
  const x0 = (W - rectW) / 2;
  const y0 = (H - rectH) / 2;

  // --- Concrete body ---
  ctx.fillStyle = COLOR.concrete;
  ctx.fillRect(x0, y0, rectW, rectH);
  ctx.strokeStyle = COLOR.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(x0, y0, rectW, rectH);

  // --- Stirrup rectangle ---
  const inset = cc * scale;
  ctx.strokeStyle = COLOR.stirrup;
  ctx.lineWidth = Math.max(1, ds * scale * 0.5);
  ctx.strokeRect(x0 + inset, y0 + inset, rectW - 2 * inset, rectH - 2 * inset);

  // --- Tension bars ---
  const barRad = Math.max((db / 2) * scale, 4);
  ctx.fillStyle = COLOR.bar;

  if (layers === 1) {
    _drawBarRow(ctx, n, x0, y0 + rectH - inset - barRad, rectW, inset, barRad);
  } else {
    // Two-layer: place row 1 at bottom, row 2 one bar-diameter + 25 mm gap above
    const row1Y = y0 + rectH - inset - barRad;
    const rowGap = (db + 25) * scale;
    const n1 = Math.ceil(n / 2);
    const n2 = Math.floor(n / 2);
    _drawBarRow(ctx, n1, x0, row1Y,           rectW, inset, barRad);
    _drawBarRow(ctx, n2, x0, row1Y - rowGap,  rectW, inset, barRad);
  }

  // --- Compression bars (doubly reinforced) ---
  if (np > 0) {
    const yTop = y0 + inset + barRad;
    _drawBarRow(ctx, np, x0, yTop, rectW, inset, barRad);
  }

  // --- Dimension labels ---
  ctx.fillStyle = COLOR.text;
  ctx.font = "bold 11px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillText(`b = ${b} mm`, W / 2, y0 - 8);
  ctx.save();
  ctx.translate(x0 - 10, y0 + rectH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`h = ${h} mm`, 0, 0);
  ctx.restore();
}

/**
 * Internal helper — draws a horizontal row of evenly-spaced circular bars.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} count   - Number of bars.
 * @param {number} x0      - Left edge of beam outline.
 * @param {number} yPos    - Centroid Y of bar row.
 * @param {number} width   - Full beam width (scaled).
 * @param {number} inset   - Cover inset (scaled).
 * @param {number} radius  - Bar radius (scaled).
 */
function _drawBarRow(ctx, count, x0, yPos, width, inset, radius) {
  const availW = width - 2 * inset - 2 * radius;
  for (let i = 0; i < count; i++) {
    const cx =
      x0 + inset + radius + (count > 1 ? (i * availW) / (count - 1) : availW / 2);
    ctx.beginPath();
    ctx.arc(cx, yPos, radius, 0, 2 * Math.PI);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// COLUMN SECTION
// ---------------------------------------------------------------------------

/**
 * Draws a column cross-section schematic (rectangular or circular).
 *
 * @param {string} canvasId - ID of the target <canvas> element.
 * @param {string} shape    - "rect" or "circ".
 * @param {number} b        - Width (mm) — rectangular only.
 * @param {number} h        - Depth (mm) — rectangular only.
 * @param {number} D        - Diameter (mm) — circular only.
 * @param {number} cc       - Clear cover (mm).
 * @param {number} nb       - Total number of longitudinal bars.
 * @param {number} db       - Bar diameter (mm).
 */
function drawColSection(canvasId, shape, b, h, D, cc, nb, db) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const PAD = 20;
  const cx = W / 2;
  const cy = H / 2;

  if (shape === "rect") {
    const scale = Math.min((W - 2 * PAD) / b, (H - 2 * PAD) / h);
    const rw = b * scale;
    const rh = h * scale;
    const inset = cc * scale;
    const barRad = Math.max((db / 2) * scale, 4);

    // Concrete
    ctx.fillStyle = COLOR.concrete;
    ctx.fillRect(cx - rw / 2, cy - rh / 2, rw, rh);
    ctx.strokeStyle = COLOR.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - rw / 2, cy - rh / 2, rw, rh);

    // Tie
    ctx.strokeStyle = COLOR.stirrup;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      cx - rw / 2 + inset, cy - rh / 2 + inset,
      rw - 2 * inset, rh - 2 * inset
    );

    // Bars — schematic corners + intermediate per face
    ctx.fillStyle = COLOR.bar;
    const bx = rw / 2 - inset - barRad;
    const by = rh / 2 - inset - barRad;
    const corners = [
      [cx - bx, cy - by], [cx + bx, cy - by],
      [cx + bx, cy + by], [cx - bx, cy + by],
    ];
    corners.forEach(([x, y]) => {
      ctx.beginPath(); ctx.arc(x, y, barRad, 0, 2 * Math.PI); ctx.fill();
    });

  } else {
    // Circular column
    const scale = (Math.min(W, H) - 2 * PAD) / D;
    const rad = (D * scale) / 2;
    const inset = cc * scale;
    const barRad = Math.max((db / 2) * scale, 4);
    const ringRad = rad - inset - barRad;

    // Concrete circle
    ctx.fillStyle = COLOR.concrete;
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 2 * Math.PI); ctx.fill();
    ctx.strokeStyle = COLOR.border; ctx.lineWidth = 2; ctx.stroke();

    // Spiral / tie ring
    ctx.strokeStyle = COLOR.stirrup; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, rad - inset, 0, 2 * Math.PI); ctx.stroke();

    // Bars equally spaced on ring
    ctx.fillStyle = COLOR.bar;
    for (let i = 0; i < nb; i++) {
      const ang = (i / nb) * 2 * Math.PI - Math.PI / 2;
      const bx = cx + Math.cos(ang) * ringRad;
      const by = cy + Math.sin(ang) * ringRad;
      ctx.beginPath(); ctx.arc(bx, by, barRad, 0, 2 * Math.PI); ctx.fill();
    }
  }
}

// ---------------------------------------------------------------------------
// P-M INTERACTION CURVE
// ---------------------------------------------------------------------------

/**
 * Plots a P-M interaction diagram on a canvas element.
 * Draws axes, capacity curve, grid lines, and marks the design load point.
 *
 * @param {string} canvasId - ID of the target <canvas> element.
 * @param {Array<{x: number, y: number}>} points - Array of {x: Mn (kNm), y: Pn (kN)} curve points.
 * @param {number} Mu - Design moment (kNm) to plot as demand point.
 * @param {number} Pu - Design axial load (kN) to plot as demand point.
 */
function drawPMCurve(canvasId, points, Mu, Pu) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const margin = { top: 20, right: 20, bottom: 36, left: 48 };
  const plotW = W - margin.left - margin.right;
  const plotH = H - margin.top - margin.bottom;

  const validPts = points.filter(p => isFinite(p.x) && isFinite(p.y));
  if (!validPts.length) return;

  const maxX = Math.max(...validPts.map(p => p.x), Math.abs(Mu)) * 1.25;
  const maxY = Math.max(...validPts.map(p => p.y), Pu) * 1.20;

  /** Maps data coords → canvas coords */
  const toCanvas = (x, y) => ({
    px: margin.left + (x / maxX) * plotW,
    py: margin.top + plotH - (y / maxY) * plotH,
  });

  // --- Grid lines ---
  ctx.strokeStyle = COLOR.gridLine;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const { px } = toCanvas((maxX / 4) * i, 0);
    const { py } = toCanvas(0, (maxY / 4) * i);
    ctx.beginPath(); ctx.moveTo(px, margin.top); ctx.lineTo(px, margin.top + plotH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(margin.left, py); ctx.lineTo(margin.left + plotW, py); ctx.stroke();
  }

  // --- Axes ---
  ctx.strokeStyle = COLOR.axis;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, margin.top + plotH);
  ctx.lineTo(margin.left + plotW, margin.top + plotH);
  ctx.stroke();

  // --- Capacity curve ---
  ctx.beginPath();
  validPts.forEach((p, i) => {
    const { px, py } = toCanvas(p.x, p.y);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  });
  ctx.strokeStyle = COLOR.curve;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.stroke();

  // Light fill under curve
  ctx.beginPath();
  validPts.forEach((p, i) => {
    const { px, py } = toCanvas(p.x, p.y);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  });
  const { px: lastPx } = toCanvas(validPts[validPts.length - 1].x, 0);
  const { py: basePy } = toCanvas(0, 0);
  ctx.lineTo(lastPx, basePy);
  ctx.lineTo(margin.left, basePy);
  ctx.closePath();
  ctx.fillStyle = "rgba(39,174,96,0.08)";
  ctx.fill();

  // --- Demand point ---
  const { px: dpx, py: dpy } = toCanvas(Math.abs(Mu), Pu);
  ctx.beginPath();
  ctx.arc(dpx, dpy, 6, 0, 2 * Math.PI);
  ctx.fillStyle = COLOR.point;
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // --- Axis labels ---
  ctx.fillStyle = COLOR.text;
  ctx.font = "bold 10px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillText("Mn (kNm)", margin.left + plotW / 2, H - 4);
  ctx.save();
  ctx.translate(12, margin.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Pn (kN)", 0, 0);
  ctx.restore();

  // --- Axis tick values ---
  ctx.font = "9px 'Courier New', monospace";
  ctx.fillStyle = "#888";
  for (let i = 0; i <= 4; i++) {
    const xVal = (maxX / 4) * i;
    const yVal = (maxY / 4) * i;
    const { px } = toCanvas(xVal, 0);
    const { py } = toCanvas(0, yVal);
    ctx.textAlign = "center";
    ctx.fillText(xVal.toFixed(0), px, margin.top + plotH + 14);
    ctx.textAlign = "right";
    ctx.fillText(yVal.toFixed(0), margin.left - 4, py + 3);
  }
}