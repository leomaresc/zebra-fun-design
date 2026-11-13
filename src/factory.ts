import type {
  BarcodeElement,
  BoxElement,
  CircleElement,
  DiagonalElement,
  Doc,
  EllipseElement,
  ImageElement,
  LabelElement,
  LineElement,
  Symbology,
  TextElement,
  Dpi,
} from "./types";
import { DEFAULT_BARCODE, uid } from "./types";

export function newText(x: number, y: number, text = "Texto", font = "0", h = 36): TextElement {
  return {
    id: uid(),
    type: "text",
    x: Math.round(x),
    y: Math.round(y),
    rotation: "N",
    origin: "FO",
    text,
    font,
    h,
    w: font === "0" ? h : Math.round((h * 5) / 9),
    reverse: false,
    block: null,
  };
}

export function newBox(x: number, y: number, width = 240, height = 100): BoxElement {
  return {
    id: uid(),
    type: "box",
    x: Math.round(x),
    y: Math.round(y),
    rotation: "N",
    origin: "FO",
    width,
    height,
    thickness: 4,
    color: "B",
    rounding: 0,
  };
}

export function newLine(x: number, y: number, length = 240): LineElement {
  return {
    id: uid(),
    type: "line",
    x: Math.round(x),
    y: Math.round(y),
    rotation: "N",
    origin: "FO",
    length,
    thickness: 4,
    color: "B",
    orientation: "h",
  };
}

export function newCircle(x: number, y: number, diameter = 120): CircleElement {
  return {
    id: uid(),
    type: "circle",
    x: Math.round(x),
    y: Math.round(y),
    rotation: "N",
    origin: "FO",
    diameter,
    thickness: 4,
    color: "B",
  };
}

export function newEllipse(x: number, y: number, width = 240, height = 120): EllipseElement {
  return {
    id: uid(),
    type: "ellipse",
    x: Math.round(x),
    y: Math.round(y),
    rotation: "N",
    origin: "FO",
    width,
    height,
    thickness: 4,
    color: "B",
  };
}

export function newDiagonal(x: number, y: number, width = 240, height = 120): DiagonalElement {
  return {
    id: uid(),
    type: "diagonal",
    x: Math.round(x),
    y: Math.round(y),
    rotation: "N",
    origin: "FO",
    width,
    height,
    thickness: 4,
    color: "B",
    slash: true,
  };
}

export function newBarcode(x: number, y: number, symbology: Symbology = "code128"): BarcodeElement {
  const defaults = DEFAULT_BARCODE[symbology];
  return {
    id: uid(),
    type: "barcode",
    x: Math.round(x),
    y: Math.round(y),
    rotation: "N",
    origin: "FO",
    symbology,
    data: symbology === "qrcode" ? "https://zebrafundesign.local" : "ZFD-000123",
    moduleWidth: defaults.moduleWidth ?? 2,
    height: defaults.height ?? 80,
    ratio: defaults.ratio ?? 3,
    showText: defaults.showText ?? true,
    textAbove: false,
    ecc: defaults.ecc ?? "Q",
    mask: defaults.mask ?? 7,
    checkDigit: defaults.checkDigit ?? false,
  };
}

export function newImage(x: number, y: number, src: string, width: number, height: number): ImageElement {
  return {
    id: uid(),
    type: "image",
    x: Math.round(x),
    y: Math.round(y),
    rotation: "N",
    origin: "FO",
    width,
    height,
    src,
    threshold: 150,
    dither: false,
    invert: false,
  };
}

export function emptyDoc(dpi: Dpi = 203): Doc {
  return {
    version: 1,
    name: "",
    widthMm: 100,
    heightMm: 150,
    dpi,
    widthDots: dpi === 203 ? 800 : Math.round((100 / 25.4) * dpi),
    heightDots: dpi === 203 ? 1200 : Math.round((150 / 25.4) * dpi),
    media: "gap",
    speed: 4,
    darkness: 10,
    copies: 1,
    elements: [],
  };
}

export function cloneElement(el: LabelElement, offset = 20): LabelElement {
  return { ...el, id: uid(), x: el.x + offset, y: el.y + offset };
}