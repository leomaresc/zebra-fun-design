import type { BarcodeElement, Doc, ImageElement, LabelElement, TextElement } from "../types";
import { fontDef, layoutText } from "../zpl/fonts";
import { barcodeRender, barcodeHumanText, barcodeTextHeight } from "../zpl/barcode";
import { getProcessed } from "./image";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function textDrawTop(el: TextElement): number {
  const layout = layoutText(el);
  if (el.origin !== "FT") return el.y;
  const def = fontDef(el.font);
  const baseline = el.h * def.baseline;
  const spacing = el.block ? el.block.spacing : 0;
  return el.y - (layout.lines.length - 1) * (el.h + spacing) - baseline;
}

function rotatedBox(x: number, y: number, w: number, h: number, rotation: string): Box {
  if (rotation === "R" || rotation === "B") return { x, y, w: h, h: w };
  return { x, y, w, h };
}

export function boundsOf(el: LabelElement): Box {
  switch (el.type) {
    case "text": {
      const layout = layoutText(el);
      const w = Math.max(layout.width, el.w * (el.text ? 1 : 3));
      const h = Math.max(layout.height, el.h);
      return rotatedBox(el.x, textDrawTop(el), w, h, el.rotation);
    }
    case "box":
      return { x: el.x, y: el.y, w: el.width, h: el.height };
    case "line":
      return el.orientation === "h"
        ? { x: el.x, y: el.y, w: el.length, h: el.thickness }
        : { x: el.x, y: el.y, w: el.thickness, h: el.length };
    case "circle":
      return { x: el.x, y: el.y, w: el.diameter, h: el.diameter };
    case "ellipse":
      return { x: el.x, y: el.y, w: el.width, h: el.height };
    case "diagonal":
      return { x: el.x, y: el.y, w: el.width, h: el.height };
    case "barcode": {
      const r = barcodeRender(el);
      const textH = r.error ? 0 : barcodeTextHeight(el);
      return rotatedBox(el.x, el.y, Math.max(1, r.width), Math.max(1, r.height + textH), el.rotation);
    }
    case "image":
      return { x: el.x, y: el.y, w: el.width, h: el.height };
    default:
      return { x: 0, y: 0, w: 1, h: 1 };
  }
}

export function hitTest(doc: Doc, x: number, y: number): LabelElement | null {
  for (let i = doc.elements.length - 1; i >= 0; i--) {
    const el = doc.elements[i];
    const b = boundsOf(el);
    if (x >= b.x - 2 && x <= b.x + b.w + 2 && y >= b.y - 2 && y <= b.y + b.h + 2) return el;
  }
  return null;
}

interface DrawOptions {
  zoom: number;
  showGrid: boolean;
  exporting?: boolean;
  editingId?: string | null;
  errorIds?: Set<string>;
}

export function drawLabel(ctx: CanvasRenderingContext2D, doc: Doc, opts: DrawOptions): void {
  const { zoom } = opts;
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, doc.widthDots, doc.heightDots);

  if (opts.showGrid && zoom >= 0.28) {
    const step = 20;
    ctx.save();
    ctx.fillStyle = "rgba(20, 22, 30, 0.10)";
    const dot = Math.max(0.6, 1 / zoom);
    for (let gx = step; gx < doc.widthDots; gx += step) {
      for (let gy = step; gy < doc.heightDots; gy += step) {
        ctx.fillRect(gx - dot / 2, gy - dot / 2, dot, dot);
      }
    }
    ctx.restore();
  }

  for (const el of doc.elements) {
    if (el.id === opts.editingId) continue;
    drawElement(ctx, el, opts);
  }
  ctx.restore();
}

function applyRotation(ctx: CanvasRenderingContext2D, el: LabelElement, w: number, h: number, top: number): void {
  ctx.translate(el.x, top);
  switch (el.rotation) {
    case "R":
      ctx.translate(h, 0);
      ctx.rotate(Math.PI / 2);
      break;
    case "I":
      ctx.translate(w, h);
      ctx.rotate(Math.PI);
      break;
    case "B":
      ctx.translate(0, w);
      ctx.rotate(-Math.PI / 2);
      break;
    default:
      break;
  }
}

