/**
 * Biblioteca de iconos. Cada uno se dibuja en un lienzo cuadrado de lado `s`
 * y se inserta en la etiqueta como una imagen 1 bit (igual que una foto), así
 * que se puede redimensionar, umbralizar y se exporta como ^GFA.
 */

export interface IconDef {
  id: string;
  draw: (ctx: CanvasRenderingContext2D, s: number) => void;
}

const TAU = Math.PI * 2;
const BLACK = "#000000";
const WHITE = "#ffffff";

function head(ctx: CanvasRenderingContext2D, s: number, cy: number, r: number) {
  ctx.fillStyle = BLACK;
  ctx.beginPath();
  ctx.arc(s * 0.5, s * cy, s * r, 0, TAU);
  ctx.fill();
}

function torso(ctx: CanvasRenderingContext2D, pts: number[][]) {
  ctx.fillStyle = BLACK;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

export const ICONS: IconDef[] = [
  {
    id: "male",
    draw: (c, s) => {
      head(c, s, 0.24, 0.17);
      torso(c, [
        [s * 0.28, s * 0.46], [s * 0.72, s * 0.46], [s * 0.72, s * 0.72],
        [s * 0.62, s * 0.72], [s * 0.62, s * 0.96], [s * 0.54, s * 0.96],
        [s * 0.54, s * 0.74], [s * 0.46, s * 0.74], [s * 0.46, s * 0.96],
        [s * 0.38, s * 0.96], [s * 0.38, s * 0.72], [s * 0.28, s * 0.72],
      ]);
    },
  },
  {
    id: "female",
    draw: (c, s) => {
      head(c, s, 0.22, 0.16);
      torso(c, [
        [s * 0.38, s * 0.42], [s * 0.62, s * 0.42], [s * 0.78, s * 0.84],
        [s * 0.22, s * 0.84],
      ]);
      c.fillStyle = BLACK;
      c.fillRect(s * 0.38, s * 0.84, s * 0.08, s * 0.12);
      c.fillRect(s * 0.54, s * 0.84, s * 0.08, s * 0.12);
    },
  },
  {
    id: "unisex",
    draw: (c, s) => {
      head(c, s, 0.24, 0.17);
      torso(c, [
        [s * 0.30, s * 0.46], [s * 0.70, s * 0.46], [s * 0.74, s * 0.76],
        [s * 0.62, s * 0.76], [s * 0.62, s * 0.96], [s * 0.54, s * 0.96],
        [s * 0.54, s * 0.78], [s * 0.46, s * 0.78], [s * 0.46, s * 0.96],
        [s * 0.38, s * 0.96], [s * 0.38, s * 0.76], [s * 0.26, s * 0.76],
      ]);
    },
  },
  {
    id: "warning",
    draw: (c, s) => {
      c.fillStyle = BLACK;
      c.beginPath();
      c.moveTo(s * 0.5, s * 0.07);
      c.lineTo(s * 0.96, s * 0.9);
      c.lineTo(s * 0.04, s * 0.9);
      c.closePath();
      c.fill();
      c.fillStyle = WHITE;
      c.fillRect(s * 0.455, s * 0.36, s * 0.09, s * 0.28);
      c.beginPath();
      c.arc(s * 0.5, s * 0.75, s * 0.055, 0, TAU);
      c.fill();
    },
  },
  {
    id: "error",
    draw: (c, s) => {
      c.strokeStyle = BLACK;
      c.lineWidth = s * 0.1;
      c.lineCap = "round";
      c.beginPath();
      c.arc(s * 0.5, s * 0.5, s * 0.38, 0, TAU);
      c.stroke();
      c.beginPath();
      c.moveTo(s * 0.34, s * 0.34);
      c.lineTo(s * 0.66, s * 0.66);
      c.moveTo(s * 0.66, s * 0.34);
      c.lineTo(s * 0.34, s * 0.66);
      c.stroke();
    },
  },
  {
    id: "info",
    draw: (c, s) => {
      c.strokeStyle = BLACK;
      c.lineWidth = s * 0.09;
      c.lineCap = "round";
      c.beginPath();
      c.arc(s * 0.5, s * 0.5, s * 0.38, 0, TAU);
      c.stroke();
      c.fillStyle = BLACK;
      c.fillRect(s * 0.455, s * 0.45, s * 0.09, s * 0.25);
      c.beginPath();
      c.arc(s * 0.5, s * 0.31, s * 0.06, 0, TAU);
      c.fill();
    },
  },
  {
    id: "check",
    draw: (c, s) => {
      c.strokeStyle = BLACK;
      c.lineWidth = s * 0.09;
      c.lineCap = "round";
      c.lineJoin = "round";
      c.beginPath();
      c.arc(s * 0.5, s * 0.5, s * 0.38, 0, TAU);
      c.stroke();
      c.beginPath();
      c.moveTo(s * 0.3, s * 0.52);
      c.lineTo(s * 0.45, s * 0.67);
      c.lineTo(s * 0.72, s * 0.35);
      c.stroke();
    },
  },
  {
    id: "fragile",
    draw: (c, s) => {
      c.strokeStyle = BLACK;
      c.lineWidth = s * 0.055;
      c.lineJoin = "round";
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(s * 0.3, s * 0.1);
      c.lineTo(s * 0.7, s * 0.1);
      c.lineTo(s * 0.66, s * 0.4);
      c.bezierCurveTo(s * 0.65, s * 0.54, s * 0.57, s * 0.58, s * 0.5, s * 0.58);
      c.bezierCurveTo(s * 0.43, s * 0.58, s * 0.35, s * 0.54, s * 0.34, s * 0.4);
      c.closePath();
      c.stroke();
      c.beginPath();
      c.moveTo(s * 0.5, s * 0.58);
      c.lineTo(s * 0.5, s * 0.86);
      c.stroke();
      c.beginPath();
      c.moveTo(s * 0.3, s * 0.9);
      c.lineTo(s * 0.7, s * 0.9);
      c.stroke();
    },
  },
  {
    id: "dry",
    draw: (c, s) => {
      c.fillStyle = BLACK;
      c.beginPath();
      c.arc(s * 0.5, s * 0.54, s * 0.36, Math.PI, 0);
      c.closePath();
      c.fill();
      c.strokeStyle = BLACK;
      c.lineWidth = s * 0.06;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(s * 0.5, s * 0.54);
      c.lineTo(s * 0.5, s * 0.84);
      c.stroke();
      c.beginPath();
      c.arc(s * 0.42, s * 0.84, s * 0.08, 0, Math.PI);
      c.stroke();
    },
  },
  {
    id: "up",
    draw: (c, s) => {
      c.fillStyle = BLACK;
      for (const cx of [0.34, 0.66]) {
        const x = s * cx;
        c.beginPath();
        c.moveTo(x, s * 0.08);
        c.lineTo(x + s * 0.15, s * 0.34);
        c.lineTo(x - s * 0.15, s * 0.34);
        c.closePath();
        c.fill();
        c.fillRect(x - s * 0.055, s * 0.34, s * 0.11, s * 0.54);
      }
    },
  },
  {
    id: "flammable",
    draw: (c, s) => {
      c.fillStyle = BLACK;
      c.beginPath();
      c.moveTo(s * 0.5, s * 0.06);
      c.bezierCurveTo(s * 0.74, s * 0.32, s * 0.82, s * 0.5, s * 0.74, s * 0.68);
      c.bezierCurveTo(s * 0.68, s * 0.84, s * 0.58, s * 0.94, s * 0.5, s * 0.94);
      c.bezierCurveTo(s * 0.42, s * 0.94, s * 0.32, s * 0.84, s * 0.26, s * 0.68);
      c.bezierCurveTo(s * 0.18, s * 0.5, s * 0.26, s * 0.32, s * 0.5, s * 0.06);
      c.closePath();
      c.fill();
      c.fillStyle = WHITE;
      c.beginPath();
      c.moveTo(s * 0.5, s * 0.46);
      c.bezierCurveTo(s * 0.62, s * 0.58, s * 0.64, s * 0.68, s * 0.58, s * 0.76);
      c.bezierCurveTo(s * 0.54, s * 0.82, s * 0.46, s * 0.82, s * 0.42, s * 0.76);
      c.bezierCurveTo(s * 0.36, s * 0.68, s * 0.38, s * 0.58, s * 0.5, s * 0.46);
      c.closePath();
      c.fill();
    },
  },
  {
    id: "recycle",
    draw: (c, s) => {
      c.strokeStyle = BLACK;
      c.fillStyle = BLACK;
      c.lineCap = "butt";
      for (let i = 0; i < 3; i++) {
        c.save();
        c.translate(s * 0.5, s * 0.5);
        c.rotate((i * TAU) / 3);
        c.lineWidth = s * 0.085;
        c.beginPath();
        c.arc(0, 0, s * 0.3, Math.PI * 0.12, Math.PI * 0.72);
        c.stroke();
        const end = Math.PI * 0.72;
        c.save();
        c.translate(Math.cos(end) * s * 0.3, Math.sin(end) * s * 0.3);
        c.rotate(end + Math.PI / 2);
        c.beginPath();
        c.moveTo(s * 0.14, 0);
        c.lineTo(-s * 0.07, -s * 0.11);
        c.lineTo(-s * 0.07, s * 0.11);
        c.closePath();
        c.fill();
        c.restore();
        c.restore();
      }
    },
  },
  {
    id: "prohibited",
    draw: (c, s) => {
      c.strokeStyle = BLACK;
      c.lineWidth = s * 0.1;
      c.lineCap = "round";
      c.beginPath();
      c.arc(s * 0.5, s * 0.5, s * 0.38, 0, TAU);
      c.stroke();
      c.beginPath();
      c.moveTo(s * 0.23, s * 0.23);
      c.lineTo(s * 0.77, s * 0.77);
      c.stroke();
    },
  },
  {
    id: "cold",
    draw: (c, s) => {
      c.strokeStyle = BLACK;
      c.lineWidth = s * 0.06;
      c.lineCap = "round";
      for (let i = 0; i < 3; i++) {
        c.save();
        c.translate(s * 0.5, s * 0.5);
        c.rotate((i * Math.PI) / 3);
        c.beginPath();
        c.moveTo(0, -s * 0.4);
        c.lineTo(0, s * 0.4);
        c.stroke();
        for (const sy of [-1, 1]) {
          const y = sy * s * 0.22;
          c.beginPath();
          c.moveTo(0, y);
          c.lineTo(-s * 0.13, y - sy * s * 0.11);
          c.moveTo(0, y);
          c.lineTo(s * 0.13, y - sy * s * 0.11);
          c.stroke();
        }
        c.restore();
      }
    },
  },
  {
    id: "radiation",
    draw: (c, s) => {
      const cx = s * 0.5;
      const cy = s * 0.5;
      const r = s * 0.44;
      const half = Math.PI / 6;
      c.fillStyle = BLACK;
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i * TAU) / 3;
        c.beginPath();
        c.moveTo(cx, cy);
        c.arc(cx, cy, r, a - half, a + half);
        c.closePath();
        c.fill();
      }
      c.fillStyle = WHITE;
      c.beginPath();
      c.arc(cx, cy, s * 0.11, 0, TAU);
      c.fill();
      c.strokeStyle = BLACK;
      c.lineWidth = s * 0.05;
      c.beginPath();
      c.arc(cx, cy, r, 0, TAU);
      c.stroke();
    },
  },
  {
    id: "star",
    draw: (c, s) => {
      c.fillStyle = BLACK;
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? s * 0.46 : s * 0.19;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const x = s * 0.5 + Math.cos(a) * r;
        const y = s * 0.5 + Math.sin(a) * r;
        if (i) c.lineTo(x, y);
        else c.moveTo(x, y);
      }
      c.closePath();
      c.fill();
    },
  },
  {
    id: "heart",
    draw: (c, s) => {
      c.fillStyle = BLACK;
      c.beginPath();
      c.moveTo(s * 0.5, s * 0.86);
      c.bezierCurveTo(s * 0.05, s * 0.55, s * 0.12, s * 0.14, s * 0.5, s * 0.4);
      c.bezierCurveTo(s * 0.88, s * 0.14, s * 0.95, s * 0.55, s * 0.5, s * 0.86);
      c.closePath();
      c.fill();
    },
  },
  {
    id: "arrow",
    draw: (c, s) => {
      c.fillStyle = BLACK;
      c.fillRect(s * 0.08, s * 0.42, s * 0.54, s * 0.16);
      c.beginPath();
      c.moveTo(s * 0.94, s * 0.5);
      c.lineTo(s * 0.6, s * 0.24);
      c.lineTo(s * 0.6, s * 0.76);
      c.closePath();
      c.fill();
    },
  },
  {
    id: "glass",
    draw: (c, s) => {
      c.strokeStyle = BLACK;
      c.lineWidth = s * 0.06;
      c.lineJoin = "round";
      c.beginPath();
      c.moveTo(s * 0.28, s * 0.12);
      c.lineTo(s * 0.72, s * 0.12);
      c.lineTo(s * 0.64, s * 0.88);
      c.lineTo(s * 0.36, s * 0.88);
      c.closePath();
      c.stroke();
    },
  },
];

/** Rasteriza un icono a PNG (para insertarlo como imagen de la etiqueta). */
export function renderIcon(def: IconDef, px = 512): string {
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.clearRect(0, 0, px, px);
  def.draw(ctx, px);
  return canvas.toDataURL("image/png");
}
