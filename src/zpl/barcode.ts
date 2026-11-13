import bwipjs from "bwip-js";
import type { BarcodeElement, Symbology } from "../types";
import { SYMBOLOGY_INFO } from "../types";

export interface BarcodeRender {
  canvas: HTMLCanvasElement | null;
  width: number; // dots
  height: number; // dots (bars / symbol only)
  error: string | null;
}

const cache = new Map<string, BarcodeRender>();

function cacheKey(el: BarcodeElement): string {
  return [
    el.symbology,
    el.data,
    el.moduleWidth,
    el.height,
    el.ratio,
    el.ecc,
    el.mask,
    el.checkDigit ? 1 : 0,
  ].join("|");
}

function remember(key: string, value: BarcodeRender): BarcodeRender {
  if (cache.size > 90) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(key, value);
  return value;
}

/** Normalize data so the preview matches what the printer will encode. */
export function normalizeData(symbology: Symbology, raw: string): string {
  switch (symbology) {
    case "code39":
      return raw.toUpperCase();
    case "itf": {
      const digits = raw.replace(/\D/g, "");
      return digits.length % 2 === 1 ? "0" + digits : digits;
    }
    case "ean13":
    case "ean8":
    case "upca":
    case "upce":
    case "msi":
      return raw.replace(/\D/g, "");
    default:
      return raw;
  }
}

/** Returns a translated, human message for invalid data, or null. */
export function validateBarcode(symbology: Symbology, raw: string, lang: "es" | "en"): string | null {
  const data = raw.trim();
  const say = (es: string, en: string) => (lang === "es" ? es : en);
  if (!data) return say("Escribe los datos del código.", "Enter the barcode data.");
  const badCheck = (expected: string) =>
    say(
      `El dígito de control no coincide: debería ser ${expected}.`,
      `Check digit is wrong: it should be ${expected}.`,
    );
  switch (symbology) {
    case "ean13": {
      if (!/^\d{12,13}$/.test(data)) return say("EAN-13 necesita 12 o 13 dígitos.", "EAN-13 needs 12 or 13 digits.");
      if (data.length === 13) {
        const expected = eanCheckDigit(data.slice(0, 12));
        if (expected !== data[12]) return badCheck(expected);
      }
      break;
    }
    case "ean8": {
      if (!/^\d{7,8}$/.test(data)) return say("EAN-8 necesita 7 u 8 dígitos.", "EAN-8 needs 7 or 8 digits.");
      if (data.length === 8) {
        const expected = eanCheckDigit(data.slice(0, 7));
        if (expected !== data[7]) return badCheck(expected);
      }
      break;
    }
    case "upca": {
      if (!/^\d{11,12}$/.test(data)) return say("UPC-A necesita 11 o 12 dígitos.", "UPC-A needs 11 or 12 digits.");
      if (data.length === 12) {
        const expected = eanCheckDigit(data.slice(0, 11));
        if (expected !== data[11]) return badCheck(expected);
      }
      break;
    }
    case "upce": {
      if (!/^\d{6,8}$/.test(data))
        return say("UPC-E necesita de 6 a 8 dígitos para la vista previa.", "UPC-E needs 6 to 8 digits for the preview.");
      break;
    }
    case "itf":
      if (!/^\d+$/.test(data)) return say("ITF solo acepta dígitos.", "ITF accepts digits only.");
      break;
    case "msi":
      if (!/^\d{1,14}$/.test(data)) return say("MSI acepta de 1 a 14 dígitos.", "MSI accepts 1 to 14 digits.");
      break;
    case "code39":
      if (!/^[0-9A-Z\-. $/+%]+$/.test(data.toUpperCase()))
        return say("Code 39 acepta A–Z, 0–9 y - . $ / + %.", "Code 39 accepts A–Z, 0–9 and - . $ / + %.");
      break;
    case "code93":
      if (!/^[0-9A-Z\-. $/+%]+$/.test(data.toUpperCase()))
        return say("Code 93 acepta A–Z, 0–9 y - . $ / + %.", "Code 93 accepts A–Z, 0–9 and - . $ / + %.");
      break;
    case "codabar":
      if (!/^[0-9A-D\-.$:/+]+$/i.test(data))
        return say("Codabar acepta dígitos y - . $ : / +.", "Codabar accepts digits and - . $ : / +.");
      break;
    case "qrcode":
      if (data.length > 1200) return say("Demasiados datos para un QR.", "Too much data for a QR code.");
      break;
    case "datamatrix":
      if (data.length > 1500) return say("Demasiados datos para un Data Matrix.", "Too much data for a Data Matrix.");
      break;
    default:
      break;
  }
  return null;
}

