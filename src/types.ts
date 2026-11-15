export type Dpi = 203 | 300 | 600;
export type Rotation = "N" | "R" | "I" | "B";
export type Origin = "FO" | "FT";
export type Tool =
  | "select"
  | "text"
  | "box"
  | "line"
  | "circle"
  | "ellipse"
  | "diagonal"
  | "barcode"
  | "image"
  | "hand";

export type Symbology =
  | "code128"
  | "code39"
  | "code93"
  | "ean13"
  | "ean8"
  | "upca"
  | "upce"
  | "itf"
  | "codabar"
  | "msi"
  | "qrcode"
  | "datamatrix";

export interface BaseElement {
  id: string;
  name?: string;
  x: number;
  y: number;
  rotation: Rotation;
  origin: Origin;
  locked?: boolean;
}

export interface TextBlock {
  width: number;
  lines: number;
  spacing: number;
  align: "L" | "C" | "R" | "J";
  indent: number;
}

export interface TextElement extends BaseElement {
  type: "text";
  text: string;
  font: string;
  h: number;
  w: number;
  reverse: boolean;
  block: TextBlock | null;
  /** Negrita: se imprime a doble pasada (^FD dos veces). */
  bold?: boolean;
  /** Cursiva: ZPL no tiene cursiva, se exporta como gráfico ^GFA. */
  italic?: boolean;
  /** Subrayado: se dibuja con ^GB bajo cada línea. */
  underline?: boolean;
}

export interface BoxElement extends BaseElement {
  type: "box";
  width: number;
  height: number;
  thickness: number;
  color: "B" | "W";
  rounding: number;
}

export interface LineElement extends BaseElement {
  type: "line";
  length: number;
  thickness: number;
  color: "B" | "W";
  orientation: "h" | "v";
}

export interface CircleElement extends BaseElement {
  type: "circle";
  diameter: number;
  thickness: number;
  color: "B" | "W";
}

export interface EllipseElement extends BaseElement {
  type: "ellipse";
  width: number;
  height: number;
  thickness: number;
  color: "B" | "W";
}

export interface DiagonalElement extends BaseElement {
  type: "diagonal";
  width: number;
  height: number;
  thickness: number;
  color: "B" | "W";
  slash: boolean; // true = "/" (right leaning), false = "\"
}

export interface BarcodeElement extends BaseElement {
  type: "barcode";
  symbology: Symbology;
  data: string;
  moduleWidth: number;
  height: number;
  ratio: number;
  showText: boolean;
  textAbove: boolean;
  ecc: "L" | "M" | "Q" | "H";
  mask: number;
  checkDigit: boolean;
}

export interface ImageElement extends BaseElement {
  type: "image";
  width: number;
  height: number;
  src: string;
  threshold: number;
  dither: boolean;
  invert: boolean;
}

export type LabelElement =
  | TextElement
  | BoxElement
  | LineElement
  | CircleElement
  | EllipseElement
  | DiagonalElement
  | BarcodeElement
  | ImageElement;

export type ElementType = LabelElement["type"];

export interface Doc {
  version: 1;
  name: string;
  widthMm: number;
  heightMm: number;
  dpi: Dpi;
  widthDots: number;
  heightDots: number;
  media: "gap" | "continuous" | "mark";
  speed: number;
  darkness: number;
  copies: number;
  elements: LabelElement[];
}

export interface LabelPreset {
  id: string;
  label: { es: string; en: string };
  widthMm: number;
  heightMm: number;
  dots203?: [number, number];
}

export const LABEL_PRESETS: LabelPreset[] = [
  {
    id: "100x150",
    label: { es: "100 × 150 mm · envío", en: "100 × 150 mm · shipping" },
    widthMm: 100,
    heightMm: 150,
    dots203: [800, 1200],
  },
  {
    id: "100x75",
    label: { es: "100 × 75 mm", en: "100 × 75 mm" },
    widthMm: 100,
    heightMm: 75,
    dots203: [800, 600],
  },
  {
    id: "100x50",
    label: { es: "100 × 50 mm", en: "100 × 50 mm" },
    widthMm: 100,
    heightMm: 50,
    dots203: [800, 400],
  },
  {
    id: "4x6",
    label: { es: "4 × 6 in · envío", en: "4 × 6 in · shipping" },
    widthMm: 101.6,
    heightMm: 152.4,
    dots203: [812, 1218],
  },
  {
    id: "4x3",
    label: { es: "4 × 3 in", en: "4 × 3 in" },
    widthMm: 101.6,
    heightMm: 76.2,
    dots203: [812, 609],
  },
  {
    id: "4x2",
    label: { es: "4 × 2 in", en: "4 × 2 in" },
    widthMm: 101.6,
    heightMm: 50.8,
    dots203: [812, 406],
  },
  {
    id: "2x1",
    label: { es: "2 × 1 in", en: "2 × 1 in" },
    widthMm: 50.8,
    heightMm: 25.4,
    dots203: [406, 203],
  },
  {
    id: "50x25",
    label: { es: "50 × 25 mm · producto", en: "50 × 25 mm · product" },
    widthMm: 50,
    heightMm: 25,
    dots203: [400, 200],
  },
];

