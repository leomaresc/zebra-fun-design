import type { BarcodeElement, Doc, LabelElement, TextElement } from "../types";
import { fontDef } from "./fonts";
import { getProcessed } from "../render/image";
import { barcodeHumanText } from "./barcode";

function cleanComment(value: string): string {
  return value.replace(/[\^~\r\n]/g, " ").slice(0, 60);
}

function escapeHex(text: string): { hex: boolean; data: string } {
  const needs = /[\^~_\\]/.test(text);
  if (!needs) return { hex: false, data: text };
  const map: Record<string, string> = { "\\": "_5C", "^": "_5E", "~": "_7E", _: "_5F" };
  const data = Array.from(text)
    .map((ch) => map[ch] ?? ch)
    .join("");
  return { hex: true, data };
}

function fdLines(text: string, indent = ""): string[] {
  const { hex, data } = escapeHex(text.replace(/\n/g, "\\&"));
  return [...(hex ? [`${indent}^FH_`] : []), `${indent}^FD${data}`];
}

function clampInt(value: number, min: number, max = 32000): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function fieldOrigin(el: LabelElement, useFt: boolean): string {
  if (useFt && el.type === "text" && el.origin === "FT") return `^FT${Math.round(el.x)},${Math.round(el.y)}`;
  return `^FO${Math.round(el.x)},${Math.round(el.y)}`;
}

export function generateZPL(doc: Doc): string {
  const out: string[] = [];
  out.push("^XA");
  out.push("^CI28");
  out.push(`^PW${Math.round(doc.widthDots)}`);
  out.push(`^LL${Math.round(doc.heightDots)}`);
  out.push("^LH0,0");
  out.push(`^MN${doc.media === "gap" ? "Y" : doc.media === "mark" ? "M" : "N"}`);
  out.push(`^PR${clampInt(doc.speed, 1, 14)}`);
  out.push(`^MD${clampInt(doc.darkness, -30, 30)}`);
  out.push("");

  for (const el of doc.elements) {
    out.push(...elementZPL(el));
    out.push("");
  }

  if (doc.copies > 1) out.push(`^PQ${clampInt(doc.copies, 1, 9999)}`);
  out.push("^XZ");
  return out.join("\n");
}

function elementZPL(el: LabelElement): string[] {
  const lines: string[] = [];
  switch (el.type) {
    case "text": {
      lines.push(`^FX Texto · ${cleanComment(el.text) || "vacío"}`);
      lines.push(fieldOrigin(el, true));
      if (el.reverse) lines.push("^FR");
      const def = fontDef(el.font);
      const rot = el.rotation;
      if (el.font === "0") lines.push(`^A0${rot},${clampInt(el.h, 1)},${clampInt(el.w, 1)}`);
      else lines.push(`^A${def.key}${rot},${clampInt(el.h, 1)},${clampInt(el.w, 1)}`);
      if (el.block) {
        lines.push(
          `^FB${clampInt(el.block.width, 1, 32000)},${clampInt(el.block.lines, 1, 9999)},${clampInt(
            el.block.spacing,
            -9999,
            9999,
          )},${el.block.align},${clampInt(el.block.indent, 0, 9999)}`,
        );
      }
      lines.push(...fdLines(el.text));
      lines.push("^FS");
      break;
    }
    case "box": {
      const t = clampInt(el.thickness, 1);
      const w = Math.max(t, clampInt(el.width, 1));
      const h = Math.max(t, clampInt(el.height, 1));
      lines.push(`^FX Caja · ${w} × ${h}`);
      lines.push(fieldOrigin(el, false));
      lines.push(`^GB${w},${h},${t},${el.color},${clampInt(el.rounding, 0, 8)}`);
      lines.push("^FS");
      break;
    }
    case "line": {
      const t = clampInt(el.thickness, 1);
      const len = Math.max(t, clampInt(el.length, 1));
      const w = el.orientation === "h" ? len : t;
      const h = el.orientation === "h" ? t : len;
      lines.push(`^FX Línea · ${len} dots`);
      lines.push(fieldOrigin(el, false));
      lines.push(`^GB${w},${h},${t},${el.color},0`);
      lines.push("^FS");
      break;
    }
    case "circle": {
      const d = clampInt(el.diameter, 3, 4095);
      lines.push(`^FX Círculo · ⌀${d}`);
      lines.push(fieldOrigin(el, false));
      lines.push(`^GC${d},${clampInt(Math.max(2, el.thickness), 2, 4095)},${el.color}`);
      lines.push("^FS");
      break;
    }
    case "ellipse": {
      lines.push(`^FX Elipse · ${Math.round(el.width)} × ${Math.round(el.height)}`);
      lines.push(fieldOrigin(el, false));
      lines.push(
        `^GE${clampInt(el.width, 3, 4095)},${clampInt(el.height, 3, 4095)},${clampInt(
          Math.max(2, el.thickness),
          2,
          4095,
        )},${el.color}`,
      );
      lines.push("^FS");
      break;
    }
    case "diagonal": {
      lines.push(`^FX Diagonal · ${Math.round(el.width)} × ${Math.round(el.height)}`);
      lines.push(fieldOrigin(el, false));
      lines.push(
        `^GD${clampInt(el.width, 3)},${clampInt(el.height, 3)},${clampInt(el.thickness, 1)},${el.color},${
          el.slash ? "R" : "L"
        }`,
      );
      lines.push("^FS");
      break;
    }
    case "barcode": {
      lines.push(...barcodeZPL(el));
      break;
    }
    case "image": {
      const img = getProcessed(el);
      lines.push(`^FX Imagen · ${Math.round(el.width)} × ${Math.round(el.height)}`);
      lines.push(fieldOrigin(el, false));
      if (!img) {
        lines.push("^FX La imagen aún no se ha procesado");
        break;
      }
      const total = img.bytesPerRow * img.height;
      const hexRows: string[] = [];
      for (let y = 0; y < img.height; y++) {
        let row = "";
        for (let x = 0; x < img.bytesPerRow; x++) {
          row += img.bits[y * img.bytesPerRow + x].toString(16).toUpperCase().padStart(2, "0");
        }
        hexRows.push(row);
      }
      lines.push(`^GFA,${total},${total},${img.bytesPerRow},`);
      lines.push(hexRows.join("\n"));
      lines.push("^FS");
      break;
    }
  }
  return lines;
}

