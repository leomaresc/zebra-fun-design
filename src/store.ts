import { useCallback, useEffect, useRef, useState } from "react";
import type { Doc, LabelElement } from "./types";
import { emptyDoc, cloneElement } from "./factory";
import { uid } from "./types";
import { getProcessed, prepareImage } from "./render/image";

const STORAGE_KEY = "zfd.project.v1";
const MAX_HISTORY = 80;

function scaleElement(el: LabelElement, f: number): LabelElement {
  const r = (n: number) => Math.max(0, Math.round(n * f));
  const next: LabelElement = { ...el, x: r(el.x), y: r(el.y) };
  switch (next.type) {
    case "text":
      next.h = Math.max(4, r(next.h));
      next.w = Math.max(2, r(next.w));
      if (next.block) next.block = { ...next.block, width: Math.max(1, r(next.block.width)), spacing: Math.round(next.block.spacing * f) };
      break;
    case "box":
      next.width = Math.max(1, r(next.width));
      next.height = Math.max(1, r(next.height));
      next.thickness = Math.max(1, r(next.thickness));
      break;
    case "line":
      next.length = Math.max(1, r(next.length));
      next.thickness = Math.max(1, r(next.thickness));
      break;
    case "circle":
      next.diameter = Math.max(3, r(next.diameter));
      next.thickness = Math.max(2, r(next.thickness));
      break;
    case "ellipse":
      next.width = Math.max(3, r(next.width));
      next.height = Math.max(3, r(next.height));
      next.thickness = Math.max(2, r(next.thickness));
      break;
    case "diagonal":
      next.width = Math.max(3, r(next.width));
      next.height = Math.max(3, r(next.height));
      next.thickness = Math.max(1, r(next.thickness));
      break;
    case "barcode":
      next.height = Math.max(1, r(next.height));
      next.moduleWidth = Math.max(
        1,
        Math.min(next.symbology === "qrcode" || next.symbology === "datamatrix" ? 100 : 10, Math.round(next.moduleWidth * f)),
      );
      break;
    case "image":
      next.width = Math.max(1, r(next.width));
      next.height = Math.max(1, r(next.height));
      break;
  }
  return next;
}

export function loadStoredDoc(): Doc | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Doc;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.elements)) return null;
    return normalizeDoc(parsed);
  } catch {
    return null;
  }
}

export function normalizeDoc(doc: Doc): Doc {
  const base = emptyDoc(doc.dpi ?? 203);
  return {
    ...base,
    ...doc,
    version: 1,
    elements: (doc.elements ?? []).filter(Boolean).map((el) => ({ ...el, id: el.id || uid() })),
  };
}