export function drawElement(ctx: CanvasRenderingContext2D, el: LabelElement, opts: DrawOptions): void {
  ctx.save();
  switch (el.type) {
    case "text":
      drawText(ctx, el, opts);
      break;
    case "box":
      drawBox(ctx, el);
      break;
    case "line": {
      const w = el.orientation === "h" ? el.length : el.thickness;
      const h = el.orientation === "h" ? el.thickness : el.length;
      ctx.fillStyle = el.color === "W" ? "#ffffff" : "#000000";
      ctx.fillRect(el.x, el.y, Math.max(1, w), Math.max(1, h));
      break;
    }
    case "circle": {
      const d = Math.max(3, el.diameter);
      const t = Math.max(1, el.thickness);
      ctx.beginPath();
      ctx.arc(el.x + d / 2, el.y + d / 2, Math.max(0.5, (d - t) / 2), 0, Math.PI * 2);
      if (t >= d) {
        ctx.fillStyle = el.color === "W" ? "#ffffff" : "#000000";
        ctx.fill();
      } else {
        ctx.strokeStyle = el.color === "W" ? "#ffffff" : "#000000";
        ctx.lineWidth = t;
        ctx.stroke();
      }
      break;
    }
    case "ellipse": {
      const w = Math.max(3, el.width);
      const h = Math.max(3, el.height);
      const t = Math.max(1, el.thickness);
      ctx.beginPath();
      ctx.ellipse(el.x + w / 2, el.y + h / 2, Math.max(0.5, (w - t) / 2), Math.max(0.5, (h - t) / 2), 0, 0, Math.PI * 2);
      if (t >= Math.min(w, h)) {
        ctx.fillStyle = el.color === "W" ? "#ffffff" : "#000000";
        ctx.fill();
      } else {
        ctx.strokeStyle = el.color === "W" ? "#ffffff" : "#000000";
        ctx.lineWidth = t;
        ctx.stroke();
      }
      break;
    }
    case "diagonal": {
      ctx.strokeStyle = el.color === "W" ? "#ffffff" : "#000000";
      ctx.lineWidth = Math.max(1, el.thickness);
      ctx.beginPath();
      if (el.slash) {
        ctx.moveTo(el.x, el.y + el.height);
        ctx.lineTo(el.x + el.width, el.y);
      } else {
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(el.x + el.width, el.y + el.height);
      }
      ctx.stroke();
      break;
    }
    case "barcode":
      drawBarcode(ctx, el, opts);
      break;
    case "image":
      drawImage(ctx, el, opts);
      break;
  }
  ctx.restore();
}

/** Grosor de la doble pasada de negrita (dots). */
export function textBoldOffset(h: number): number {
  return Math.max(1, Math.round(h * 0.06));
}

/** Grosor y separación del subrayado (dots). */
export function textUnderlineThickness(h: number): number {
  return Math.max(1, Math.round(h * 0.06));
}
export function textUnderlineGap(h: number): number {
  return Math.max(2, Math.round(h * 0.14));
}

function drawText(ctx: CanvasRenderingContext2D, el: TextElement, opts: DrawOptions): void {
  const layout = layoutText(el);
  const def = fontDef(el.font);
  const h = Math.max(1, el.h);
  const w = Math.max(1, el.w);
  const top = textDrawTop(el);
  const spacing = el.block ? el.block.spacing : 0;
  const ink = el.reverse ? "#ffffff" : "#000000";

  const naturalW = Math.max(layout.width, w * (el.text ? 1 : 3));
  const naturalH = Math.max(layout.height, h);

  ctx.save();
  applyRotation(ctx, el, naturalW, naturalH, top);

  // ^FR invierte toda el área del campo: hay que pintar el fondo.
  if (el.reverse && el.text) {
    const bgW = el.block ? Math.max(el.block.width, naturalW) : naturalW;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, bgW, naturalH);
  }

  ctx.fillStyle = ink;
  ctx.textBaseline = "alphabetic";

  const boldDx = el.bold ? textBoldOffset(h) : 0;
  const skew = el.italic ? -0.18 : 0;
  const underlineT = textUnderlineThickness(h);
  const underlineDy = textUnderlineGap(h);

  layout.lines.forEach((line, lineIndex) => {
    const lineW = layout.lineWidths[lineIndex] ?? 0;
    let startX = 0;
    if (el.block) {
      const bw = el.block.width;
      if (el.block.align === "C") startX = Math.max(0, (bw - lineW) / 2);
      else if (el.block.align === "R") startX = Math.max(0, bw - lineW);
      else if (el.block.align === "J" && lineIndex < layout.lines.length - 1) startX = 0;
      if (lineIndex > 0) startX += el.block.indent;
    }
    const baselineY = lineIndex * (h + spacing) + h * def.baseline;

    const pass = (dx: number) => {
      ctx.save();
      if (dx) ctx.translate(dx, 0);
      if (skew) {
        // Inclinación alrededor de la línea base (cursiva).
        ctx.translate(0, baselineY);
        ctx.transform(1, 0, skew, 1, 0, 0);
        ctx.translate(0, -baselineY);
      }
      if (def.mono) {
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === " ") continue;
          const cellX = startX + i * w;
          ctx.save();
          ctx.translate(cellX + w / 2, baselineY);
          ctx.font = `${def.weight} ${h}px ${def.family}`;
          ctx.textAlign = "center";
          const measured = ctx.measureText(ch).width;
          const scale = measured > w * 0.94 ? (w * 0.94) / measured : 1;
          if (scale !== 1) ctx.scale(scale, 1);
          ctx.fillText(ch, 0, 0);
          ctx.restore();
        }
      } else {
        ctx.save();
        ctx.translate(startX, 0);
        ctx.scale(w / h, 1);
        ctx.font = `${def.weight} ${h}px ${def.family}`;
        ctx.textAlign = "left";
        ctx.fillText(line, 0, baselineY);
        ctx.restore();
      }
      ctx.restore();
    };

    pass(0);
    if (boldDx) pass(boldDx);

    if (el.underline && lineW > 0) {
      ctx.fillStyle = ink;
      ctx.fillRect(startX, baselineY + underlineDy, lineW, underlineT);
    }
  });

  if (!el.text && opts.editingId !== el.id) {
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(0.5, 0.5, Math.max(w * 3, 20), h);
  }
  ctx.restore();
}

