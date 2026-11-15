import type { Doc, LabelElement, Rotation, Symbology, TextBlock, TextElement } from "../types";
import { dotsToMm } from "../types";
import {
  newBarcode,
  newBox,
  newCircle,
  newDiagonal,
  newEllipse,
  newImage,
  newLine,
  newText,
} from "../factory";
import { fontDef, layoutText } from "./fonts";

/**
 * Importador de ZPL → diseño.
 *
 * Interpreta el subconjunto que genera la propia app (y lo habitual en ZPL II):
 * texto (^A/^FB/^FD), figuras (^GB/^GC/^GE/^GD), códigos (^B…), imágenes
 * (^GFA) y la cabecera (^PW/^LL/^LH/^MN/^PR/^MD/^PQ). Lo que no se reconoce se
 * ignora sin romper la importación.
 */

export interface ParsedZPL {
  widthDots?: number;
  heightDots?: number;
  media?: Doc["media"];
  speed?: number;
  darkness?: number;
  copies?: number;
  elements: LabelElement[];
  /** Comandos encontrados que no se pudieron interpretar. */
  skipped: string[];
}

type Token = { kind: "cmd"; name: string } | { kind: "data"; text: string };

const BARCODE_CMDS: Record<string, Symbology> = {
  BC: "code128",
  B3: "code39",
  BA: "code93",
  BE: "ean13",
  B8: "ean8",
  BU: "upca",
  B9: "upce",
  B2: "itf",
  BK: "codabar",
  BM: "msi",
};

/** Lee el nombre de un comando: ^FO, ^A0, ^BQ, ^GFA, ~TA… */
function readName(src: string, start: number): { name: string; end: number } | null {
  let j = start + 1;
  const c0 = src[j];
  if (!c0 || !/[A-Za-z]/.test(c0)) return null;
  const C0 = c0.toUpperCase();
  const c1 = src[j + 1];
  if ((C0 === "A" || C0 === "B" || C0 === "O") && c1 && /[0-9@]/.test(c1)) {
    return { name: C0 + c1.toUpperCase(), end: j + 2 };
  }
  if (c1 && /[A-Za-z]/.test(c1)) {
    const two = C0 + c1.toUpperCase();
    if (two === "GF" && src[j + 2] && /[ABC]/i.test(src[j + 2])) {
      return { name: two + src[j + 2].toUpperCase(), end: j + 3 };
    }
    return { name: two, end: j + 2 };
  }
  return { name: C0, end: j + 1 };
}

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  let dataStart = 0;
  const flush = (end: number) => {
    if (end > dataStart) out.push({ kind: "data", text: src.slice(dataStart, end) });
  };
  while (i < src.length) {
    const ch = src[i];
    if (ch === "^" || ch === "~") {
      const rn = readName(src, i);
      if (!rn) {
        // caret huérfano: se trata como texto plano
        i += 1;
        continue;
      }
      flush(i);
      out.push({ kind: "cmd", name: rn.name });
      i = rn.end;
      dataStart = i;
    } else {
      i += 1;
    }
  }
  flush(src.length);
  return out;
}

const num = (s: string | undefined, fallback = 0): number => {
  const n = Number(String(s ?? "").trim());
  return Number.isFinite(n) ? n : fallback;
};

const nums = (s: string): number[] => s.split(",").map((p) => num(p, NaN));

const rotationOf = (v: string | undefined, fallback: Rotation): Rotation => {
  const c = (v ?? "").trim().toUpperCase();
  return c === "R" || c === "I" || c === "B" ? c : c === "N" ? "N" : fallback;
};

const colorOf = (v: string | undefined): "B" | "W" =>
  (v ?? "").trim().toUpperCase() === "W" ? "W" : "B";

const yes = (v: string | undefined): boolean => (v ?? "").trim().toUpperCase() === "Y";

function decodeField(raw: string, hex: string | null): string {
  let s = raw.replace(/[\r\n]+$/, "");
  if (hex) {
    const esc = hex.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    s = s.replace(
      new RegExp(`${esc}([0-9A-Fa-f]{2})`, "g"),
      (_, pair: string) => String.fromCharCode(parseInt(pair, 16)),
    );
  }
  return s.replace(/\\&/g, "\n");
}