export function barcodeRender(el: BarcodeElement): BarcodeRender {
  const key = cacheKey(el);
  const hit = cache.get(key);
  if (hit) return hit;

  const info = SYMBOLOGY_INFO[el.symbology];
  const data = normalizeData(el.symbology, el.data.trim());
  if (!data) {
    return remember(key, { canvas: null, width: 0, height: 0, error: "empty" });
  }

  const scale = Math.max(1, Math.round(el.moduleWidth));
  const opts: Record<string, unknown> = {
    bcid: info.bwip,
    text: data,
    scale,
    includetext: false,
    backgroundcolor: undefined,
    paddingwidth: 0,
    paddingheight: 0,
  };

  if (info.group === "1d") {
    // bwip-js wants millimetres. We scale vertically right after, so any close value works.
    opts.height = Math.max(0.2, el.height / (2.834645669 * scale));
    if (el.symbology === "code128") {
      opts.parsefnc = true;
    }
    if (["msi"].includes(el.symbology)) {
      opts.includecheck = el.checkDigit;
    }
  } else if (el.symbology === "qrcode") {
    opts.eclevel = el.ecc;
    if (el.mask >= 0 && el.mask <= 7) opts.mask = el.mask;
  } else if (el.symbology === "datamatrix") {
    opts.format = "square";
  }

  try {
    const canvas = document.createElement("canvas");
    bwipjs.toCanvas(canvas, opts as never);
    const width = canvas.width;
    const height = canvas.height;
    return remember(key, { canvas, width, height, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return remember(key, { canvas: null, width: 0, height: 0, error: message });
  }
}

export function barcodeTextHeight(el: BarcodeElement): number {
  if (!el.showText) return 0;
  return Math.max(10, Math.round(el.moduleWidth * 7));
}

/** Human-readable line, with the digits/symbols the printer adds. */
export function barcodeHumanText(el: BarcodeElement): string {
  const data = normalizeData(el.symbology, el.data.trim());
  switch (el.symbology) {
    case "code39":
      return `*${data}*`;
    case "ean13":
      return data.length === 12 ? data + eanCheckDigit(data) : data;
    case "ean8":
      return data.length === 7 ? data + eanCheckDigit(data) : data;
    case "upca":
      return data.length === 11 ? data + eanCheckDigit("0" + data) : data;
    case "itf":
      return data;
    default:
      return data;
  }
}

function eanCheckDigit(digits: string): string {
  let sum = 0;
  const reversed = digits.split("").reverse();
  reversed.forEach((d, i) => {
    sum += Number(d) * (i % 2 === 0 ? 3 : 1);
  });
  return String((10 - (sum % 10)) % 10);
}

export interface BarcodeBox {
  width: number;
  height: number;
  barsHeight: number;
  textHeight: number;
}

export function barcodeBox(el: BarcodeElement): BarcodeBox {
  const r = barcodeRender(el);
  const textHeight = r.error ? 0 : barcodeTextHeight(el);
  return {
    width: Math.max(1, r.width),
    height: Math.max(1, r.height + textHeight),
    barsHeight: Math.max(1, r.height),
    textHeight,
  };
}

export function clearBarcodeCache(): void {
  cache.clear();
}