function drawBox(ctx: CanvasRenderingContext2D, el: Extract<LabelElement, { type: "box" }>): void {
  const color = el.color === "W" ? "#ffffff" : "#000000";
  const w = Math.max(1, el.width);
  const h = Math.max(1, el.height);
  const t = Math.max(1, el.thickness);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;

  if (t >= Math.min(w, h)) {
    ctx.fillRect(el.x, el.y, w, h);
    return;
  }

  const radius = (el.rounding / 8) * (Math.min(w, h) / 2);
  const inset = t / 2;
  const x = el.x + inset;
  const y = el.y + inset;
  const rw = w - t;
  const rh = h - t;
  ctx.lineWidth = t;
  ctx.beginPath();
  if (radius > 0 && "roundRect" in ctx) {
    (ctx as CanvasRenderingContext2D).roundRect(x, y, Math.max(0.5, rw), Math.max(0.5, rh), Math.max(0, radius - inset));
  } else {
    ctx.rect(x, y, Math.max(0.5, rw), Math.max(0.5, rh));
  }
  ctx.stroke();
}

function drawBarcode(ctx: CanvasRenderingContext2D, el: BarcodeElement, opts: DrawOptions): void {
  const r = barcodeRender(el);
  if (r.error || !r.canvas) {
    if (!opts.exporting) {
      ctx.fillStyle = "rgba(214, 58, 43, 0.10)";
      ctx.fillRect(el.x, el.y, Math.max(80, 160), Math.max(60, el.height));
      ctx.strokeStyle = "rgba(214, 58, 43, 0.7)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(el.x, el.y, Math.max(80, 160), Math.max(60, el.height));
      ctx.setLineDash([]);
      ctx.fillStyle = "#b0261b";
      ctx.font = `600 12px "ZFD Mono", monospace`;
      ctx.fillText("SIN DATOS", el.x + 6, el.y + 20);
    }
    return;
  }

  const textH = barcodeTextHeight(el);
  const is2d = el.symbology === "qrcode" || el.symbology === "datamatrix";
  const barsH = is2d ? Math.max(1, r.height) : Math.max(1, el.height);
  ctx.save();
  applyRotation(ctx, el, Math.max(1, r.width), barsH + textH, el.y);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(r.canvas, 0, 0, r.width, barsH);
  if (el.showText) {
    const text = barcodeHumanText(el);
    const size = Math.max(9, Math.round(textH * 0.86));
    ctx.fillStyle = "#000000";
    ctx.font = `500 ${size}px "ZFD Mono", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, r.width / 2, barsH + textH / 2 + 1, r.width);
  }
  ctx.restore();
}

function drawImage(ctx: CanvasRenderingContext2D, el: ImageElement, opts: DrawOptions): void {
  const img = getProcessed(el);
  if (!img) {
    if (!opts.exporting) {
      ctx.fillStyle = "rgba(20, 22, 30, 0.06)";
      ctx.fillRect(el.x, el.y, el.width, el.height);
      ctx.strokeStyle = "rgba(20, 22, 30, 0.25)";
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(el.x, el.y, el.width, el.height);
      ctx.setLineDash([]);
    }
    return;
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img.canvas, el.x, el.y, el.width, el.height);
}

export function drawSelection(
  ctx: CanvasRenderingContext2D,
  doc: Doc,
  selected: string[],
  zoom: number,
  accent: string,
): void {
  const s = 1 / zoom;
  const boxes: Box[] = [];
  for (const id of selected) {
    const el = doc.elements.find((e) => e.id === id);
    if (el) boxes.push(boundsOf(el));
  }
  ctx.save();
  ctx.lineWidth = 1.5 * s;
  for (const b of boxes) {
    ctx.strokeStyle = accent;
    ctx.setLineDash([]);
    ctx.strokeRect(b.x - 1 * s, b.y - 1 * s, b.w + 2 * s, b.h + 2 * s);
  }
  if (boxes.length === 1) {
    const b = boxes[0];
    const hs = 7 * s;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5 * s;
    const pts: [number, number][] = [
      [b.x, b.y],
      [b.x + b.w, b.y],
      [b.x, b.y + b.h],
      [b.x + b.w, b.y + b.h],
    ];
    for (const [px, py] of pts) {
      ctx.beginPath();
      ctx.rect(px - hs / 2, py - hs / 2, hs, hs);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

export interface Handle {
  id: string;
  x: number;
  y: number;
  corner: "nw" | "ne" | "sw" | "se";
}

export function handlesOf(doc: Doc, selected: string[]): Handle[] {
  if (selected.length !== 1) return [];
  const el = doc.elements.find((e) => e.id === selected[0]);
  if (!el) return [];
  const b = boundsOf(el);
  return [
    { id: el.id, x: b.x, y: b.y, corner: "nw" },
    { id: el.id, x: b.x + b.w, y: b.y, corner: "ne" },
    { id: el.id, x: b.x, y: b.y + b.h, corner: "sw" },
    { id: el.id, x: b.x + b.w, y: b.y + b.h, corner: "se" },
  ];
}

/* ------------------------------------------------------------------ */
/* estilo de texto                                                     */
/* ------------------------------------------------------------------ */

/** Subrayados en coordenadas de la etiqueta (sólo rotación N/I). */
export function textUnderlineRects(el: TextElement): { x: number; y: number; w: number; h: number }[] {
  if (!el.underline) return [];
  const layout = layoutText(el);
  const def = fontDef(el.font);
  const h = Math.max(1, el.h);
  const spacing = el.block ? el.block.spacing : 0;
  const top = textDrawTop(el);
  const t = textUnderlineThickness(h);
  const gap = textUnderlineGap(h);
  const out: { x: number; y: number; w: number; h: number }[] = [];
  layout.lines.forEach((line, i) => {
    const lineW = layout.lineWidths[i] ?? 0;
    if (lineW <= 0) return;
    let startX = 0;
    if (el.block) {
      const bw = el.block.width;
      if (el.block.align === "C") startX = Math.max(0, (bw - lineW) / 2);
      else if (el.block.align === "R") startX = Math.max(0, bw - lineW);
      if (i > 0) startX += el.block.indent;
    }
    const baselineY = i * (h + spacing) + h * def.baseline;
    out.push({
      x: Math.round(el.x + startX),
      y: Math.round(top + baselineY + gap),
      w: Math.max(1, Math.round(lineW)),
      h: t,
    });
  });
  return out;
}

export interface RasterResult {
  bits: Uint8Array;
  bytesPerRow: number;
  width: number;
  height: number;
  x: number;
  y: number;
}

/**
 * Rasteriza un elemento a 1 bit. Se usa para lo que ZPL no sabe dibujar como
 * campo de texto (la cursiva): la impresora recibe exactamente lo que se ve.
 */
export function rasterizeElement(el: LabelElement): RasterResult | null {
  const b = boundsOf(el);
  let pad = 2;
  if (el.type === "text") {
    const h = Math.max(1, el.h);
    if (el.bold) pad += textBoldOffset(h);
    if (el.italic) pad += Math.ceil(h * 0.35);
  }
  const x = Math.round(b.x) - pad;
  const y = Math.round(b.y) - pad;
  const width = Math.ceil(b.w) + pad * 2;
  const height = Math.ceil(b.h) + pad * 2;
  if (!(width > 0) || !(height > 0) || width > 6000 || height > 6000) return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.translate(-x, -y);
  drawElement(ctx, el, { zoom: 1, showGrid: false, exporting: true });
  ctx.restore();

  const px = ctx.getImageData(0, 0, width, height).data;
  const bytesPerRow = Math.ceil(width / 8);
  const bits = new Uint8Array(bytesPerRow * height);
  for (let yy = 0; yy < height; yy++) {
    for (let xx = 0; xx < width; xx++) {
      const i = (yy * width + xx) * 4;
      const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      if (lum < 128) bits[yy * bytesPerRow + (xx >> 3)] |= 0x80 >> (xx & 7);
    }
  }
  return { bits, bytesPerRow, width, height, x, y };
}