function barcodeZPL(el: BarcodeElement): string[] {
  const out: string[] = [`^FX Código · ${el.symbology.toUpperCase()}`];
  const rot = el.rotation;
  const h = clampInt(el.height, 1);
  const f = el.showText ? "Y" : "N";
  const g = el.textAbove ? "Y" : "N";
  const data = el.data.trim();

  out.push(fieldOrigin(el, false));
  if (el.symbology === "qrcode") {
    out.push(`^BQ${rot},2,${clampInt(el.moduleWidth, 1, 100)},${el.ecc},${clampInt(el.mask, 0, 7)}`);
    out.push(...fdLines(`${el.ecc}A,${data}`));
    out.push("^FS");
    return out;
  }
  if (el.symbology === "datamatrix") {
    out.push(`^BX${rot},${clampInt(el.moduleWidth, 1, 100)},200`);
    out.push(...fdLines(data));
    out.push("^FS");
    return out;
  }

  out.push(`^BY${clampInt(el.moduleWidth, 1, 10)},${clampInt(el.ratio * 10, 20, 30) / 10},${h}`);
  switch (el.symbology) {
    case "code128":
      out.push(`^BC${rot},${h},${f},${g},${el.checkDigit ? "Y" : "N"},A`);
      break;
    case "code39":
      out.push(`^B3${rot},${el.checkDigit ? "Y" : "N"},${h},${f},${g}`);
      break;
    case "code93":
      out.push(`^BA${rot},${h},${f},${g},${el.checkDigit ? "Y" : "N"}`);
      break;
    case "ean13":
      out.push(`^BE${rot},${h},${f},${g}`);
      break;
    case "ean8":
      out.push(`^B8${rot},${h},${f},${g}`);
      break;
    case "upca":
      out.push(`^BU${rot},${h},${f},${g},Y`);
      break;
    case "upce":
      out.push(`^B9${rot},${h},${f},${g},${el.checkDigit ? "Y" : "N"}`);
      break;
    case "itf":
      out.push(`^B2${rot},${h},${f},${g},${el.checkDigit ? "Y" : "N"}`);
      break;
    case "codabar": {
      const parts = codabarParts(data);
      out.push(`^BK${rot},N,${h},${f},${g},${parts.start},${parts.stop}`);
      out.push(...fdLines(parts.body));
      out.push("^FS");
      return out;
    }
    case "msi":
      out.push(`^BM${rot},${el.checkDigit ? "B" : "A"},${h},${f},${g},${el.checkDigit ? "Y" : "N"}`);
      break;
    default:
      break;
  }
  out.push(...fdLines(el.symbology === "upce" ? upceZplData(data) : data));
  out.push("^FS");
  return out;
}

export function codabarParts(data: string): { start: string; stop: string; body: string } {
  const clean = data.trim().toUpperCase();
  const starts = /^[A-D]/.test(clean);
  const ends = /[A-D]$/.test(clean);
  if (starts && ends && clean.length >= 2) {
    return { start: clean[0], stop: clean[clean.length - 1], body: clean.slice(1, -1) };
  }
  return { start: "A", stop: "A", body: clean };
}

/**
 * ^B9 expects the full 10-character manufacturer + product sequence, while the
 * preview (and most humans) work with the 8-digit UPC-E form. Expand it here.
 */
export function upceZplData(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 8) return digits;
  const body = digits.slice(1, 7);
  const [d1, d2, d3, d4, d5, d6] = body.split("");
  let manufacturer: string;
  let product: string;
  switch (d6) {
    case "0":
    case "1":
    case "2":
      manufacturer = `${d1}${d2}${d6}00`;
      product = `00${d3}${d4}${d5}`;
      break;
    case "3":
      manufacturer = `${d1}${d2}${d3}00`;
      product = `000${d4}${d5}`;
      break;
    case "4":
      manufacturer = `${d1}${d2}${d3}${d4}0`;
      product = `0000${d5}`;
      break;
    default:
      manufacturer = `${d1}${d2}${d3}${d4}${d5}`;
      product = `0000${d6}`;
      break;
  }
  return manufacturer + product;
}

/** Preview version of the exported text, useful for the export panel summary. */
export function zplStats(doc: Doc): { fields: number; bytes: number; lines: number } {
  const zpl = generateZPL(doc);
  return {
    fields: doc.elements.length,
    bytes: new TextEncoder().encode(zpl).length,
    lines: zpl.split("\n").length,
  };
}

export function describeElement(el: LabelElement): string {
  switch (el.type) {
    case "text":
      return el.text.slice(0, 24) || "Texto";
    case "barcode":
      return barcodeHumanText(el) || el.symbology;
    default:
      return el.type;
  }
}

export type { TextElement };