function textTopOf(el: TextElement): number {
  const layout = layoutText(el);
  const def = fontDef(el.font);
  const spacing = el.block ? el.block.spacing : 0;
  return el.y - (layout.lines.length - 1) * (el.h + spacing) - el.h * def.baseline;
}

/** Bits 1 bit → PNG (para reconstruir ^GFA como imagen editable). */
function bitsToDataUrl(bits: Uint8Array, bytesPerRow: number, width: number, height: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const on = (bits[y * bytesPerRow + (x >> 3)] & (0x80 >> (x & 7))) !== 0;
      const v = on ? 0 : 255;
      const i = (y * width + x) * 4;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

export function parseZPL(src: string): ParsedZPL {
  const toks = tokenize(src);
  const out: ParsedZPL = { elements: [], skipped: [] };

  const st = {
    x: 0,
    y: 0,
    home: { x: 0, y: 0 },
    origin: "FO" as "FO" | "FT",
    rotation: "N" as Rotation,
    font: "0",
    h: 36,
    w: 36,
    block: null as TextBlock | null,
    reverse: false,
    hex: null as string | null,
    by: { module: 2, ratio: 3, height: 80 },
    barcode: null as null | { sym: Symbology; params: string[] },
    codabar: null as null | { start: string; stop: string },
    skip: (name: string) => {
      if (!out.skipped.includes(name)) out.skipped.push(name);
    },
  };

  const handle = (name: string, raw: string) => {
    const args = name === "FD" || name === "FX" ? raw.replace(/[\r\n]+$/, "") : raw.trim();

    switch (name) {
      case "XA":
      case "XZ":
      case "CI":
        return;
      case "PW":
        out.widthDots = Math.max(1, Math.round(num(args, 0)));
        return;
      case "LL":
        out.heightDots = Math.max(1, Math.round(num(args, 0)));
        return;
      case "LH": {
        const p = nums(args);
        st.home = { x: p[0] || 0, y: p[1] || 0 };
        return;
      }
      case "MN":
        if (args === "Y") out.media = "gap";
        else if (args === "M") out.media = "mark";
        else if (args === "N") out.media = "continuous";
        return;
      case "PR":
        out.speed = Math.min(14, Math.max(1, Math.round(num(args, 4))));
        return;
      case "MD":
        out.darkness = Math.min(30, Math.max(-30, Math.round(num(args, 10))));
        return;
      case "PQ":
        out.copies = Math.max(1, Math.round(num(args, 1)));
        return;
      case "FW":
        st.rotation = rotationOf(args, st.rotation);
        return;
      case "FO":
      case "FT": {
        const p = nums(args);
        st.x = (p[0] || 0) + st.home.x;
        st.y = (p[1] || 0) + st.home.y;
        st.origin = name === "FT" ? "FT" : "FO";
        return;
      }
      case "FR":
        st.reverse = true;
        return;
      case "FH":
        st.hex = args || null;
        return;
      case "FB": {
        const p = args.split(",");
        const alignRaw = (p[3] ?? "L").trim().toUpperCase();
        st.block = {
          width: Math.max(1, Math.round(num(p[0], 200))),
          lines: Math.max(1, Math.round(num(p[1], 3))),
          spacing: Math.round(num(p[2], 0)),
          align: (["L", "C", "R", "J"].includes(alignRaw) ? alignRaw : "L") as TextBlock["align"],
          indent: Math.max(0, Math.round(num(p[4], 0))),
        };
        return;
      }
      case "FS":
        st.reverse = false;
        st.block = null;
        st.barcode = null;
        st.codabar = null;
        return;
      case "BY": {
        const p = nums(args);
        st.by = {
          module: Math.max(1, Math.round(p[0] || 2)),
          ratio: p[1] || 3,
          height: Math.max(1, Math.round(p[2] || 80)),
        };
        return;
      }
      case "GB": {
        const p = nums(args);
        const w = Math.max(1, Math.round(p[0] || 1));
        const h = Math.max(1, Math.round(p[1] || 1));
        const t = Math.max(1, Math.round(p[2] || 1));
        const color = colorOf(args.split(",")[3]);
        const rounding = Math.min(8, Math.max(0, Math.round(num(args.split(",")[4], 0))));
        // Una regla fina es una línea; el resto (rellenos incluidos) es caja.
        const thin = t <= 24 && ((t === h && w > t) || (t === w && h > t));
        if (thin) {
          const horizontal = t === h;
          const el = newLine(st.x, st.y, horizontal ? w : h);
          el.thickness = horizontal ? h : w;
          el.color = color;
          el.orientation = horizontal ? "h" : "v";
          out.elements.push(el);
        } else {
          const el = newBox(st.x, st.y, w, h);
          el.thickness = Math.min(t, Math.min(w, h));
          el.color = color;
          el.rounding = rounding;
          out.elements.push(el);
        }
        return;
      }
      case "GC": {
        const p = nums(args);
        const el = newCircle(st.x, st.y, Math.max(3, Math.round(p[0] || 3)));
        el.thickness = Math.max(2, Math.round(p[1] || 2));
        el.color = colorOf(args.split(",")[2]);
        out.elements.push(el);
        return;
      }
      case "GE": {
        const p = nums(args);
        const el = newEllipse(st.x, st.y, Math.max(3, Math.round(p[0] || 3)), Math.max(3, Math.round(p[1] || 3)));
        el.thickness = Math.max(2, Math.round(p[2] || 2));
        el.color = colorOf(args.split(",")[3]);
        out.elements.push(el);
        return;
      }
      case "GD": {
        const p = nums(args);
        const el = newDiagonal(st.x, st.y, Math.max(3, Math.round(p[0] || 3)), Math.max(3, Math.round(p[1] || 3)));
        el.thickness = Math.max(1, Math.round(p[2] || 1));
        el.color = colorOf(args.split(",")[3]);
        el.slash = (args.split(",")[4] ?? "R").trim().toUpperCase() !== "L";
        out.elements.push(el);
        return;
      }
      case "GFA": {
        const p = args.split(",");
        const bytesPerRow = Math.max(1, Math.round(num(p[3], 0)));
        const count = Math.max(1, Math.round(num(p[2], 0)));
        const height = Math.max(1, Math.round(count / bytesPerRow));
        const hex = p.slice(4).join("").replace(/[^0-9A-Fa-f]/g, "");
        const width = bytesPerRow * 8;
        const bits = new Uint8Array(bytesPerRow * height);
        for (let i = 0; i < bits.length && i * 2 + 1 < hex.length; i++) {
          bits[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16) || 0;
        }
        const src = bitsToDataUrl(bits, bytesPerRow, width, height);
        if (!src) return;
        const el = newImage(st.x, st.y, src, width, height);
        // Blanco y negro puros: un umbral de 128 reproduce el bitmap exacto.
        el.threshold = 128;
        el.dither = false;
        el.invert = false;
        out.elements.push(el);
        return;
      }
      case "FD": {
        const data = decodeField(args, st.hex);
        if (st.barcode) {
          const { sym, params } = st.barcode;
          const el = newBarcode(st.x, st.y, sym);
          el.rotation = rotationOf(params[0], st.rotation);
          el.origin = st.origin;
          el.moduleWidth = st.by.module;
          el.ratio = st.by.ratio || 3;
          el.height = st.by.height;

          const byIndex = (i: number) => (params[i] !== undefined ? params[i] : "");
          switch (sym) {
            case "code128":
              el.height = num(params[1], el.height);
              el.showText = yes(params[2]);
              el.textAbove = yes(params[3]);
              el.checkDigit = yes(params[4]);
              break;
            case "code39":
              el.checkDigit = yes(params[1]);
              el.height = num(params[2], el.height);
              el.showText = yes(params[3]);
              el.textAbove = yes(params[4]);
              break;
            case "code93":
            case "upca":
            case "upce":
            case "itf":
              el.height = num(params[1], el.height);
              el.showText = yes(params[2]);
              el.textAbove = yes(params[3]);
              el.checkDigit = yes(params[4]);
              break;
            case "ean13":
            case "ean8":
              el.height = num(params[1], el.height);
              el.showText = yes(params[2]);
              el.textAbove = yes(params[3]);
              break;
            case "codabar":
              el.height = num(params[2], el.height);
              el.showText = yes(params[3]);
              el.textAbove = yes(params[4]);
              st.codabar = { start: byIndex(5) || "A", stop: byIndex(6) || "A" };
              break;
            case "msi":
              el.checkDigit = (params[1] ?? "B").trim().toUpperCase() !== "A";
              el.height = num(params[2], el.height);
              el.showText = yes(params[3]);
              el.textAbove = yes(params[4]);
              break;
            default:
              break;
          }

          if (sym === "qrcode") {
            const m = /^([LMQH])([A-Z])\s*,([\s\S]*)$/i.exec(data);
            if (m) {
              el.ecc = m[1].toUpperCase() as typeof el.ecc;
              el.data = m[3];
            } else {
              el.data = data;
            }
            el.mask = Math.min(7, Math.max(0, Math.round(num(params[4], 7))));
          } else if (sym === "datamatrix") {
            el.data = data;
          } else if (sym === "codabar" && st.codabar) {
            const body = data.replace(/^[A-D]/i, "").replace(/[A-D]$/i, "");
            el.data = `${st.codabar.start}${body}${st.codabar.stop}`;
          } else {
            el.data = data;
          }

          out.elements.push(el);
          st.barcode = null;
          st.codabar = null;
          return;
        }

        const el = newText(st.x, st.y, data, st.font, st.h);
        el.w = st.w;
        el.rotation = st.rotation;
        el.origin = st.origin;
        el.reverse = st.reverse;
        el.block = st.block;
        if (el.origin === "FT") el.y = Math.round(textTopOf(el));
        out.elements.push(el);
        return;
      }
      default:
        break;
    }

    // ^A0…^AH / ^A@ : fuente, rotación y medidas.
    if (/^A[0-9A-H]$/.test(name) || name === "A@") {
      const p = args.split(",");
      if (name !== "A@") st.font = name[1];
      st.rotation = rotationOf(p[0], st.rotation);
      st.h = Math.max(1, Math.round(num(p[1], st.h)));
      st.w = Math.max(1, Math.round(num(p[2], st.w)));
      return;
    }

    if (name === "BQ" || name === "BX") {
      const p = args.split(",");
      st.rotation = rotationOf(p[0], st.rotation);
      st.barcode = {
        sym: name === "BQ" ? "qrcode" : "datamatrix",
        params: [p[0], p[1], p[2], p[3], p[4]],
      };
      return;
    }

    const sym = BARCODE_CMDS[name];
    if (sym) {
      st.barcode = { sym, params: args.split(",") };
      return;
    }

    st.skip(name);
  };

  let i = 0;
  while (i < toks.length) {
    const tk = toks[i];
    if (tk.kind !== "cmd") {
      i += 1;
      continue;
    }
    let args = "";
    const next = toks[i + 1];
    if (next && next.kind === "data") {
      args = next.text;
      i += 2;
    } else {
      i += 1;
    }
    handle(tk.name, args);
  }

  return out;
}

/** Convierte el resultado en un parche de documento listo para aplicar. */
export function parsedDocPatch(parsed: ParsedZPL, doc: Doc): Partial<Doc> {
  const patch: Partial<Doc> = { elements: parsed.elements };
  const widthDots = parsed.widthDots && parsed.widthDots > 0 ? parsed.widthDots : doc.widthDots;
  const heightDots = parsed.heightDots && parsed.heightDots > 0 ? parsed.heightDots : doc.heightDots;
  if (widthDots !== doc.widthDots || heightDots !== doc.heightDots) {
    patch.widthDots = widthDots;
    patch.heightDots = heightDots;
    patch.widthMm = +dotsToMm(widthDots, doc.dpi).toFixed(1);
    patch.heightMm = +dotsToMm(heightDots, doc.dpi).toFixed(1);
  }
  if (parsed.media) patch.media = parsed.media;
  if (parsed.speed !== undefined) patch.speed = parsed.speed;
  if (parsed.darkness !== undefined) patch.darkness = parsed.darkness;
  if (parsed.copies !== undefined) patch.copies = parsed.copies;
  return patch;
}
