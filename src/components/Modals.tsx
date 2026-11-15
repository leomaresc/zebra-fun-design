import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeDoc, type Editor } from "../store";
import type { Doc, Dpi, LabelPreset } from "../types";
import { LABEL_PRESETS, mmToDots, presetDots } from "../types";
import { buildTemplate, TEMPLATES, type TemplateId } from "../data/templates";
import { boundsOf, drawLabel } from "../render/render";
import { generateZPL } from "../zpl/generate";
import { parseZPL, parsedDocPatch } from "../zpl/parse";
import { barcodeRender, validateBarcode } from "../zpl/barcode";
import { ICONS, renderIcon, type IconDef } from "../data/icons";
import { newImage } from "../factory";
import { getProcessed, prepareImage } from "../render/image";
import { useI18n } from "../i18n";
import { Field, Modal, NumberField, Segmented } from "./ui";
import { Icon } from "./Icon";
import { copyText, downloadBlob, downloadText, slugify } from "../util/file";

/* ------------------------------------------------------------------ */
/* setup                                                               */
/* ------------------------------------------------------------------ */

const fmt = (n: number) => String(+n.toFixed(1));

function MmField({
  value,
  onChange,
  min = 5,
  max = 1000,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const [draft, setDraft] = useState(fmt(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(fmt(value));
  }, [value]);

  const commit = () => {
    const parsed = Number(draft.replace(",", "."));
    if (!Number.isFinite(parsed)) {
      setDraft(fmt(value));
      return;
    }
    const next = Math.min(max, Math.max(min, Math.round(parsed * 10) / 10));
    onChange(next);
    setDraft(fmt(next));
  };

  return (
    <div className="num">
      <input
        className="input"
        inputMode="decimal"
        value={draft}
        aria-label="mm"
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
          commit();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
      <span className="num-suffix">mm</span>
    </div>
  );
}

export function SetupModal({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const doc = editor.doc;
  const [widthMm, setWidth] = useState(doc.widthMm);
  const [heightMm, setHeight] = useState(doc.heightMm);
  const [dpi, setDpi] = useState<Dpi>(doc.dpi);
  const [media, setMedia] = useState<Doc["media"]>(doc.media);
  const [speed, setSpeed] = useState(doc.speed);
  const [darkness, setDarkness] = useState(doc.darkness);
  const [copies, setCopies] = useState(doc.copies);

  const preset = LABEL_PRESETS.find(
    (p) => Math.abs(p.widthMm - widthMm) < 0.05 && Math.abs(p.heightMm - heightMm) < 0.05,
  );

  const dots: [number, number] = preset
    ? presetDots(preset, dpi)
    : [mmToDots(widthMm, dpi), mmToDots(heightMm, dpi)];

  const applyPreset = (p: LabelPreset) => {
    setWidth(p.widthMm);
    setHeight(p.heightMm);
  };

  const outside = useMemo(() => {
    let n = 0;
    for (const el of doc.elements) {
      const b = boundsOf(el);
      if (b.x < 0 || b.y < 0 || b.x + b.w > dots[0] + 1 || b.y + b.h > dots[1] + 1) n++;
    }
    return n;
  }, [doc.elements, dots[0], dots[1]]);

  const previewScale = Math.min(250 / widthMm, 190 / heightMm);

  const apply = () => {
    const [widthDots, heightDots] = preset
      ? presetDots(preset, dpi)
      : [mmToDots(widthMm, dpi), mmToDots(heightMm, dpi)];
    editor.setMeta({
      widthMm,
      heightMm,
      dpi,
      widthDots,
      heightDots,
      media,
      speed,
      darkness,
      copies,
    });
    onClose();
  };

  return (
    <Modal
      title={t("setup.title")}
      subtitle={t("setup.dotSize", { w: dots[0], h: dots[1] })}
      onClose={onClose}
      footer={
        <>
          <button
            className="btn btn-sm"
            type="button"
            onClick={() => {
              const p = LABEL_PRESETS[0];
              setWidth(p.widthMm);
              setHeight(p.heightMm);
              setDpi(203);
              setMedia("gap");
              setSpeed(4);
              setDarkness(10);
              setCopies(1);
            }}
          >
            {t("setup.reset")}
          </button>
          <span className="spacer" />
          <button className="btn" type="button" onClick={onClose}>
            {t("setup.cancel")}
          </button>
          <button className="btn btn-primary" type="button" onClick={apply}>
            <Icon name="check" size={14} />
            {t("setup.apply")}
          </button>
        </>
      }
    >
      <div className="stack">
        <Field label={t("setup.preset")} hint={t("setup.presetHint")}>
          <div className="preset-grid">
            {LABEL_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`preset ${preset?.id === p.id ? "active" : ""}`}
                onClick={() => applyPreset(p)}
              >
                {p.label[lang]}
              </button>
            ))}
          </div>
        </Field>

        <div className="setup-layout">
          <div className="stack" style={{ flex: 1, minWidth: 0 }}>
            <div className="grid-2">
              <Field label={t("setup.width")}>
                <MmField value={widthMm} onChange={setWidth} />
              </Field>
              <Field label={t("setup.height")}>
                <MmField value={heightMm} onChange={setHeight} />
              </Field>
            </div>
            <button
              className="btn btn-sm"
              type="button"
              onClick={() => {
                setWidth(heightMm);
                setHeight(widthMm);
              }}
              style={{ alignSelf: "flex-start" }}
            >
              <Icon name="redo" size={13} />
              {t("setup.rotate")}
            </button>

            <Field label={t("setup.dpi")} hint={t("setup.dpiHelp")}>
              <Segmented
                value={String(dpi)}
                options={[
                  { value: "203", label: "203" },
                  { value: "300", label: "300" },
                  { value: "600", label: "600" },
                ]}
                onChange={(v) => setDpi(Number(v) as Dpi)}
              />
            </Field>
          </div>

          <div className="setup-preview" style={{ flex: "0 0 270px" }}>
            <div
              className="setup-preview-inner"
              style={{ width: widthMm * previewScale, height: heightMm * previewScale }}
            >
              <span className="setup-preview-mm">
                {fmt(widthMm)} × {fmt(heightMm)} mm
              </span>
              <span className="setup-preview-dots">
                {dots[0]} × {dots[1]}
              </span>
            </div>
          </div>
        </div>

        <Field label={t("setup.media")}>
          <Segmented
            value={media}
            options={[
              { value: "gap", label: t("setup.mediaGap") },
              { value: "continuous", label: t("setup.mediaContinuous") },
              { value: "mark", label: t("setup.mediaMark") },
            ]}
            onChange={setMedia}
          />
        </Field>

        <div className="grid-3">
          <Field label={t("setup.speed")} unit="ips">
            <NumberField value={speed} min={1} max={14} onChange={setSpeed} />
          </Field>
          <Field label={t("setup.darkness")} unit="-30…30">
            <NumberField value={darkness} min={-30} max={30} onChange={setDarkness} />
          </Field>
          <Field label={t("setup.copies")}>
            <NumberField value={copies} min={1} max={9999} onChange={setCopies} />
          </Field>
        </div>

        {outside > 0 ? (
          <div className="note warn">{outside === 1 ? t("setup.outsideOne") : t("setup.outside", { n: outside })}</div>
        ) : null}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* export                                                              */
/* ------------------------------------------------------------------ */

export function ExportModal({
  editor,
  onClose,
  onToast,
  onOpenCode,
}: {
  editor: Editor;
  onClose: () => void;
  onToast: (msg: string, error?: boolean) => void;
  onOpenCode: () => void;
}) {
  const { t, lang } = useI18n();
  const doc = editor.doc;
  const [name, setName] = useState(
    `${slugify(doc.name || t("app.untitled"))}-${Math.round(doc.widthMm)}x${Math.round(doc.heightMm)}`,
  );
  const [tick, setTick] = useState(0);
  const openFile = useRef<HTMLInputElement>(null);

  const code = useMemo(() => generateZPL(doc), [doc, editor.imageTick]);
  const stats = useMemo(
    () => ({
      fields: doc.elements.length,
      lines: code.split("\n").length,
      bytes: new TextEncoder().encode(code).length,
    }),
    [code, doc.elements.length],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      for (const el of doc.elements) {
        if (el.type === "image" && !getProcessed(el)) await prepareImage(el);
      }
      if (alive) setTick((n) => n + 1);
    })();
    return () => {
      alive = false;
    };
  }, [doc.elements]);

  const warnings = useMemo(() => {
    void tick;
    const out: string[] = [];
    if (!doc.elements.length) out.push(t("toast.exportEmpty"));

    let badCode = false;
    let unicode = false;
    let pendingImage = false;
    let outside = false;
    let italic = false;

    for (const el of doc.elements) {
      if (el.type === "barcode") {
        if (validateBarcode(el.symbology, el.data, lang) || barcodeRender(el).error) badCode = true;
      }
      if (el.type === "text" && el.font !== "0" && /[^\x00-\x7F]/.test(el.text)) unicode = true;
      if (el.type === "text" && el.italic) italic = true;
      if (el.type === "image" && !getProcessed(el)) pendingImage = true;
      const b = boundsOf(el);
      if (b.x < 0 || b.y < 0 || b.x + b.w > doc.widthDots + 1 || b.y + b.h > doc.heightDots + 1) outside = true;
    }

    if (badCode) out.push(t("export.warnBarcode"));
    if (unicode) out.push(t("export.warnUnicode"));
    if (italic) out.push(t("export.warnItalic"));
    if (pendingImage) out.push(t("export.warnImage"));
    if (outside) out.push(t("export.warnSize"));
    return out;
  }, [doc, lang, t, tick]);

  const base = name.trim().replace(/\.(zpl|json|png)$/i, "") || "etiqueta";

  const copy = async () => {
    const ok = await copyText(code);
    onToast(ok ? t("export.copied") : t("toast.importError"), !ok);
  };

  const downloadZpl = () => {
    downloadText(code, `${base}.zpl`);
    onToast(t("toast.downloaded"));
  };

  const downloadPng = async () => {
    for (const el of doc.elements) {
      if (el.type === "image") await prepareImage(el);
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, doc.widthDots);
    canvas.height = Math.max(1, doc.heightDots);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawLabel(ctx, doc, { zoom: 1, showGrid: false, exporting: true });
    canvas.toBlob((blob) => {
      if (!blob) return;
      downloadBlob(blob, `${base}.png`);
      onToast(t("toast.downloaded"));
    }, "image/png");
  };

  const downloadJson = () => {
    downloadText(JSON.stringify(doc, null, 2), `${base}.json`, "application/json");
    onToast(t("toast.saved"));
  };

  const importJson = async (file: File | undefined | null) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Doc;
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.elements)) throw new Error("bad-project");
      editor.replaceDoc(normalizeDoc(parsed));
      onToast(t("toast.imported"));
      onClose();
    } catch {
      onToast(t("toast.importError"), true);
    }
  };

  return (
    <Modal
      title={t("export.title")}
      subtitle={t("export.stats", stats)}
      onClose={onClose}
      size="wide"
      footer={
        <>
          <span className="tiny muted" style={{ flex: 1, lineHeight: 1.4 }}>
            {t("export.hint")}
          </span>
          <button className="btn" type="button" onClick={onClose}>
            {t("export.close")}
          </button>
          <button className="btn btn-primary" type="button" onClick={() => void copy()}>
            <Icon name="copy" size={14} />
            {t("export.copy")}
          </button>
        </>
      }
    >
      <div className="stack">
        <Field label={t("export.fileName")}>
          <input className="input mono" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <pre className="code-block" aria-label={t("export.zpl")}>
          {code}
        </pre>

        {warnings.length ? (
          <div className="warn-list">
            <div className="section-title" style={{ margin: 0 }}>
              <Icon name="warning" size={13} />
              {t("export.warnings")}
            </div>
            {warnings.map((w) => (
              <div className="note warn" key={w}>
                {w}
              </div>
            ))}
          </div>
        ) : null}

        <div className="export-grid">
          <button className="export-card" type="button" onClick={downloadZpl}>
            <span className="ec-title">
              <Icon name="fileJson" size={15} />
              {t("export.download")}
            </span>
            <span className="ec-body">{t("export.zplHint")}</span>
          </button>
          <button className="export-card" type="button" onClick={() => void downloadPng()}>
            <span className="ec-title">
              <Icon name="fileImage" size={15} />
              {t("export.png")}
            </span>
            <span className="ec-body">{t("export.pngHint")}</span>
          </button>
          <button className="export-card" type="button" onClick={downloadJson}>
            <span className="ec-title">
              <Icon name="folder" size={15} />
              {t("export.json")}
            </span>
            <span className="ec-body">{t("export.jsonHint")}</span>
          </button>
          <button className="export-card" type="button" onClick={() => openFile.current?.click()}>
            <span className="ec-title">
              <Icon name="upload" size={15} />
              {t("export.open")}
            </span>
            <span className="ec-body">{t("export.openHint")}</span>
          </button>
          <button
            className="export-card"
            type="button"
            onClick={onOpenCode}
            style={{ gridColumn: "1 / -1" }}
          >
            <span className="ec-title">
              <Icon name="code" size={15} />
              {t("code.open")}
            </span>
            <span className="ec-body">{t("code.subtitle")}</span>
          </button>
        </div>

        <input
          ref={openFile}
          type="file"
          accept="application/json,.json"
          style={{ display: "none" }}
          onChange={(e) => {
            void importJson(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* templates                                                           */
/* ------------------------------------------------------------------ */

function TemplateThumb({ id, doc }: { id: TemplateId; doc: Doc }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const partial = id === "blank" ? { elements: [] } : buildTemplate(id, doc);
    const thumb: Doc = { ...doc, ...partial, elements: partial.elements ?? [] };
    const zoom = Math.min(200 / thumb.widthDots, 160 / thumb.heightDots);
    const dpr = 3;
    canvas.width = Math.max(1, Math.round(thumb.widthDots * zoom * dpr));
    canvas.height = Math.max(1, Math.round(thumb.heightDots * zoom * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(zoom * dpr, zoom * dpr);
    drawLabel(ctx, thumb, { zoom, showGrid: false, exporting: true });
  }, [id, doc.dpi, doc.widthDots, doc.heightDots]);

  return <canvas ref={ref} />;
}

export function TemplatesModal({
  editor,
  onClose,
  onToast,
}: {
  editor: Editor;
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const { t, lang } = useI18n();
  const doc = editor.doc;

  const applyTemplate = (id: TemplateId) => {
    editor.commit((d) => ({ ...d, ...buildTemplate(id, d) }));
    editor.setSelection([]);
    onToast(t("toast.template"));
    onClose();
  };

  return (
    <Modal
      title={t("templates.title")}
      subtitle={t("templates.subtitle")}
      onClose={onClose}
      size="wide"
      footer={
        <span className="tiny muted" style={{ flex: 1 }}>
          {t("templates.replace")}
        </span>
      }
    >
      <div className="template-grid">
        {TEMPLATES.map((meta) => {
          const preset = LABEL_PRESETS.find((p) => p.id === meta.presetId);
          return (
            <button key={meta.id} className="template-card" type="button" onClick={() => applyTemplate(meta.id)}>
              <span className="template-thumb">
                <TemplateThumb id={meta.id} doc={doc} />
              </span>
              <span>
                <span className="template-name">{t(meta.nameKey)}</span>
                <span className="template-body" style={{ display: "block" }}>
                  {t(meta.bodyKey)}
                </span>
              </span>
              <span className="template-size">
                {preset
                  ? preset.label[lang]
                  : `${Math.round(doc.widthMm)} × ${Math.round(doc.heightMm)} mm`}
              </span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* help                                                                */
/* ------------------------------------------------------------------ */

function Shortcut({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="shortcut-row">
      <span>{label}</span>
      <span className="kbd">{keys}</span>
    </div>
  );
}

export function HelpModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Modal
      title={t("help.title")}
      subtitle={t("app.tagline")}
      onClose={onClose}
      size="wide"
      footer={
        <>
          <span className="tiny muted" style={{ flex: 1 }}>
            {t("help.fidelity")}
          </span>
          <button className="btn btn-primary" type="button" onClick={onClose}>
            {t("help.close")}
          </button>
        </>
      }
    >
      <p className="help-intro">{t("help.body")}</p>
      <div className="help-grid">
        <div>
          <h3 className="help-h">{t("help.shortcuts")}</h3>
          <Shortcut keys="V T R L C E D B I H" label={t("help.kbdTools")} />
          <Shortcut keys="Ctrl Z / Ctrl ⇧ Z" label={t("help.kbdUndo")} />
          <Shortcut keys="Ctrl C / Ctrl V / Ctrl D" label={t("help.kbdCopy")} />
          <Shortcut keys="Ctrl A" label={t("help.kbdSelectAll")} />
          <Shortcut keys="Supr / ⌫" label={t("help.kbdDelete")} />
          <Shortcut keys="← ↑ → ↓ / ⇧" label={t("help.kbdNudge")} />
          <Shortcut keys="Espacio + arrastrar" label={t("help.kbdPan")} />
          <Shortcut keys="Ctrl + rueda" label={t("help.kbdZoom")} />
          <Shortcut keys="Ctrl S / Ctrl E" label={t("help.kbdSave")} />
          <Shortcut keys="Esc" label={t("help.kbdDeselect")} />
        </div>
        <div>
          <h3 className="help-h">{t("help.about")}</h3>
          <p className="help-text">{t("help.aboutBody")}</p>
          <div className="note" style={{ marginTop: 12 }}>
            {t("help.fidelity")}
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <Icon name="printer" size={15} />
            <span className="mono tiny">ZPL II · ^CI28 · UTF-8</span>
          </div>
          <div className="row" style={{ marginTop: 6 }}>
            <Icon name="scan" size={15} />
            <span className="mono tiny">Code 128 · QR · Data Matrix · EAN · UPC</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* confirm                                                             */
/* ------------------------------------------------------------------ */

export function ConfirmModal({
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button className="btn" type="button" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="help-text" style={{ margin: 0 }}>
        {body}
      </p>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* código ZPL: editar o importar                                       */
/* ------------------------------------------------------------------ */

export function CodeModal({
  editor,
  onClose,
  onToast,
}: {
  editor: Editor;
  onClose: () => void;
  onToast: (msg: string, error?: boolean) => void;
}) {
  const { t } = useI18n();
  const current = useMemo(() => generateZPL(editor.doc), [editor.doc]);
  const [code, setCode] = useState(current);
  const file = useRef<HTMLInputElement>(null);

  const apply = () => {
    if (!code.trim()) {
      onToast(t("toast.codeEmpty"), true);
      return;
    }
    const parsed = parseZPL(code);
    if (!parsed.elements.length && !parsed.widthDots) {
      onToast(t("toast.codeEmpty"), true);
      return;
    }
    editor.replaceDoc({ ...editor.doc, ...parsedDocPatch(parsed, editor.doc) });
    onToast(t("toast.codeApplied"));
    onClose();
  };

  const loadFile = async (f: File | undefined | null) => {
    if (!f) return;
    try {
      setCode(await f.text());
    } catch {
      onToast(t("toast.importError"), true);
    }
  };

  return (
    <Modal
      title={t("code.title")}
      subtitle={t("code.subtitle")}
      onClose={onClose}
      size="wide"
      footer={
        <>
          <span className="tiny muted" style={{ flex: 1, lineHeight: 1.4 }}>
            {t("code.hint")}
          </span>
          <button className="btn" type="button" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-primary" type="button" onClick={apply}>
            <Icon name="check" size={14} />
            {t("code.apply")}
          </button>
        </>
      }
    >
      <div className="stack">
        <textarea
          className="textarea mono code-editor"
          value={code}
          rows={16}
          spellCheck={false}
          placeholder={t("code.empty")}
          onChange={(e) => setCode(e.target.value)}
        />
        <div className="row">
          <button className="btn btn-sm" type="button" onClick={() => file.current?.click()}>
            <Icon name="upload" size={13} />
            {t("code.load")}
          </button>
          <button className="btn btn-sm" type="button" onClick={() => setCode(current)}>
            <Icon name="undo" size={13} />
            {t("setup.reset")}
          </button>
          <span className="spacer" />
          <span className="tiny muted mono">{code.split("\n").length} ln</span>
        </div>
        <input
          ref={file}
          type="file"
          accept=".zpl,.txt,text/plain"
          style={{ display: "none" }}
          onChange={(e) => {
            void loadFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* iconos                                                              */
/* ------------------------------------------------------------------ */

function IconPreview({ def }: { def: IconDef }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = 3;
    const size = 42;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);
    def.draw(ctx, size);
    ctx.restore();
  }, [def]);
  return <canvas ref={ref} style={{ width: 42, height: 42 }} />;
}

export function IconsModal({
  editor,
  onClose,
  onToast,
}: {
  editor: Editor;
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const { t } = useI18n();
  const doc = editor.doc;

  const insert = (def: IconDef) => {
    const src = renderIcon(def, 512);
    if (!src) return;
    const dots = Math.max(40, Math.round(Math.min(doc.widthDots, doc.heightDots) * 0.2));
    const x = Math.round((doc.widthDots - dots) / 2);
    const y = Math.round((doc.heightDots - dots) / 2);
    editor.addElement(newImage(x, y, src, dots, dots));
    onToast(t("toast.icon"));
    onClose();
  };

  return (
    <Modal
      title={t("icons.title")}
      subtitle={t("icons.subtitle")}
      onClose={onClose}
      size="wide"
      footer={
        <>
          <span className="spacer" />
          <button className="btn" type="button" onClick={onClose}>
            {t("common.close")}
          </button>
        </>
      }
    >
      <div className="icon-grid">
        {ICONS.map((def) => (
          <button key={def.id} type="button" className="icon-card" onClick={() => insert(def)}>
            <IconPreview def={def} />
            <span>{t(`icon.${def.id}` as never)}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}