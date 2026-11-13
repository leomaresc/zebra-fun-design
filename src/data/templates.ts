import type { Doc, Dpi, LabelElement } from "../types";
import { LABEL_PRESETS, mmToDots, presetDots } from "../types";
import {
  newBarcode,
  newBox,
  newCircle,
  newLine,
  newText,
} from "../factory";

export type TemplateId = "blank" | "shipping" | "product" | "price" | "inventory";

export interface TemplateMeta {
  id: TemplateId;
  presetId?: string;
  nameKey: "templates.blank" | "templates.shipping" | "templates.product" | "templates.price" | "templates.inventory";
  bodyKey:
    | "templates.blankBody"
    | "templates.shippingBody"
    | "templates.productBody"
    | "templates.priceBody"
    | "templates.inventoryBody";
}

export const TEMPLATES: TemplateMeta[] = [
  { id: "blank", nameKey: "templates.blank", bodyKey: "templates.blankBody" },
  { id: "shipping", presetId: "100x150", nameKey: "templates.shipping", bodyKey: "templates.shippingBody" },
  { id: "product", presetId: "100x75", nameKey: "templates.product", bodyKey: "templates.productBody" },
  { id: "price", presetId: "50x25", nameKey: "templates.price", bodyKey: "templates.priceBody" },
  { id: "inventory", presetId: "4x2", nameKey: "templates.inventory", bodyKey: "templates.inventoryBody" },
];

export function buildTemplate(id: TemplateId, current: Doc): Partial<Doc> {
  if (id === "blank") return { elements: [] };
  const meta = TEMPLATES.find((t) => t.id === id)!;
  const preset = LABEL_PRESETS.find((p) => p.id === meta.presetId) ?? LABEL_PRESETS[0];
  const [w, h] = presetDots(preset, current.dpi);
  const f = current.dpi / 203;
  const s = (n: number) => Math.round(n * f);
  const elements: LabelElement[] = [];
  const push = (el: LabelElement) => {
    el.x = s(el.x);
    el.y = s(el.y);
    if (el.type === "text") {
      el.h = s(el.h);
      el.w = s(el.w);
      if (el.block) el.block.width = s(el.block.width);
    } else if (el.type === "box") {
      el.width = s(el.width);
      el.height = s(el.height);
      el.thickness = s(el.thickness);
    } else if (el.type === "line") {
      el.length = s(el.length);
      el.thickness = Math.max(1, s(el.thickness));
    } else if (el.type === "circle") {
      el.diameter = s(el.diameter);
      el.thickness = Math.max(2, s(el.thickness));
    } else if (el.type === "barcode") {
      el.height = s(el.height);
      el.moduleWidth = Math.max(1, Math.round(el.moduleWidth * f));
    }
    elements.push(el);
  };

  if (id === "shipping") {
    const bar = newBox(24, 24, w - 48, 90);
    bar.thickness = 90;
    push(bar);
    const title = newText(46, 26, "ENVÍO PRIORITARIO", "0", 50);
    title.reverse = true;
    push(title);

    push(newText(48, 140, "DESTINATARIO", "B", 22));
    push(newText(48, 168, "Leomar Escobar", "0", 54));
    push(newText(48, 240, "Calle 50 #123, Ciudad de Panamá", "0", 30));
    push(newText(48, 282, "Tel. +507 6000-0000", "0", 28));

    const qr = newBarcode(600, 330, "qrcode");
    qr.moduleWidth = 5;
    qr.data = "https://track.zfd/000123456789";
    push(qr);

    push(newBox(48, 350, 500, 150));
    push(newText(66, 368, "CONTENIDO", "B", 20));
    push(newText(66, 402, "2 × Café Geisha 250 g", "0", 30));
    push(newText(66, 446, "Frágil · Mantener seco", "0", 24));

    push(newText(48, 560, "DESTINO", "B", 20));
    push(newText(48, 590, "Ciudad de Panamá", "0", 40));
    push(newText(48, 644, "Zona 8 · Panamá", "0", 28));

    push(newLine(48, 800, w - 96));
    push(newText(48, 820, "SEGUIMIENTO", "B", 22));
    const code = newBarcode(48, 852, "code128");
    code.data = "ZFD202600012345";
    code.moduleWidth = 2;
    code.height = 150;
    push(code);

    push(newLine(24, 1080, w - 48));
    push(newText(48, 1100, "Peso 2.4 kg · 1 bulto · 14/11/2026", "0", 24));
    push(newText(600, 1100, "ZFD", "G", 24));
  }

  if (id === "product") {
    const frame = newBox(20, 20, w - 40, h - 40);
    frame.thickness = 2;
    push(frame);
    push(newText(48, 52, "CAFÉ GEISHA", "0", 64));
    push(newText(48, 132, "Tueste medio · 250 g", "0", 28));
    push(newLine(48, 180, 430));
    push(newText(48, 214, "$12.50", "0", 92));
    push(newText(48, 316, "Lote 0426 · Origen Boquete", "0", 24));

    const circle = newCircle(590, 90, 150);
    circle.thickness = 150;
    push(circle);
    const mark = newText(626, 146, "Z", "G", 72);
    mark.reverse = true;
    push(mark);

    const code = newBarcode(48, 390, "ean13");
    code.data = "7501234567890";
    code.moduleWidth = 2;
    code.height = 110;
    push(code);
    push(newText(560, 430, "SKU 00123", "0", 26));
    push(newText(560, 466, "ZFD-2026", "0", 22));
  }

  if (id === "price") {
    push(newText(24, 20, "CAFÉ GEISHA 250 g", "0", 26));
    push(newText(20, 52, "$12.50", "0", 78));
    const rule = newLine(24, 138, w - 48);
    rule.thickness = 3;
    push(rule);
    const code = newBarcode(24, 148, "code128");
    code.data = "750123456789";
    code.moduleWidth = 1;
    code.height = 34;
    push(code);
  }

  if (id === "inventory") {
    const frame = newBox(16, 16, w - 32, h - 32);
    frame.thickness = 2;
    push(frame);
    push(newText(40, 36, "SKU-004521", "0", 46));
    push(newText(40, 96, "Estante B-04 · Nivel 2", "0", 26));
    push(newText(40, 134, "Café Geisha 250 g", "0", 24));
    push(newText(40, 168, "Ingreso 14/11/2026", "0", 20));

    const qr = newBarcode(560, 44, "qrcode");
    qr.moduleWidth = 5;
    qr.data = "ZFD|SKU-004521|B-04";
    push(qr);

    const code = newBarcode(40, 240, "code128");
    code.data = "SKU004521";
    code.moduleWidth = 2;
    code.height = 70;
    push(code);
  }

  return {
    name: id === "shipping" ? "Envío" : id === "product" ? "Producto" : id === "price" ? "Precio" : "Inventario",
    widthMm: preset.widthMm,
    heightMm: preset.heightMm,
    widthDots: w,
    heightDots: h,
    elements,
  };
}

export function templateDots(meta: TemplateMeta, dpi: Dpi): [number, number] {
  const preset = LABEL_PRESETS.find((p) => p.id === meta.presetId) ?? LABEL_PRESETS[0];
  return [mmToDots(preset.widthMm, dpi), mmToDots(preset.heightMm, dpi)];
}