export function useEditor(initial: Doc) {
  const [doc, setDoc] = useState<Doc>(initial);
  const docRef = useRef(doc);
  docRef.current = doc;
  const [selection, setSelection] = useState<string[]>([]);
  const [histTick, setHistTick] = useState(0);
  const past = useRef<Doc[]>([]);
  const future = useRef<Doc[]>([]);
  const gesture = useRef<Doc | null>(null);
  const clipboard = useRef<LabelElement[]>([]);

  const bump = () => setHistTick((n) => n + 1);

  const commit = useCallback((updater: Doc | ((d: Doc) => Doc)) => {
    const prev = docRef.current;
    const next = typeof updater === "function" ? (updater as (d: Doc) => Doc)(prev) : updater;
    if (next === prev) return;
    past.current.push(prev);
    if (past.current.length > MAX_HISTORY) past.current.shift();
    future.current = [];
    docRef.current = next;
    setDoc(next);
    bump();
  }, []);

  const live = useCallback((updater: Doc | ((d: Doc) => Doc)) => {
    const prev = docRef.current;
    const next = typeof updater === "function" ? (updater as (d: Doc) => Doc)(prev) : updater;
    if (next === prev) return;
    docRef.current = next;
    setDoc(next);
  }, []);

  const beginGesture = useCallback(() => {
    gesture.current = docRef.current;
  }, []);

  const endGesture = useCallback(() => {
    const start = gesture.current;
    gesture.current = null;
    if (!start || start === docRef.current) return;
    past.current.push(start);
    if (past.current.length > MAX_HISTORY) past.current.shift();
    future.current = [];
    bump();
  }, []);

  const cancelGesture = useCallback(() => {
    const start = gesture.current;
    gesture.current = null;
    if (!start) return;
    docRef.current = start;
    setDoc(start);
  }, []);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return false;
    future.current.push(docRef.current);
    docRef.current = prev;
    setDoc(prev);
    bump();
    setSelection((sel) => sel.filter((id) => prev.elements.some((e) => e.id === id)));
    return true;
  }, []);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return false;
    past.current.push(docRef.current);
    docRef.current = next;
    setDoc(next);
    bump();
    setSelection((sel) => sel.filter((id) => next.elements.some((e) => e.id === id)));
    return true;
  }, []);

  // Images are processed off the critical path; bump a tick when one finishes
  // so the live ZPL and the canvas repaint with the real bitmap.
  const [imageTick, setImageTick] = useState(0);
  const syncImage = useCallback((el: LabelElement | undefined | null) => {
    if (!el || el.type !== "image" || getProcessed(el)) return;
    void prepareImage(el).then(() => setImageTick((n) => n + 1));
  }, []);

  const addElement = useCallback(
    (el: LabelElement, select = true) => {
      commit((d) => ({ ...d, elements: [...d.elements, el] }));
      syncImage(el);
      if (select) setSelection([el.id]);
      return el.id;
    },
    [commit, syncImage],
  );

  const updateElement = useCallback(
    (id: string, patch: Partial<LabelElement>, record = true) => {
      const apply = (d: Doc) => ({
        ...d,
        elements: d.elements.map((el) => (el.id === id ? ({ ...el, ...patch } as LabelElement) : el)),
      });
      if (record) commit(apply);
      else live(apply);
      syncImage(docRef.current.elements.find((el) => el.id === id));
    },
    [commit, live, syncImage],
  );

  const updateElements = useCallback(
    (ids: string[], patch: (el: LabelElement) => Partial<LabelElement>, record = true) => {
      const set = new Set(ids);
      const apply = (d: Doc) => ({
        ...d,
        elements: d.elements.map((el) => (set.has(el.id) ? ({ ...el, ...patch(el) } as LabelElement) : el)),
      });
      if (record) commit(apply);
      else live(apply);
      for (const id of ids) syncImage(docRef.current.elements.find((el) => el.id === id));
    },
    [commit, live, syncImage],
  );

  const selectOne = useCallback((id: string | null, additive = false) => {
    setSelection((sel) => {
      if (!id) return [];
      if (!additive) return [id];
      return sel.includes(id) ? sel.filter((s) => s !== id) : [...sel, id];
    });
  }, []);

  const removeSelected = useCallback(() => {
    if (!selection.length) return;
    const set = new Set(selection);
    commit((d) => ({ ...d, elements: d.elements.filter((el) => !set.has(el.id)) }));
    setSelection([]);
  }, [selection, commit]);

  const deleteElement = useCallback(
    (id: string) => {
      commit((d) => ({ ...d, elements: d.elements.filter((el) => el.id !== id) }));
      setSelection((sel) => sel.filter((s) => s !== id));
    },
    [commit],
  );

  const duplicateSelected = useCallback(() => {
    if (!selection.length) return;
    const set = new Set(selection);
    const clones = docRef.current.elements.filter((el) => set.has(el.id)).map((el) => cloneElement(el));
    if (!clones.length) return;
    commit((d) => ({ ...d, elements: [...d.elements, ...clones] }));
    setSelection(clones.map((c) => c.id));
  }, [selection, commit]);

  const copySelected = useCallback(() => {
    const set = new Set(selection);
    clipboard.current = docRef.current.elements.filter((el) => set.has(el.id)).map((el) => ({ ...el }));
  }, [selection]);

  const paste = useCallback(() => {
    if (!clipboard.current.length) return false;
    const clones = clipboard.current.map((el) => cloneElement(el, 20));
    commit((d) => ({ ...d, elements: [...d.elements, ...clones] }));
    setSelection(clones.map((c) => c.id));
    return true;
  }, [commit]);

  const bringForward = useCallback(
    (id: string, direction: 1 | -1 | "front" | "back") => {
      commit((d) => {
        const index = d.elements.findIndex((el) => el.id === id);
        if (index < 0) return d;
        const arr = [...d.elements];
        const [el] = arr.splice(index, 1);
        let target = index;
        if (direction === "front") target = arr.length;
        else if (direction === "back") target = 0;
        else target = Math.max(0, Math.min(arr.length, index + direction));
        arr.splice(target, 0, el);
        return { ...d, elements: arr };
      });
    },
    [commit],
  );

  const setMeta = useCallback(
    (patch: Partial<Doc>) => {
      commit((d) => {
        const next = { ...d, ...patch };
        if (patch.dpi && patch.dpi !== d.dpi) {
          const f = patch.dpi / d.dpi;
          next.widthDots = patch.widthDots ?? Math.round(d.widthDots * f);
          next.heightDots = patch.heightDots ?? Math.round(d.heightDots * f);
          next.elements = d.elements.map((el) => scaleElement(el, f));
        }
        return next;
      });
    },
    [commit],
  );

  const replaceDoc = useCallback(
    (next: Doc) => {
      commit({ ...normalizeDoc(next), elements: next.elements });
      setSelection([]);
      for (const el of docRef.current.elements) syncImage(el);
    },
    [commit, syncImage],
  );

  const clear = useCallback(() => {
    commit((d) => ({ ...d, elements: [] }));
    setSelection([]);
  }, [commit]);

  const alignSelection = useCallback(
    (mode: "left" | "centerH" | "right" | "top" | "centerV" | "bottom" | "distH" | "distV") => {
      const ids = new Set(selection);
      if (!ids.size) return;
      const els = docRef.current.elements.filter((el) => ids.has(el.id));
      if (!els.length) return;
      const boxes = els.map((el) => ({ el, b: boundsOfSafe(el) }));
      const minX = Math.min(...boxes.map((o) => o.b.x));
      const maxX = Math.max(...boxes.map((o) => o.b.x + o.b.w));
      const minY = Math.min(...boxes.map((o) => o.b.y));
      const maxY = Math.max(...boxes.map((o) => o.b.y + o.b.h));
      const patch: Record<string, Partial<LabelElement>> = {};

      if (mode === "distH" && boxes.length > 2) {
        const sorted = [...boxes].sort((a, b) => a.b.x - b.b.x);
        const total = sorted.reduce((sum, o) => sum + o.b.w, 0);
        const gap = (maxX - minX - total) / (sorted.length - 1);
        let cursor = minX;
        for (const o of sorted) {
          patch[o.el.id] = { x: Math.round(cursor) } as Partial<LabelElement>;
          cursor += o.b.w + gap;
        }
      } else if (mode === "distV" && boxes.length > 2) {
        const sorted = [...boxes].sort((a, b) => a.b.y - b.b.y);
        const total = sorted.reduce((sum, o) => sum + o.b.h, 0);
        const gap = (maxY - minY - total) / (sorted.length - 1);
        let cursor = minY;
        for (const o of sorted) {
          patch[o.el.id] = { y: Math.round(cursor) } as Partial<LabelElement>;
          cursor += o.b.h + gap;
        }
      } else {
        for (const o of boxes) {
          if (mode === "left") patch[o.el.id] = { x: Math.round(minX) } as Partial<LabelElement>;
          if (mode === "right") patch[o.el.id] = { x: Math.round(maxX - o.b.w) } as Partial<LabelElement>;
          if (mode === "centerH") patch[o.el.id] = { x: Math.round((minX + maxX - o.b.w) / 2) } as Partial<LabelElement>;
          if (mode === "top") patch[o.el.id] = { y: Math.round(minY) } as Partial<LabelElement>;
          if (mode === "bottom") patch[o.el.id] = { y: Math.round(maxY - o.b.h) } as Partial<LabelElement>;
          if (mode === "centerV") patch[o.el.id] = { y: Math.round((minY + maxY - o.b.h) / 2) } as Partial<LabelElement>;
        }
      }

      commit((d) => ({
        ...d,
        elements: d.elements.map((el) => (patch[el.id] ? ({ ...el, ...patch[el.id] } as LabelElement) : el)),
      }));
    },
    [selection, commit],
  );

  // Persist the project locally (debounced).
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  useEffect(() => {
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
        setSaveState("saved");
      } catch {
        setSaveState("saved");
      }
    }, 550);
    return () => window.clearTimeout(timer);
  }, [doc]);

  const canUndo = past.current.length > 0;
  const canRedo = future.current.length > 0;
  void histTick;

  return {
    doc,
    docRef,
    selection,
    setSelection,
    selectOne,
    commit,
    live,
    beginGesture,
    endGesture,
    cancelGesture,
    undo,
    redo,
    canUndo,
    canRedo,
    addElement,
    updateElement,
    updateElements,
    removeSelected,
    deleteElement,
    duplicateSelected,
    copySelected,
    paste,
    bringForward,
    setMeta,
    replaceDoc,
    clear,
    alignSelection,
    saveState,
    imageTick,
  };
}

