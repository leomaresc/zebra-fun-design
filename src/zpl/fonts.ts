import type { TextElement } from "../types";

export interface ZplFontDef {
  key: string;
  name: string;
  /** Base matrix at 203 dpi, dots. */
  baseH: number;
  baseW: number;
  baseline: number; // fraction of height
  mono: boolean;
  family: string;
  weight: number;
  note?: { es: string; en: string };
}

const MONO = '"ZFD Mono", "Cascadia Mono", Consolas, monospace';
const SANS = '"ZFD Sans", "Segoe UI", system-ui, sans-serif';

export const ZPL_FONTS: ZplFontDef[] = [
  {
    key: "0",
    name: "0 · Escalable",
    baseH: 15,
    baseW: 12,
    baseline: 0.8,
    mono: false,
    family: SANS,
    weight: 400,
    note: {
      es: "Fuente escalable. La recomendada para acentos y Unicode.",
      en: "Scalable font. Recommended for accents and Unicode.",
    },
  },
  { key: "A", name: "A · 9×5", baseH: 9, baseW: 5, baseline: 7 / 9, mono: true, family: MONO, weight: 500, note: { es: "Bitmap pequeño. Solo ASCII.", en: "Small bitmap. ASCII only." } },
  { key: "B", name: "B · 11×7", baseH: 11, baseW: 7, baseline: 1, mono: true, family: MONO, weight: 600, note: { es: "Bitmap. Solo ASCII.", en: "Bitmap. ASCII only." } },
  { key: "C", name: "C · 18×10", baseH: 18, baseW: 10, baseline: 14 / 18, mono: true, family: MONO, weight: 500, note: { es: "Bitmap con descendentes. Solo ASCII.", en: "Bitmap with descenders. ASCII only." } },
  { key: "D", name: "D · 18×10", baseH: 18, baseW: 10, baseline: 14 / 18, mono: true, family: MONO, weight: 500, note: { es: "Bitmap con descendentes. Solo ASCII.", en: "Bitmap with descenders. ASCII only." } },
  { key: "E", name: "E · OCR-B", baseH: 28, baseW: 15, baseline: 23 / 28, mono: true, family: MONO, weight: 400, note: { es: "OCR-B. Ideal para lectura automática.", en: "OCR-B. Ideal for machine reading." } },
  { key: "F", name: "F · 26×13", baseH: 26, baseW: 13, baseline: 21 / 26, mono: true, family: MONO, weight: 500, note: { es: "Bitmap. Solo ASCII.", en: "Bitmap. ASCII only." } },
  { key: "G", name: "G · 60×40", baseH: 60, baseW: 40, baseline: 48 / 60, mono: true, family: MONO, weight: 700, note: { es: "Bitmap grande. Solo ASCII.", en: "Large bitmap. ASCII only." } },
  { key: "H", name: "H · OCR-A", baseH: 21, baseW: 13, baseline: 1, mono: true, family: MONO, weight: 400, note: { es: "OCR-A. Ideal para lectura automática.", en: "OCR-A. Ideal for machine reading." } },
];

export function fontDef(key: string): ZplFontDef {
  return ZPL_FONTS.find((f) => f.key === key) ?? ZPL_FONTS[1];
}

export function defaultTextSize(font: string): { h: number; w: number } {
  const def = fontDef(font);
  const h = font === "0" ? 30 : Math.max(12, def.baseH * 2);
  return { h, w: Math.round((h * def.baseW) / def.baseH) };
}

let measureCanvas: HTMLCanvasElement | null = null;
function measureCtx(): CanvasRenderingContext2D {
  if (!measureCanvas) measureCanvas = document.createElement("canvas");
  return measureCanvas.getContext("2d")!;
}

export function fontString(font: string, h: number): string {
  const def = fontDef(font);
  return `${def.weight} ${Math.max(1, h)}px ${def.family}`;
}

export function measureRun(text: string, font: string, h: number): number {
  const ctx = measureCtx();
  ctx.font = fontString(font, h);
  return ctx.measureText(text).width;
}

export interface TextLayout {
  lines: string[];
  lineWidths: number[]; // dots
  width: number;
  height: number;
  lineH: number;
}

const WORD_BREAK = /(\s+)/;

export function layoutText(el: TextElement): TextLayout {
  const def = fontDef(el.font);
  const h = Math.max(1, el.h);
  const w = Math.max(1, el.w);
  const lineH = h;
  const advanceFor = (s: string) => (def.mono ? s.length * w : measureRun(s, el.font, h) * (w / h));

  const hardLines = el.text.split("\n");
  const lines: string[] = [];
  let maxWidth = 0;

  if (el.block && el.block.width > 0) {
    const blockW = el.block.width;
    const maxLines = Math.max(1, el.block.lines);
    for (const hard of hardLines) {
      if (lines.length >= maxLines) break;
      const words = hard.split(WORD_BREAK).filter((s) => s.length > 0);
      let current = "";
      const flush = () => {
        if (current.length) lines.push(current);
        current = "";
      };
      for (const token of words) {
        const candidate = current + token;
        if (advanceFor(candidate) <= blockW || current === "") {
          if (advanceFor(candidate) <= blockW) {
            current = candidate;
          } else {
            // Token longer than one line: break it by characters.
            current = "";
            for (const ch of token) {
              if (advanceFor(current + ch) > blockW && current !== "") {
                lines.push(current);
                current = ch;
              } else {
                current += ch;
              }
            }
          }
        } else {
          flush();
          if (advanceFor(token) <= blockW) current = token;
          else {
            for (const ch of token) {
              if (advanceFor(current + ch) > blockW && current !== "") {
                lines.push(current);
                current = ch;
              } else current += ch;
            }
          }
        }
      }
      flush();
    }
    if (lines.length > maxLines) lines.length = maxLines;
  } else {
    lines.push(...hardLines);
  }

  const effective = lines.length ? lines : [""];
  for (const line of effective) maxWidth = Math.max(maxWidth, advanceFor(line));
  const width = el.block && el.block.width > 0 ? el.block.width : maxWidth;
  const spacing = el.block ? el.block.spacing : 0;
  const height = effective.length * lineH + Math.max(0, effective.length - 1) * spacing;
  return { lines: effective, lineWidths: effective.map(advanceFor), width, height, lineH };
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function aabbOf(rect: Rect, rotation: string, originX: number, originY: number): Rect {
  let x = originX + rect.x;
  let y = originY + rect.y;
  let w = rect.w;
  let h = rect.h;
  if (rotation === "R" || rotation === "B") {
    x = originX;
    y = originY;
    w = rect.h;
    h = rect.w;
  }
  return { x, y, w, h };
}

/** Bounding box of a text field in label dots (axis aligned, includes rotation). */
export function textBounds(el: TextElement): Rect {
  const layout = layoutText(el);
  const boxW = layout.width;
  const boxH = layout.height;
  if (el.rotation === "N" || el.rotation === "I") return { x: el.x, y: el.y, w: boxW, h: boxH };
  return { x: el.x, y: el.y, w: boxH, h: boxW };
}

/** Only fonts A-H are bitmap; they don't carry full Unicode. */
export function fontSupportsUnicode(font: string): boolean {
  return font === "0";
}