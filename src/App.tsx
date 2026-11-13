import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { I18nContext, translate, type Lang, type TKey } from "./i18n";
import { loadStoredDoc, normalizeDoc, useEditor } from "./store";
import { emptyDoc } from "./factory";
import type { Doc, Tool } from "./types";
import { TopBar } from "./components/TopBar";
import { Toolrail } from "./components/Toolrail";
import { CanvasStage } from "./components/CanvasStage";
import { Inspector } from "./components/Inspector";
import { CodePanel } from "./components/CodePanel";
import { ConfirmModal, ExportModal, HelpModal, SetupModal, TemplatesModal } from "./components/Modals";
import { Icon } from "./components/Icon";

type ModalKind = "setup" | "export" | "templates" | "help" | "clear" | null;

const TOOL_KEYS: Record<string, Tool> = {
  v: "select",
  t: "text",
  r: "box",
  l: "line",
  c: "circle",
  e: "ellipse",
  d: "diagonal",
  b: "barcode",
  i: "image",
  h: "hand",
};

function firstDoc(): Doc {
  const stored = loadStoredDoc();
  if (stored) return stored;
  return normalizeDoc(emptyDoc(203));
}

interface Toast {
  id: number;
  msg: string;
  error?: boolean;
}

export default function App() {
  const [initial] = useState<Doc>(() => firstDoc());
  const editor = useEditor(initial);
  const [tool, setTool] = useState<Tool>("select");
  const [modal, setModal] = useState<ModalKind>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const stored = localStorage.getItem("zfd.lang");
      if (stored === "es" || stored === "en") return stored;
    } catch {
      /* ignore */
    }
    return navigator.language?.toLowerCase().startsWith("en") ? "en" : "es";
  });

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem("zfd.lang", next);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: TKey, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang],
  );

  const i18n = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const toast = useCallback((msg: string, error = false) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list.slice(-2), { id, msg, error }]);
    window.setTimeout(() => {
      setToasts((list) => list.filter((item) => item.id !== id));
    }, 3000);
  }, []);

  const close = useCallback(() => setModal(null), []);

  // Keep the label name in sync without flooding the undo history.
  const onName = useCallback(
    (name: string) => {
      editor.live((doc) => ({ ...doc, name }));
    },
    [editor],
  );

  // Keyboard nudge is coalesced into one history step.
  const nudgeTimer = useRef<number | undefined>(undefined);
  const nudgeActive = useRef(false);
  const nudge = useCallback(
    (dx: number, dy: number) => {
      if (!editor.selection.length) return;
      if (!nudgeActive.current) {
        editor.beginGesture();
        nudgeActive.current = true;
      }
      editor.updateElements(
        editor.selection,
        (el) => ({ x: Math.round(el.x + dx), y: Math.round(el.y + dy) }),
        false,
      );
      window.clearTimeout(nudgeTimer.current);
      nudgeTimer.current = window.setTimeout(() => {
        editor.endGesture();
        nudgeActive.current = false;
      }, 450);
    },
    [editor],
  );

  useEffect(() => {
    return () => {
      window.clearTimeout(nudgeTimer.current);
      if (nudgeActive.current) editor.endGesture();
    };
  }, [editor]);

  // Global shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (inField) {
        // Escape leaves the field first, so the canvas regains the shortcuts.
        if (e.key === "Escape") (target as HTMLElement).blur();
        return;
      }
      if (modal) return;

      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) editor.redo();
        else editor.undo();
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        editor.redo();
        return;
      }
      if (mod && (key === "s" || key === "e")) {
        e.preventDefault();
        setModal("export");
        return;
      }
      if (mod && key === "d") {
        e.preventDefault();
        if (!editor.selection.length) toast(t("toast.selectOne"));
        else editor.duplicateSelected();
        return;
      }
      if (mod && key === "c") {
        e.preventDefault();
        if (!editor.selection.length) toast(t("toast.selectOne"));
        else editor.copySelected();
        return;
      }
      if (mod && key === "v") {
        e.preventDefault();
        if (editor.paste()) toast(t("toast.pasted"));
        else toast(t("toast.nothing"));
        return;
      }
      if (mod && key === "a") {
        e.preventDefault();
        editor.setSelection(editor.doc.elements.map((el) => el.id));
        return;
      }
      if (mod || e.altKey) return;

      if (key === "delete" || key === "backspace") {
        if (!editor.selection.length) return;
        e.preventDefault();
        editor.removeSelected();
        return;
      }
      if (key === "escape") {
        editor.setSelection([]);
        setTool("select");
        return;
      }
      if (key === "f1" || e.key === "?") {
        e.preventDefault();
        setModal("help");
        return;
      }
      if (key === "arrowleft" || key === "arrowright" || key === "arrowup" || key === "arrowdown") {
        if (!editor.selection.length) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        if (key === "arrowleft") nudge(-step, 0);
        if (key === "arrowright") nudge(step, 0);
        if (key === "arrowup") nudge(0, -step);
        if (key === "arrowdown") nudge(0, step);
        return;
      }
      const nextTool = TOOL_KEYS[key];
      if (nextTool) {
        e.preventDefault();
        setTool(nextTool);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor, modal, nudge, t, toast]);

  const onImageAdded = useCallback(() => toast(t("toast.imageReady")), [toast, t]);

  return (
    <I18nContext.Provider value={i18n}>
      <div className="app">
        <TopBar
          doc={editor.doc}
          name={editor.doc.name}
          onName={onName}
          canUndo={editor.canUndo}
          canRedo={editor.canRedo}
          undo={editor.undo}
          redo={editor.redo}
          onSetup={() => setModal("setup")}
          onExport={() => setModal("export")}
          onTemplates={() => setModal("templates")}
          onHelp={() => setModal("help")}
          saveState={editor.saveState}
          onToggleInspector={() => setInspectorOpen((v) => !v)}
          inspectorOpen={inspectorOpen}
        />

        <div className="workspace">
          <Toolrail tool={tool} setTool={setTool} />
          <CanvasStage
            editor={editor}
            tool={tool}
            setTool={setTool}
            onOpenTemplates={() => setModal("templates")}
            onToast={toast}
            onImageAdded={onImageAdded}
          />
          <Inspector
            editor={editor}
            open={inspectorOpen}
            onClose={() => setInspectorOpen(false)}
            onOpenSetup={() => setModal("setup")}
            onClear={() => setModal("clear")}
          />
        </div>

        <CodePanel editor={editor} onToast={toast} />

        {modal === "setup" ? <SetupModal editor={editor} onClose={close} /> : null}
        {modal === "export" ? <ExportModal editor={editor} onClose={close} onToast={toast} /> : null}
        {modal === "templates" ? (
          <TemplatesModal editor={editor} onClose={close} onToast={toast} />
        ) : null}
        {modal === "help" ? <HelpModal onClose={close} /> : null}
        {modal === "clear" ? (
          <ConfirmModal
            title={t("confirm.clear")}
            body={t("confirm.clearBody")}
            confirmLabel={t("confirm.clearYes")}
            onConfirm={() => editor.clear()}
            onClose={close}
          />
        ) : null}

        <div className="toast-wrap" aria-live="polite">
          {toasts.map((item) => (
            <div key={item.id} className={`toast ${item.error ? "error" : ""}`}>
              <Icon name={item.error ? "warning" : "check"} size={14} />
              {item.msg}
            </div>
          ))}
        </div>
      </div>
    </I18nContext.Provider>
  );
}