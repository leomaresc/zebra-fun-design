export interface UploadedImage {
  src: string;
  width: number;
  height: number;
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });
}

/** Load a user image, downscaling very large files so projects stay portable. */
export async function readImageFile(file: File, maxSide = 1600): Promise<UploadedImage> {
  const raw = await readAsDataURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("decode"));
    image.src = raw;
  });

  const largest = Math.max(img.naturalWidth, img.naturalHeight);
  if (largest <= maxSide) {
    return { src: raw, width: img.naturalWidth, height: img.naturalHeight };
  }

  const scale = maxSide / largest;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { src: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
}