export function mmToDots(mm: number, dpi: Dpi): number {
  return Math.round((mm / 25.4) * dpi);
}

export function dotsToMm(dots: number, dpi: Dpi): number {
  return +((dots / dpi) * 25.4).toFixed(2);
}

export function presetDots(preset: LabelPreset, dpi: Dpi): [number, number] {
  if (dpi === 203 && preset.dots203) return preset.dots203;
  return [mmToDots(preset.widthMm, dpi), mmToDots(preset.heightMm, dpi)];
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

export const SYMBOLOGY_INFO: Record<
  Symbology,
  { label: string; group: "1d" | "2d"; bwip: string; placeholder: string }
> = {
  code128: { label: "Code 128", group: "1d", bwip: "code128", placeholder: "ABC-123456" },
  code39: { label: "Code 39", group: "1d", bwip: "code39", placeholder: "ABC-123" },
  code93: { label: "Code 93", group: "1d", bwip: "code93", placeholder: "ABC-123" },
  ean13: { label: "EAN-13", group: "1d", bwip: "ean13", placeholder: "7501234567893" },
  ean8: { label: "EAN-8", group: "1d", bwip: "ean8", placeholder: "12345670" },
  upca: { label: "UPC-A", group: "1d", bwip: "upca", placeholder: "012345678905" },
  upce: { label: "UPC-E", group: "1d", bwip: "upce", placeholder: "01234565" },
  itf: { label: "ITF / 2 of 5", group: "1d", bwip: "interleaved2of5", placeholder: "12345678" },
  codabar: { label: "Codabar", group: "1d", bwip: "rationalizedCodabar", placeholder: "A123456B" },
  msi: { label: "MSI", group: "1d", bwip: "msi", placeholder: "1234567890" },
  qrcode: { label: "QR Code", group: "2d", bwip: "qrcode", placeholder: "https://ejemplo.com" },
  datamatrix: { label: "Data Matrix", group: "2d", bwip: "datamatrix", placeholder: "ABC-123456" },
};

export const DEFAULT_BARCODE: Record<Symbology, Partial<BarcodeElement>> = {
  code128: { moduleWidth: 2, height: 80, ratio: 3, showText: true, checkDigit: false },
  code39: { moduleWidth: 2, height: 80, ratio: 3, showText: true, checkDigit: false },
  code93: { moduleWidth: 2, height: 80, ratio: 3, showText: true, checkDigit: false },
  ean13: { moduleWidth: 2, height: 80, ratio: 3, showText: true, checkDigit: true },
  ean8: { moduleWidth: 2, height: 80, ratio: 3, showText: true, checkDigit: true },
  upca: { moduleWidth: 2, height: 80, ratio: 3, showText: true, checkDigit: true },
  upce: { moduleWidth: 2, height: 80, ratio: 3, showText: true, checkDigit: true },
  itf: { moduleWidth: 2, height: 80, ratio: 3, showText: true, checkDigit: false },
  codabar: { moduleWidth: 2, height: 80, ratio: 3, showText: true, checkDigit: false },
  msi: { moduleWidth: 2, height: 80, ratio: 3, showText: true, checkDigit: false },
  qrcode: { moduleWidth: 4, height: 100, ratio: 3, showText: false, ecc: "Q", mask: 7, checkDigit: false },
  datamatrix: { moduleWidth: 4, height: 100, ratio: 3, showText: false, ecc: "Q", mask: 7, checkDigit: false },
};

export function rotationLabel(r: Rotation, lang: "es" | "en"): string {
  const es = { N: "Normal", R: "90°", I: "180°", B: "270°" };
  const en = { N: "Normal", R: "90°", I: "180°", B: "270°" };
  void lang;
  return es[r];
}