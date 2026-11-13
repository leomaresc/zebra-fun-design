import type { ImageElement } from "../types";

export interface ProcessedImage {
  canvas: HTMLCanvasElement;
  bits: Uint8Array;
  bytesPerRow: number;
  width: number;
  height: number;
}

const imageCache = new Map<string, HTMLImageElement>();
const processedCache = new Map<string, ProcessedImage>();
const pending = new Map<string, Promise<ProcessedImage | null>>();

function keyOf(el: ImageElement): string {
  const tail = el.src.length > 64 ? el.src.slice(-48) : el.src;
  return `${el.src.length}:${tail}|${el.width}x${el.height}|${el.threshold}|${el.dither ? 1 : 0}|${el.invert ? 1 : 0}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error("image-load"));
    img.src = src;
  });
}

export function getProcessed(el: ImageElement): ProcessedImage | null {
  return processedCache.get(keyOf(el)) ?? null;
}

export function prepareImage(el: ImageElement): Promise<ProcessedImage | null> {
  const key = keyOf(el);
  const ready = processedCache.get(key);
  if (ready) return Promise.resolve(ready);
  const running = pending.get(key);
  if (running) return running;

  const job = (async () => {
    try {
      const img = await loadImage(el.src);
      const width = Math.max(1, Math.round(el.width));
      const height = Math.max(1, Math.round(el.height));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      const data = ctx.getImageData(0, 0, width, height);
      const px = data.data;
      const gray = new Float32Array(width * height);
      for (let i = 0; i < width * height; i++) {
        const r = px[i * 4];
        const g = px[i * 4 + 1];
        const b = px[i * 4 + 2];
        const a = px[i * 4 + 3] / 255;
        // Composite over white so transparent PNGs behave like the label stock.
        const v = (0.299 * r + 0.587 * g + 0.114 * b) * a + 255 * (1 - a);
        gray[i] = el.invert ? 255 - v : v;
      }

      const black = new Uint8Array(width * height);
      const threshold = el.threshold;
      if (el.dither) {
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = y * width + x;
            const old = gray[i];
            const next = old < threshold ? 0 : 255;
            black[i] = next === 0 ? 1 : 0;
            const err = old - next;
            if (x + 1 < width) gray[i + 1] += (err * 7) / 16;
            if (y + 1 < height) {
              if (x > 0) gray[i + width - 1] += (err * 3) / 16;
              gray[i + width] += (err * 5) / 16;
              if (x + 1 < width) gray[i + width + 1] += (err * 1) / 16;
            }
          }
        }
      } else {
        for (let i = 0; i < width * height; i++) black[i] = gray[i] < threshold ? 1 : 0;
      }

      const out = ctx.createImageData(width, height);
      for (let i = 0; i < width * height; i++) {
        const v = black[i] ? 0 : 255;
        out.data[i * 4] = v;
        out.data[i * 4 + 1] = v;
        out.data[i * 4 + 2] = v;
        out.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(out, 0, 0);

      const bytesPerRow = Math.ceil(width / 8);
      const bits = new Uint8Array(bytesPerRow * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (black[y * width + x]) bits[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
        }
      }

      const result: ProcessedImage = { canvas, bits, bytesPerRow, width, height };
      processedCache.set(key, result);
      if (processedCache.size > 24) {
        const first = processedCache.keys().next().value;
        if (first) processedCache.delete(first);
      }
      return result;
    } catch (err) {
      console.warn("prepareImage failed", err);
      return null;
    } finally {
      pending.delete(key);
    }
  })();

  pending.set(key, job);
  return job;
}

export function bitsToHex(bits: Uint8Array, width: number, bytesPerRow: number): string {
  const rows: string[] = [];
  for (let y = 0; y < bits.length / bytesPerRow; y++) {
    let row = "";
    for (let x = 0; x < bytesPerRow; x++) {
      row += bits[y * bytesPerRow + x].toString(16).toUpperCase().padStart(2, "0");
    }
    rows.push(row);
  }
  void width;
  return rows.join("\n");
}