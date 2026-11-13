import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Editor } from "../store";
import type { LabelElement, Tool } from "../types";
import { boundsOf, drawLabel, drawSelection, handlesOf, hitTest, textDrawTop } from "../render/render";
import { getProcessed, prepareImage } from "../render/image";
import { readImageFile } from "../render/upload";
import { barcodeBox, barcodeRender } from "../zpl/barcode";
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
import { useI18n } from "../i18n";
import { Icon } from "./Icon";
import { IconButton } from "./ui";

const RULER = 24;
const MIN_ZOOM = 0.06;
const MAX_ZOOM = 5;

type DragState =
  | { kind: "pan"; sx: number; sy: number; panX: number; panY: number }
  | { kind: "move"; sx: number; sy: number; originals: { id: string; x: number; y: number }[]; primary: string }
  | {
      kind: "resize";
      sx: number;
      sy: number;
      id: string;
      corner: "nw" | "ne" | "sw" | "se";
      original: LabelElement;
      box: { x: number; y: number; w: number; h: number };
    }
  | { kind: "create"; id: string; sx: number; sy: number; moved: boolean }
  | { kind: "marquee"; sx: number; sy: number; additive: boolean };

interface Marquee {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function CanvasStage({
  editor,
  tool,
  setTool,
  onOpenTemplates,
  onToast,
  onImageAdded,
}: {
  editor: Editor;
  tool: Tool;
  setTool: (t: Tool) => void;
  onOpenTemplates: () => void;
  onToast: (msg: string) => void;
  onImageAdded: (id: string) => void;
}) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(0.6);
  const [pan, setPan] = useState({ x: 60, y: 40 });
  const [showGrid, setShowGrid] = useState(true);
  const [snapOn, setSnapOn] = useState(true);
  const [panning, setPanning] = useState(false);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const [dropOver, setDropOver] = useState(false);
  const [editing, setEditing] = useState<{ id: string; value: string; isNew: boolean } | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);

  const drag = useRef<DragState | null>(null);
  const view = useRef({ zoom, pan, size });
  view.current = { zoom, pan, size };
  const docRef = editor.docRef;
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const fitted = useRef(false);
  const lastDims = useRef(`${editor.doc.widthDots}x${editor.doc.heightDots}`);
  const fileInput = useRef<HTMLInputElement>(null);
  const pendingPoint = useRef<{ x: number; y: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const snap = useCallback(
    (value: number) => (snapOn ? Math.round(value / 10) * 10 : Math.round(value)),
    [snapOn],
  );

  const fit = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const doc = docRef.current;
    const availW = Math.max(80, rect.width - RULER - 56);
    const availH = Math.max(80, rect.height - RULER - 56);
    const z = Math.min(availW / doc.widthDots, availH / doc.heightDots, 2.2);
    const next = Math.max(MIN_ZOOM, z);
    setZoom(next);
    setPan({
      x: RULER + (rect.width - RULER - doc.widthDots * next) / 2,
      y: RULER + (rect.height - RULER - doc.heightDots * next) / 2,
    });
    fitted.current = true;
  }, [docRef]);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setSize({ w: Math.max(1, rect.width), h: Math.max(1, rect.height) });
      if (!fitted.current) fit();
    });
    observer.observe(el);
    const rect = el.getBoundingClientRect();
    setSize({ w: Math.max(1, rect.width), h: Math.max(1, rect.height) });
    return () => observer.disconnect();
  }, [fit]);

  // Keep the label centered when the viewport (or the inspector) changes size.
  const prevStage = useRef({ w: 0, h: 0 });
  useEffect(() => {
    const prev = prevStage.current;
    if (fitted.current && prev.w > 1 && (prev.w !== size.w || prev.h !== size.h)) {
      setPan((p) => ({ x: p.x + (size.w - prev.w) / 2, y: p.y + (size.h - prev.h) / 2 }));
    }
    prevStage.current = { w: size.w, h: size.h };
  }, [size.w, size.h]);

  useEffect(() => {
    if (!fitted.current && size.w > 1) fit();
  }, [size, fit]);

  useEffect(() => {
    const dims = `${editor.doc.widthDots}x${editor.doc.heightDots}`;
    if (dims !== lastDims.current) {
      lastDims.current = dims;
      fit();
    }
  }, [editor.doc.widthDots, editor.doc.heightDots, fit]);

  // Repaint on every meaningful change.
  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const { w, h } = size;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const doc = docRef.current;
    const labelW = doc.widthDots * zoom;
    const labelH = doc.heightDots * zoom;

    // Paper + shadow.
    ctx.save();
    ctx.shadowColor = "rgba(20, 22, 30, 0.24)";
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(pan.x, pan.y, labelW, labelH);
    ctx.restore();

    // Label content (clipped to the stock).
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);
    ctx.beginPath();
    ctx.rect(0, 0, doc.widthDots, doc.heightDots);
    ctx.clip();
    const errorIds = new Set<string>();
    for (const el of doc.elements) {
      if (el.type === "barcode" && barcodeRender(el).error) errorIds.add(el.id);
    }
    drawLabel(ctx, doc, {
      zoom,
      showGrid,
      editingId: editing?.id ?? null,
      errorIds,
    });
    ctx.restore();

    // Stock edge.
    ctx.strokeStyle = "rgba(20, 22, 30, 0.18)";
    ctx.lineWidth = 1;
    ctx.strokeRect(pan.x + 0.5, pan.y + 0.5, labelW - 1, labelH - 1);

    // Selection.
    if (editor.selection.length && !editing) {
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);
      drawSelection(ctx, doc, editor.selection, zoom, "#2b3cf0");
      ctx.restore();
    }

    // Marquee.
    if (marquee) {
      ctx.save();
      ctx.fillStyle = "rgba(43, 60, 240, 0.08)";
      ctx.strokeStyle = "#2b3cf0";
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1;
      ctx.fillRect(marquee.x, marquee.y, marquee.w, marquee.h);
      ctx.strokeRect(marquee.x + 0.5, marquee.y + 0.5, marquee.w, marquee.h);
      ctx.restore();
    }

    drawRulers(ctx, { w, h }, doc, pan, zoom);

    void labelH;
  }, [docRef, editor.selection, editing, marquee, pan, showGrid, size, zoom]);

  useEffect(() => {
    paint();
  }, [paint, editor.doc, editor.selection, editor.imageTick]);

  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => {
      if (alive) paint();
    });
    return () => {
      alive = false;
    };
  }, [paint]);

  // Prepare bitmaps for any image element in the document.
  useEffect(() => {
    const images = editor.doc.elements.filter((el): el is Extract<LabelElement, { type: "image" }> => el.type === "image");
    let alive = true;
    for (const el of images) {
      if (!getProcessed(el)) {
        prepareImage(el).then((res) => {
          if (alive && res) paint();
        });
      }
    }
    return () => {
      alive = false;
    };
  }, [editor.doc.elements, paint]);

  // Space to pan.
  useEffect(() => {
    const isField = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isField(e.target) && !editingRef.current) {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Wheel zoom / scroll (native so preventDefault works).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const v = view.current;
      if (e.ctrlKey || e.metaKey) {
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const factor = Math.exp(-e.deltaY * 0.0016);
        const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v.zoom * factor));
        const k = next / v.zoom;
        setZoom(next);
        setPan({ x: mx - (mx - v.pan.x) * k, y: my - (my - v.pan.y) * k });
      } else {
        setPan({ x: v.pan.x - e.deltaX, y: v.pan.y - e.deltaY });
      }
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  const pointOf = (e: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const toDoc = (p: { x: number; y: number }) => ({ x: (p.x - pan.x) / zoom, y: (p.y - pan.y) / zoom });

  const addText = useCallback(
    (x: number, y: number) => {
      const el = newText(x, y, "", "0", 36);
      editor.beginGesture();
      editor.live((d) => ({ ...d, elements: [...d.elements, el] }));
      editor.setSelection([el.id]);
      setEditing({ id: el.id, value: "", isNew: true });
      setTool("select");
    },
    [editor, setTool],
  );

  const addBarcodeAt = useCallback(
    (x: number, y: number) => {
      const doc = docRef.current;
      const el = newBarcode(x, y, "code128");
      const box = barcodeBox(el);
      el.x = Math.max(0, Math.min(el.x, doc.widthDots - box.width));
      el.y = Math.max(0, Math.min(el.y, doc.heightDots - box.height));
      editor.addElement(el);
      setTool("select");
    },
    [editor, setTool],
  );

  const startEditing = useCallback(
    (id: string) => {
      const el = docRef.current.elements.find((e) => e.id === id);
      if (!el || el.type !== "text" || el.locked) return;
      editor.beginGesture();
      editor.setSelection([id]);
      setEditing({ id, value: el.text, isNew: false });
      setTool("select");
    },
    [editor, setTool],
  );

  const commitEditing = useCallback(() => {
    const current = editingRef.current;
    if (!current) return;
    setEditing(null);
    editingRef.current = null;
    if (!current.value.trim()) {
      editor.cancelGesture();
      if (!current.isNew) editor.deleteElement(current.id);
      return;
    }
    editor.endGesture();
  }, [editor]);

  const cancelEditing = useCallback(() => {
    if (!editingRef.current) return;
    setEditing(null);
    editingRef.current = null;
    editor.cancelGesture();
    setTool("select");
  }, [editor, setTool]);

  useEffect(() => {
    if (editing) {
      const timer = window.setTimeout(() => {
        textareaRef.current?.focus();
        if (editing.isNew) textareaRef.current?.select();
      }, 10);
      return () => window.clearTimeout(timer);
    }
  }, [editing?.id]);

  // ---------------- pointer interactions ----------------

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (editing) {
      commitEditing();
    }
    if (e.button === 2) return;
    const p = pointOf(e);
    if (p.x < RULER || p.y < RULER) return;
    const d = toDoc(p);

    if (e.button === 1 || spaceDown || tool === "hand") {
      drag.current = { kind: "pan", sx: p.x, sy: p.y, panX: pan.x, panY: pan.y };
      setPanning(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }

    if (tool === "text") {
      addText(d.x, d.y);
      return;
    }
    if (tool === "barcode") {
      addBarcodeAt(d.x, d.y);
      return;
    }
    if (tool === "image") {
      pendingPoint.current = d;
      fileInput.current?.click();
      return;
    }

    if (tool === "box" || tool === "line" || tool === "circle" || tool === "ellipse" || tool === "diagonal") {
      const el = makeShape(tool, snap(d.x), snap(d.y));
      editor.beginGesture();
      editor.live((doc) => ({ ...doc, elements: [...doc.elements, el] }));
      editor.setSelection([el.id]);
      drag.current = { kind: "create", id: el.id, sx: d.x, sy: d.y, moved: false };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    // Select tool.
    const handles = handlesOf(editor.doc, editor.selection);
    for (const h of handles) {
      const sx = pan.x + h.x * zoom;
      const sy = pan.y + h.y * zoom;
      if (Math.abs(sx - p.x) <= 8 && Math.abs(sy - p.y) <= 8) {
        const el = editor.doc.elements.find((item) => item.id === h.id);
        if (!el) break;
        editor.beginGesture();
        drag.current = {
          kind: "resize",
          sx: d.x,
          sy: d.y,
          id: el.id,
          corner: h.corner,
          original: { ...el },
          box: boundsOf(el),
        };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }
    }

    const hit = hitTest(editor.doc, d.x, d.y);
    if (hit) {
      let ids = editor.selection;
      if (e.shiftKey) {
        ids = ids.includes(hit.id) ? ids : [...ids, hit.id];
        editor.setSelection(ids);
      } else if (!ids.includes(hit.id)) {
        ids = [hit.id];
        editor.setSelection(ids);
      }
      const movable = ids.filter((id) => {
        const el = editor.doc.elements.find((item) => item.id === id);
        return el && !el.locked;
      });
      if (movable.length) {
        editor.beginGesture();
        drag.current = {
          kind: "move",
          sx: d.x,
          sy: d.y,
          primary: hit.id,
          originals: movable.map((id) => {
            const el = editor.doc.elements.find((item) => item.id === id)!;
            return { id, x: el.x, y: el.y };
          }),
        };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }
      return;
    }

    if (!e.shiftKey) editor.setSelection([]);
    drag.current = { kind: "marquee", sx: p.x, sy: p.y, additive: e.shiftKey };
    setMarquee({ x: p.x, y: p.y, w: 0, h: 0 });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const state = drag.current;
    if (!state) return;
    const p = pointOf(e);
    const d = toDoc(p);

    if (state.kind === "pan") {
      setPan({ x: state.panX + (p.x - state.sx), y: state.panY + (p.y - state.sy) });
      return;
    }

    if (state.kind === "move") {
      let dx = d.x - state.sx;
      let dy = d.y - state.sy;
      if (snapOn) {
        const primary = state.originals.find((o) => o.id === state.primary);
        if (primary) {
          dx = snap(primary.x + dx) - primary.x;
          dy = snap(primary.y + dy) - primary.y;
        }
      }
      const map = new Map(state.originals.map((o) => [o.id, o]));
      editor.live((doc) => ({
        ...doc,
        elements: doc.elements.map((el) => {
          const o = map.get(el.id);
          return o ? ({ ...el, x: Math.round(o.x + dx), y: Math.round(o.y + dy) } as LabelElement) : el;
        }),
      }));
      return;
    }

    if (state.kind === "resize") {
      const nb = resizeBox(state.box, state.corner, d.x - state.sx, d.y - state.sy, snapOn ? snap : (v: number) => Math.round(v));
      const patch = resizePatch(state.original, state.box, nb);
      editor.updateElement(state.id, patch, false);
      return;
    }

    if (state.kind === "create") {
      state.moved = true;
      const dx = d.x - state.sx;
      const dy = d.y - state.sy;
      const x = snap(Math.min(state.sx, d.x));
      const y = snap(Math.min(state.sy, d.y));
      const w = Math.max(1, snap(Math.abs(dx)));
      const h = Math.max(1, snap(Math.abs(dy)));
      const el = docRef.current.elements.find((item) => item.id === state.id);
      if (!el) return;
      if (el.type === "box") {
        editor.updateElement(state.id, { x, y, width: Math.max(4, w), height: Math.max(4, h) }, false);
      } else if (el.type === "line") {
        if (Math.abs(dx) >= Math.abs(dy)) {
          editor.updateElement(state.id, { x: snap(Math.min(state.sx, d.x)), y: snap(state.sy), length: Math.max(4, w), orientation: "h" }, false);
        } else {
          editor.updateElement(state.id, { x: snap(state.sx), y, length: Math.max(4, h), orientation: "v" }, false);
        }
      } else if (el.type === "circle") {
        const dia = Math.max(4, Math.max(w, h));
        editor.updateElement(state.id, { x, y, diameter: dia }, false);
      } else if (el.type === "ellipse") {
        editor.updateElement(state.id, { x, y, width: Math.max(4, w), height: Math.max(4, h) }, false);
      } else if (el.type === "diagonal") {
        editor.updateElement(
          state.id,
          { x, y, width: Math.max(4, w), height: Math.max(4, h), slash: dx * dy < 0 },
          false,
        );
      }
      return;
    }

    if (state.kind === "marquee") {
      setMarquee({
        x: Math.min(state.sx, p.x),
        y: Math.min(state.sy, p.y),
        w: Math.abs(p.x - state.sx),
        h: Math.abs(p.y - state.sy),
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const state = drag.current;
    drag.current = null;
    setPanning(false);
    if (!state) return;

    if (state.kind === "create") {
      const el = docRef.current.elements.find((item) => item.id === state.id);
      if (el) {
        if (!state.moved || (el.type === "box" && el.width < 8 && el.height < 8)) {
          const defaults = defaultSizeFor(el, docRef.current);
          editor.updateElement(el.id, defaults, false);
        }
      }
      editor.endGesture();
      setTool("select");
      return;
    }

    if (state.kind === "move" || state.kind === "resize") {
      editor.endGesture();
      return;
    }

    if (state.kind === "marquee") {
      const rect = marquee;
      setMarquee(null);
      if (!rect || rect.w < 3 || rect.h < 3) {
        if (!state.additive) editor.setSelection([]);
        return;
      }
      const sel = new Set(state.additive ? editor.selection : []);
      for (const el of docRef.current.elements) {
        const b = boundsOf(el);
        const sx = pan.x + b.x * zoom;
        const sy = pan.y + b.y * zoom;
        const sw = b.w * zoom;
        const sh = b.h * zoom;
        if (sx < rect.x + rect.w && sx + sw > rect.x && sy < rect.y + rect.h && sy + sh > rect.y) sel.add(el.id);
      }
      editor.setSelection([...sel]);
      return;
    }
  };

  const onDoubleClick = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = pointOf(e);
    const d = toDoc(p);
    const hit = hitTest(editor.doc, d.x, d.y);
    if (hit && hit.type === "text") {
      startEditing(hit.id);
    }
  };

  // ---------------- image upload ----------------

  const onFiles = async (files: FileList | null, at?: { x: number; y: number }) => {
    const file = files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const img = await readImageFile(file);
      const doc = docRef.current;
      const maxW = doc.widthDots * 0.6;
      const maxH = doc.heightDots * 0.5;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = Math.max(8, Math.round(img.width * scale));
      const h = Math.max(8, Math.round(img.height * scale));
      const pos = at ?? { x: (doc.widthDots - w) / 2, y: (doc.heightDots - h) / 2 };
      const el = newImage(Math.max(0, pos.x), Math.max(0, pos.y), img.src, w, h);
      editor.addElement(el);
      await prepareImage(el);
      paint();
      onImageAdded(el.id);
      setTool("select");
    } catch {
      onToast(t("toast.importError"));
    }
  };

  // ---------------- inline editor geometry ----------------

  const editingEl = editing ? editor.doc.elements.find((el) => el.id === editing.id) : null;
  const editorStyle = (() => {
    if (!editing || !editingEl || editingEl.type !== "text") return null;
    const b = boundsOf(editingEl);
    const x = pan.x + b.x * zoom;
    const y = pan.y + b.y * zoom;
    const lineCount = Math.max(1, editing.value.split("\n").length);
    const blockW = editingEl.block?.width ?? b.w;
    const w = Math.max(130, Math.min(size.w - 24, blockW * zoom + 22));
    const h = Math.max(34, lineCount * editingEl.h * zoom + 10);
    return {
      left: Math.min(Math.max(RULER + 4, x - 4), size.w - w - 8),
      top: Math.min(Math.max(RULER + 4, y - 4), size.h - h - 40),
      width: w,
      height: Math.min(h, Math.max(60, size.h - RULER - 80)),
      fontFamily: editingEl.font === "0" ? '"ZFD Sans", sans-serif' : '"ZFD Mono", monospace',
      fontSize: Math.max(9, editingEl.h * zoom),
      lineHeight: `${Math.max(9, editingEl.h * zoom)}px`,
    };
  })();

  const cursorClass = panning || spaceDown ? "dragging" : "";

  return (
    <div
      className={`stage tool-${tool} ${cursorClass} ${dropOver ? "drop" : ""}`}
      ref={stageRef}
      onDragOver={(e) => {
        e.preventDefault();
        setDropOver(true);
      }}
      onDragLeave={() => setDropOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDropOver(false);
        const p = pointOf(e as unknown as PointerEvent);
        const d = toDoc({ x: Math.max(RULER, p.x), y: Math.max(RULER, p.y) });
        void onFiles(e.dataTransfer.files, d);
      }}
    >
      <canvas
        ref={canvasRef}
        className="stage-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      />

      <div className="ruler-corner">0</div>

      {editor.doc.elements.length === 0 && !editing ? (
        <div
          className="empty-state"
          style={{
            left: pan.x + (editor.doc.widthDots * zoom) / 2,
            top: pan.y + (editor.doc.heightDots * zoom) / 2,
            width: Math.min(390, Math.max(240, editor.doc.widthDots * zoom - 24)),
          }}
        >
          <ZebraArt />
          <h2 className="empty-title">{t("canvas.emptyTitle")}</h2>
          <p className="empty-body">{t("canvas.emptyBody")}</p>
          <div className="empty-actions">
            <button className="btn btn-primary btn-sm" type="button" onClick={() => addText(editor.doc.widthDots / 2 - 60, editor.doc.heightDots / 2 - 20)}>
              <Icon name="text" size={14} />
              {t("canvas.addText")}
            </button>
            <button
              className="btn btn-sm"
              type="button"
              onClick={() => addBarcodeAt(editor.doc.widthDots / 2 - 90, editor.doc.heightDots / 2 - 60)}
            >
              <Icon name="barcode" size={14} />
              {t("canvas.addBarcode")}
            </button>
            <button className="btn btn-sm" type="button" onClick={onOpenTemplates}>
              <Icon name="sparkle" size={14} />
              {t("canvas.chooseTemplate")}
            </button>
          </div>
        </div>
      ) : null}

      {editing && editingEl && editorStyle && editingEl.type === "text" ? (
        <div className="inline-editor" style={editorStyle}>
          <div className="inline-editor-bar">
            <button className="btn" type="button" onMouseDown={(e) => e.preventDefault()} onClick={commitEditing}>
              {t("common.done")}
            </button>
          </div>
          <textarea
            ref={textareaRef}
            value={editing.value}
            aria-label={t("inspector.text")}
            spellCheck={false}
            style={{
              fontFamily: editorStyle.fontFamily,
              fontSize: editorStyle.fontSize,
              lineHeight: editorStyle.lineHeight,
              padding: 4,
            }}
            onChange={(e) => {
              const value = e.target.value;
              setEditing((prev) => (prev ? { ...prev, value } : prev));
              editor.updateElement(editing.id, { text: value }, false);
            }}
            onBlur={commitEditing}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                cancelEditing();
              } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                commitEditing();
              }
            }}
          />
        </div>
      ) : null}

      <div className="zoom-pill">
        <IconButton icon="zoomOut" label={t("canvas.zoomOut")} onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z / 1.25))} small />
        <button className="zoom-value" type="button" onClick={() => setZoom(1)} title={t("canvas.actual")}>
          {Math.round(zoom * 100)}%
        </button>
        <IconButton icon="zoomIn" label={t("canvas.zoomIn")} onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.25))} small />
        <div className="zoom-div" />
        <IconButton icon="fit" label={t("canvas.fit")} onClick={fit} small />
        <IconButton icon="grid" label={t("canvas.grid")} onClick={() => setShowGrid((v) => !v)} active={showGrid} small />
        <IconButton icon="magnet" label={t("canvas.snap")} onClick={() => setSnapOn((v) => !v)} active={snapOn} small />
      </div>

      {!editing && tool !== "select" && tool !== "hand" ? (
        <div className="hint">
          {tool === "text"
            ? t("canvas.hintText")
            : tool === "barcode"
              ? t("canvas.hintBarcode")
              : tool === "image"
                ? t("canvas.hintImage")
                : t("canvas.hintDraw")}
        </div>
      ) : null}

      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        style={{ display: "none" }}
        onChange={(e) => {
          void onFiles(e.target.files, pendingPoint.current ?? undefined);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function makeShape(tool: Tool, x: number, y: number): LabelElement {
  switch (tool) {
    case "box":
      return newBox(x, y, 4, 4);
    case "line":
      return newLine(x, y, 4);
    case "circle":
      return newCircle(x, y, 4);
    case "ellipse":
      return newEllipse(x, y, 4, 4);
    case "diagonal":
      return newDiagonal(x, y, 4, 4);
    default:
      return newBox(x, y, 4, 4);
  }
}

function defaultSizeFor(el: LabelElement, doc: { widthDots: number; heightDots: number }): Partial<LabelElement> {
  switch (el.type) {
    case "box":
      return { width: Math.min(240, doc.widthDots - el.x), height: Math.min(100, doc.heightDots - el.y) };
    case "line":
      return { length: Math.min(240, doc.widthDots - el.x) };
    case "circle":
      return { diameter: Math.min(120, doc.widthDots - el.x, doc.heightDots - el.y) };
    case "ellipse":
      return { width: Math.min(240, doc.widthDots - el.x), height: Math.min(120, doc.heightDots - el.y) };
    case "diagonal":
      return { width: Math.min(240, doc.widthDots - el.x), height: Math.min(120, doc.heightDots - el.y) };
    default:
      return {};
  }
}

function resizeBox(
  box: { x: number; y: number; w: number; h: number },
  corner: "nw" | "ne" | "sw" | "se",
  dx: number,
  dy: number,
  snap: (v: number) => number,
) {
  let x = box.x;
  let y = box.y;
  let w = box.w;
  let h = box.h;
  if (corner === "nw" || corner === "sw") {
    const nx = snap(box.x + dx);
    w = box.x + box.w - nx;
    x = nx;
  } else {
    w = snap(box.x + box.w + dx) - box.x;
  }
  if (corner === "nw" || corner === "ne") {
    const ny = snap(box.y + dy);
    h = box.y + box.h - ny;
    y = ny;
  } else {
    h = snap(box.y + box.h + dy) - box.y;
  }
  if (w < 4) {
    w = 4;
    if (corner === "nw" || corner === "sw") x = box.x + box.w - 4;
  }
  if (h < 4) {
    h = 4;
    if (corner === "nw" || corner === "ne") y = box.y + box.h - 4;
  }
  return { x, y, w, h };
}

function resizePatch(original: LabelElement, box: { x: number; y: number; w: number; h: number }, nb: { x: number; y: number; w: number; h: number }): Partial<LabelElement> {
  const scaleH = Math.max(0.05, nb.h / Math.max(1, box.h));
  const scaleW = Math.max(0.05, nb.w / Math.max(1, box.w));
  switch (original.type) {
    case "text": {
      const scale = original.rotation === "R" || original.rotation === "B" ? scaleW : scaleH;
      return {
        x: nb.x,
        y: original.origin === "FT" ? Math.round(original.y + (nb.y - box.y)) : nb.y,
        h: Math.max(6, Math.round(original.h * scale)),
        w: Math.max(3, Math.round(original.w * scale)),
      };
    }
    case "barcode":
      return {
        x: nb.x,
        y: nb.y,
        moduleWidth: Math.max(1, Math.min(10, Math.round(original.moduleWidth * scaleW))),
        height: Math.max(10, Math.round(original.height * scaleH)),
      };
    case "box":
      return { x: nb.x, y: nb.y, width: Math.max(4, Math.round(nb.w)), height: Math.max(4, Math.round(nb.h)) };
    case "ellipse":
    case "diagonal":
      return { x: nb.x, y: nb.y, width: Math.max(4, Math.round(nb.w)), height: Math.max(4, Math.round(nb.h)) };
    case "circle":
      return { x: nb.x, y: nb.y, diameter: Math.max(4, Math.round(Math.max(nb.w, nb.h))) };
    case "line":
      return original.orientation === "h"
        ? { x: nb.x, length: Math.max(4, Math.round(nb.w)) }
        : { y: nb.y, length: Math.max(4, Math.round(nb.h)) };
    case "image":
      return { x: nb.x, y: nb.y, width: Math.max(4, Math.round(nb.w)), height: Math.max(4, Math.round(nb.h)) };
    default:
      return {};
  }
}

function drawRulers(
  ctx: CanvasRenderingContext2D,
  size: { w: number; h: number },
  doc: { widthDots: number; heightDots: number; dpi: number },
  pan: { x: number; y: number },
  zoom: number,
) {
  const bg = "#fbfbf8";
  ctx.save();
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size.w, RULER);
  ctx.fillRect(0, 0, RULER, size.h);
  ctx.strokeStyle = "#d8d6cf";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, RULER + 0.5);
  ctx.lineTo(size.w, RULER + 0.5);
  ctx.moveTo(RULER + 0.5, 0);
  ctx.lineTo(RULER + 0.5, size.h);
  ctx.stroke();

  // Highlight the stock span.
  ctx.fillStyle = "rgba(43, 60, 240, 0.10)";
  ctx.fillRect(pan.x, RULER - 3, doc.widthDots * zoom, 3);
  ctx.fillRect(RULER - 3, pan.y, 3, doc.heightDots * zoom);

  const pxPerMm = (zoom * doc.dpi) / 25.4;
  const targets = [1, 2, 5, 10, 20, 50, 100, 200];
  const majorMm = targets.find((mm) => mm * pxPerMm >= 58) ?? 500;
  const majorDots = (majorMm / 25.4) * doc.dpi;
  const minorDots = majorDots / 5;

  ctx.font = '8px "ZFD Mono", monospace';
  ctx.fillStyle = "#8b8d94";
  ctx.strokeStyle = "#bcbab3";

  const maxX = Math.min(doc.widthDots, (size.w - pan.x) / zoom);
  const maxY = Math.min(doc.heightDots, (size.h - pan.y) / zoom);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  for (let d = 0; d <= maxX + 0.01; d += minorDots) {
    const x = pan.x + d * zoom;
    if (x < RULER + 1) continue;
    const major = Math.abs(d / majorDots - Math.round(d / majorDots)) < 0.01;
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, RULER - (major ? 7 : 4));
    ctx.lineTo(Math.round(x) + 0.5, RULER);
    ctx.stroke();
    if (major) {
      const mm = Math.round(d / doc.dpi * 25.4);
      ctx.fillText(String(mm), Math.round(x) + 3, 4);
    }
  }
  for (let d = 0; d <= maxY + 0.01; d += minorDots) {
    const y = pan.y + d * zoom;
    if (y < RULER + 1) continue;
    const major = Math.abs(d / majorDots - Math.round(d / majorDots)) < 0.01;
    ctx.beginPath();
    ctx.moveTo(RULER - (major ? 7 : 4), Math.round(y) + 0.5);
    ctx.lineTo(RULER, Math.round(y) + 0.5);
    ctx.stroke();
    if (major) {
      const mm = Math.round(d / doc.dpi * 25.4);
      ctx.save();
      ctx.translate(4, Math.round(y) + 3);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "left";
      ctx.fillText(String(mm), 6, 0);
      ctx.restore();
    }
  }
  ctx.restore();
}

function ZebraArt() {
  return (
    <svg className="empty-art" viewBox="0 0 160 110" fill="none" aria-hidden="true">
      <rect x="18" y="16" width="124" height="78" rx="5" fill="#fff" stroke="#15161a" strokeWidth="1.4" />
      <path d="M27 27h34M27 39h52M27 51h26M27 63h44M27 75h20" stroke="#15161a" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
      <path d="M97 27h28M97 39h36M97 51h18M97 63h30M97 75h24" stroke="#15161a" strokeWidth="4" strokeLinecap="round" opacity="0.28" />
      <rect x="70" y="88" width="60" height="18" rx="3" fill="#2b3cf0" />
      <path d="M78 97h6M88 97h12M104 97h18" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M12 8l4 4M148 98l4 4M148 8l-4 4M12 102l4-4" stroke="#15161a" strokeWidth="1.2" opacity="0.4" />
    </svg>
  );
}