export type Editor = ReturnType<typeof useEditor>;

// Kept local to avoid import cycles with the renderer.
function boundsOfSafe(el: LabelElement): { x: number; y: number; w: number; h: number } {
  switch (el.type) {
    case "text": {
      const lineCount = Math.max(1, el.text.split("\n").length);
      const width = Math.max(el.text.length * el.w, el.w * 3);
      const height = lineCount * el.h;
      if (el.rotation === "R" || el.rotation === "B") return { x: el.x, y: el.y, w: height, h: width };
      return { x: el.x, y: el.y, w: el.block?.width ?? width, h: el.block ? Math.min(el.block.lines, lineCount) * el.h : height };
    }
    case "box":
      return { x: el.x, y: el.y, w: el.width, h: el.height };
    case "line":
      return el.orientation === "h"
        ? { x: el.x, y: el.y, w: el.length, h: el.thickness }
        : { x: el.x, y: el.y, w: el.thickness, h: el.length };
    case "circle":
      return { x: el.x, y: el.y, w: el.diameter, h: el.diameter };
    case "ellipse":
      return { x: el.x, y: el.y, w: el.width, h: el.height };
    case "diagonal":
      return { x: el.x, y: el.y, w: el.width, h: el.height };
    case "image":
      return { x: el.x, y: el.y, w: el.width, h: el.height };
    case "barcode":
      return { x: el.x, y: el.y, w: Math.max(el.data.length * el.moduleWidth * 6, el.moduleWidth * 40), h: el.height + 20 };
    default:
      return { x: 0, y: 0, w: 10, h: 10 };
  }
}