import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Editor } from "../store";
import type {
  BarcodeElement,
  Doc,
  ElementType,
  ImageElement,
  LabelElement,
  Rotation,
  Symbology,
  TextElement,
} from "../types";
import { DEFAULT_BARCODE, SYMBOLOGY_INFO, dotsToMm } from "../types";
import { ZPL_FONTS } from "../zpl/fonts";
import { barcodeBox, barcodeRender, validateBarcode } from "../zpl/barcode";
import { getProcessed, prepareImage } from "../render/image";
import { readImageFile } from "../render/upload";
import { useI18n } from "../i18n";
import { Icon, type IconName } from "./Icon";
import { ColorPick, Field, IconButton, NumberField, Segmented, Toggle } from "./ui";

const TYPE_ICON: Record<ElementType, IconName> = {
  text: "text",
  box: "square",
  line: "line",
  circle: "circle",
  ellipse: "ellipse",
  diagonal: "diagonal",
  barcode: "barcode",
  image: "image",
};

const ROTATIONS: { value: Rotation; label: string }[] = [
  { value: "N", label: "0°" },
  { value: "R", label: "90°" },
  { value: "I", label: "180°" },
  { value: "B", label: "270°" },
];

const RATIOS = [2, 2.2, 2.5, 3];

function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <section className="section">
      <h3 className="section-title">
        {title}
        {badge ? <span className="badge">{badge}</span> : null}
      </h3>
      <div className="stack">{children}</div>
    </section>
  );
}

export function Inspector({
  editor,
  open,
  onClose,
  onOpenSetup,
  onClear,
}: {
  editor: Editor;
  open: boolean;
  onClose: () => void;
  onOpenSetup: () => void;
  onClear: () => void;
}) {
  const { t } = useI18n();
  const doc = editor.doc;
  const selected = doc.elements.filter((el) => editor.selection.includes(el.id));
  const single = selected.length === 1 ? selected[0] : null;

  return (
    <aside className={`inspector ${open ? "open" : ""}`} aria-label={t("inspector.title")}>
      <div className="inspector-head">
        <span className="inspector-title">{t("inspector.title")}</span>
        {single ? (
          <span className="inspector-type">
            {single.type === "barcode"
              ? SYMBOLOGY_INFO[single.symbology].label
              : t(`tool.${single.type}` as never)}
          </span>
        ) : null}
        <div className="inspector-head-actions">
          {single ? (
            <>
              <IconButton
                icon={single.locked ? "lock" : "unlock"}
                label={single.locked ? t("inspector.unlock") : t("inspector.lock")}
                active={!!single.locked}
                onClick={() => editor.updateElement(single.id, { locked: !single.locked })}
                small
              />
              <IconButton
                icon="copy"
                label={t("actions.duplicate")}
                onClick={() => editor.duplicateSelected()}
                small
              />
              <IconButton
                icon="trash"
                label={t("actions.delete")}
                danger
                onClick={() => editor.removeSelected()}
                small
              />
            </>
          ) : null}
          <IconButton icon="x" label={t("common.close")} onClick={onClose} className="drawer-toggle" />
        </div>
      </div>

      <div className="inspector-body">
        {single ? (
          <ElementEditor editor={editor} el={single} doc={doc} />
        ) : selected.length > 1 ? (
          <MultiEditor editor={editor} count={selected.length} />
        ) : (
          <EmptyInspector editor={editor} onOpenSetup={onOpenSetup} />
        )}
      </div>

      <Layers editor={editor} onClear={onClear} />
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Empty / multi                                                       */
/* ------------------------------------------------------------------ */

function EmptyInspector({ editor, onOpenSetup }: { editor: Editor; onOpenSetup: () => void }) {
  const { t } = useI18n();
  const doc = editor.doc;
  return (
    <div className="inspector-empty">
      <div className="empty-icon">
        <Icon name="scan" size={36} />
      </div>
      <h3>{t("inspector.empty")}</h3>
      <p>{t("inspector.emptyBody")}</p>
      <div className="row" style={{ justifyContent: "center", marginTop: 14 }}>
        <button className="btn btn-sm" type="button" onClick={onOpenSetup}>
          <Icon name="settings" size={13} />
          {t("setup.title")}
        </button>
      </div>
      <div className="note" style={{ marginTop: 18, textAlign: "left" }}>
        <div className="row-between" style={{ marginBottom: 4 }}>
          <strong>
            {Math.round(doc.widthMm)} × {Math.round(doc.heightMm)} mm
          </strong>
          <span className="mono tiny">{doc.dpi} dpi</span>
        </div>
        <div className="mono tiny muted">
          {doc.widthDots} × {doc.heightDots} dots
        </div>
        <div className="tiny muted" style={{ marginTop: 4 }}>
          {t("layers.count", { n: doc.elements.length })}
        </div>
      </div>
      <p className="tiny muted" style={{ marginTop: 16, lineHeight: 1.5 }}>
        {t("inspector.tip")}
      </p>
    </div>
  );
}

const ALIGN_ACTIONS: { mode: Parameters<Editor["alignSelection"]>[0]; icon: IconName; label: string }[] = [
  { mode: "left", icon: "alignLeft", label: "actions.alignLeft" },
  { mode: "centerH", icon: "alignCenterH", label: "actions.alignCenterH" },
  { mode: "right", icon: "alignRight", label: "actions.alignRight" },
  { mode: "top", icon: "alignTop", label: "actions.alignTop" },
  { mode: "centerV", icon: "alignCenterV", label: "actions.alignMiddleV" },
  { mode: "bottom", icon: "alignBottom", label: "actions.alignBottom" },
  { mode: "distH", icon: "distributeH", label: "actions.distributeH" },
  { mode: "distV", icon: "distributeV", label: "actions.distributeV" },
];

function MultiEditor({ editor, count }: { editor: Editor; count: number }) {
  const { t } = useI18n();
  return (
    <>
      <Section title={t("inspector.multi", { n: count })}>
        <p className="tiny muted" style={{ margin: 0 }}>
          {t("inspector.multiBody")}
        </p>
        <div className="align-grid">
          {ALIGN_ACTIONS.map((a) => (
            <button
              key={a.mode}
              type="button"
              className="align-btn"
              title={t(a.label as never)}
              aria-label={t(a.label as never)}
              onClick={() => editor.alignSelection(a.mode)}
            >
              <Icon name={a.icon} size={15} />
            </button>
          ))}
        </div>
      </Section>
      <Section title={t("actions.copy")}>
        <div className="grid-2">
          <button className="btn btn-sm" type="button" onClick={() => editor.duplicateSelected()}>
            <Icon name="copy" size={13} />
            {t("actions.duplicate")}
          </button>
          <button className="btn btn-sm btn-danger" type="button" onClick={() => editor.removeSelected()}>
            <Icon name="trash" size={13} />
            {t("actions.delete")}
          </button>
        </div>
      </Section>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Single element                                                      */
/* ------------------------------------------------------------------ */

function ElementEditor({ editor, el, doc }: { editor: Editor; el: LabelElement; doc: Doc }) {
  const { t } = useI18n();
  const update = (patch: Partial<LabelElement>, record = true) => editor.updateElement(el.id, patch, record);

  return (
    <>
      <PositionSection editor={editor} el={el} doc={doc}>
        {el.type === "text" ? (
          <Field label={t("inspector.source")}>
            <Segmented
              value={el.origin}
              options={[
                { value: "FO", label: "^FO" },
                { value: "FT", label: "^FT" },
              ]}
              onChange={(origin) => update({ origin })}
            />
          </Field>
        ) : null}
      </PositionSection>

      {el.type === "text" ? <TextEditor editor={editor} el={el} doc={doc} /> : null}
      {el.type === "box" ? <BoxEditor editor={editor} el={el} /> : null}
      {el.type === "line" ? <LineEditor editor={editor} el={el} /> : null}
      {el.type === "circle" ? <CircleEditor editor={editor} el={el} /> : null}
      {el.type === "ellipse" ? <EllipseEditor editor={editor} el={el} /> : null}
      {el.type === "diagonal" ? <DiagonalEditor editor={editor} el={el} /> : null}
      {el.type === "barcode" ? <BarcodeEditor editor={editor} el={el} /> : null}
      {el.type === "image" ? <ImageEditor editor={editor} el={el} doc={doc} /> : null}

      <Section title={t("inspector.name")}>
        <Field label={t("common.name")}>
          <input
            className="input"
            value={el.name ?? ""}
            placeholder={t(`tool.${el.type}` as never)}
            onChange={(e) => update({ name: e.target.value }, false)}
            onFocus={() => editor.beginGesture()}
            onBlur={() => editor.endGesture()}
          />
        </Field>
        <div className="row-between">
          <Toggle checked={!!el.locked} onChange={(locked) => update({ locked })} label={t("inspector.locked")} />
        </div>
      </Section>
    </>
  );
}

function PositionSection({
  editor,
  el,
  doc,
  children,
}: {
  editor: Editor;
  el: LabelElement;
  doc: Doc;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <Section title={t("inspector.position")} badge={`${el.x}, ${el.y}`}>
      <div className="grid-2">
        <Field label={t("inspector.x")} unit="dot">
          <NumberField value={el.x} onChange={(x) => editor.updateElement(el.id, { x })} min={-9999} />
        </Field>
        <Field label={t("inspector.y")} unit="dot">
          <NumberField value={el.y} onChange={(y) => editor.updateElement(el.id, { y })} min={-9999} />
        </Field>
      </div>
      <div className="tiny muted mono" style={{ marginTop: -4 }}>
        {dotsToMm(el.x, doc.dpi)} · {dotsToMm(el.y, doc.dpi)} mm
      </div>
      {el.type === "text" || el.type === "barcode" ? (
        <Field label={t("inspector.rotation")}>
          <Segmented
            value={el.rotation}
            options={ROTATIONS}
            onChange={(rotation) => editor.updateElement(el.id, { rotation })}
          />
        </Field>
      ) : null}
      {children}
    </Section>
  );
}

function SizeField({
  label,
  value,
  onChange,
  min = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <Field label={label} unit="dot">
      <NumberField value={Math.round(value)} onChange={onChange} min={min} max={32000} />
    </Field>
  );
}

/* ------------------------------ text ------------------------------ */

function TextEditor({ editor, el, doc }: { editor: Editor; el: TextElement; doc: Doc }) {
  const { t, lang } = useI18n();
  const hasUnicode = /[^\x00-\x7F]/.test(el.text);

  return (
    <>
      <Section title={t("inspector.content")}>
        <Field label={t("inspector.text")}>
          <textarea
            className="textarea"
            value={el.text}
            spellCheck={false}
            rows={3}
            onFocus={() => editor.beginGesture()}
            onChange={(e) => editor.updateElement(el.id, { text: e.target.value }, false)}
            onBlur={() => editor.endGesture()}
          />
        </Field>
        {hasUnicode && el.font !== "0" ? (
          <div className="note warn">{t("inspector.unicodeWarn")}</div>
        ) : null}
        <Toggle
          checked={el.reverse}
          onChange={(reverse) => editor.updateElement(el.id, { reverse })}
          label={t("inspector.reverse")}
        />
      </Section>

      <Section title={t("inspector.font")} badge={el.font}>
        <div className="font-picker" role="listbox" aria-label={t("inspector.font")}>
          {ZPL_FONTS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="option"
              aria-selected={el.font === f.key}
              className={`font-option ${el.font === f.key ? "active" : ""}`}
              onClick={() => editor.updateElement(el.id, { font: f.key })}
            >
              <span className="font-glyph">{f.key}</span>
              <span className="font-meta">
                <span className="font-name">
                  {f.key === "0" ? `0 · ${lang === "es" ? "escalable" : "scalable"}` : `${f.key} · ${f.baseW}×${f.baseH}`}
                </span>
                <span className="font-note">{f.note ? f.note[lang] : ""}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="grid-2">
          <SizeField
            label={t("inspector.height")}
            value={el.h}
            min={2}
            onChange={(h) => editor.updateElement(el.id, { h })}
          />
          <SizeField
            label={t("inspector.width")}
            value={el.w}
            min={1}
            onChange={(w) => editor.updateElement(el.id, { w })}
          />
        </div>
        <span className="tiny muted">{t("inspector.fontHint")}</span>
      </Section>

      <Section title={t("inspector.style")}>
        <Toggle
          checked={!!el.bold}
          label={t("inspector.bold")}
          onChange={(bold) => editor.updateElement(el.id, { bold })}
        />
        <Toggle
          checked={!!el.italic}
          label={t("inspector.italic")}
          onChange={(italic) => editor.updateElement(el.id, { italic })}
        />
        <Toggle
          checked={!!el.underline}
          label={t("inspector.underline")}
          onChange={(underline) => editor.updateElement(el.id, { underline })}
        />
        {el.italic ? <div className="note">{t("inspector.italicNote")}</div> : null}
      </Section>

      <Section title={t("inspector.block")}>
        <Toggle
          checked={!!el.block}
          label={t("inspector.blockOn")}
          onChange={(on) =>
            editor.updateElement(el.id, {
              block: on
                ? {
                    width: Math.max(80, Math.min(doc.widthDots - el.x, Math.round(doc.widthDots * 0.55))),
                    lines: Math.max(3, el.text.split("\n").length),
                    spacing: 0,
                    align: "L",
                    indent: 0,
                  }
                : null,
            })
          }
        />
        {el.block ? (
          <>
            <div className="grid-2">
              <SizeField
                label={t("inspector.blockWidth")}
                value={el.block.width}
                min={8}
                onChange={(width) => editor.updateElement(el.id, { block: { ...el.block!, width } })}
              />
              <Field label={t("inspector.blockLines")} unit="ln">
                <NumberField
                  value={el.block.lines}
                  min={1}
                  max={9999}
                  onChange={(lines) => editor.updateElement(el.id, { block: { ...el.block!, lines } })}
                />
              </Field>
            </div>
            <div className="grid-2">
              <Field label={t("inspector.spacing")} unit="dot">
                <NumberField
                  value={el.block.spacing}
                  min={-9999}
                  onChange={(spacing) => editor.updateElement(el.id, { block: { ...el.block!, spacing } })}
                />
              </Field>
              <Field label={t("inspector.indent")} unit="dot">
                <NumberField
                  value={el.block.indent}
                  min={0}
                  onChange={(indent) => editor.updateElement(el.id, { block: { ...el.block!, indent } })}
                />
              </Field>
            </div>
            <Field label={t("inspector.align")}>
              <Segmented
                value={el.block.align}
                options={[
                  { value: "L", label: t("inspector.alignL") },
                  { value: "C", label: t("inspector.alignC") },
                  { value: "R", label: t("inspector.alignR") },
                  { value: "J", label: t("inspector.alignJ") },
                ]}
                onChange={(v) => editor.updateElement(el.id, { block: { ...el.block!, align: v as "L" | "C" | "R" | "J" } })}
              />
            </Field>
          </>
        ) : null}
      </Section>
    </>
  );
}

/* ------------------------------ shapes ------------------------------ */

function StrokeSection({
  editor,
  el,
  children,
}: {
  editor: Editor;
  el: LabelElement;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <Section title={t("inspector.stroke")}>
      <div className="grid-2">
        <Field label={t("inspector.thickness")} unit="dot">
          <NumberField
            value={"thickness" in el ? el.thickness : 1}
            min={1}
            max={4095}
            onChange={(thickness) => editor.updateElement(el.id, { thickness } as Partial<LabelElement>)}
          />
        </Field>
        <Field label={t("inspector.color")}>
          <ColorPick
            value={"color" in el ? el.color : "B"}
            onChange={(color) => editor.updateElement(el.id, { color } as Partial<LabelElement>)}
          />
        </Field>
      </div>
      {children}
    </Section>
  );
}

function BoxEditor({ editor, el }: { editor: Editor; el: Extract<LabelElement, { type: "box" }> }) {
  const { t } = useI18n();
  return (
    <>
      <Section title={t("inspector.size")} badge={`${el.width} × ${el.height}`}>
        <div className="grid-2">
          <SizeField label={t("inspector.width")} value={el.width} min={1} onChange={(width) => editor.updateElement(el.id, { width, rounding: Math.min(el.rounding, 8) })} />
          <SizeField label={t("inspector.height")} value={el.height} min={1} onChange={(height) => editor.updateElement(el.id, { height })} />
        </div>
      </Section>
      <StrokeSection editor={editor} el={el}>
        <Field label={t("inspector.rounding")} hint={t("inspector.round")}>
          <Segmented
            value={String(el.rounding)}
            options={[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ value: String(n), label: String(n) }))}
            onChange={(v) => editor.updateElement(el.id, { rounding: Number(v) })}
          />
        </Field>
      </StrokeSection>
    </>
  );
}

function LineEditor({ editor, el }: { editor: Editor; el: Extract<LabelElement, { type: "line" }> }) {
  const { t } = useI18n();
  return (
    <>
      <Section title={t("inspector.orientation")}>
        <Field label={t("inspector.direction")}>
          <Segmented
            value={el.orientation}
            options={[
              { value: "h", label: t("inspector.horizontal") },
              { value: "v", label: t("inspector.vertical") },
            ]}
            onChange={(orientation) => editor.updateElement(el.id, { orientation })}
          />
        </Field>
        <SizeField label={t("inspector.length")} value={el.length} min={2} onChange={(length) => editor.updateElement(el.id, { length })} />
      </Section>
      <StrokeSection editor={editor} el={el} />
    </>
  );
}

function CircleEditor({ editor, el }: { editor: Editor; el: Extract<LabelElement, { type: "circle" }> }) {
  const { t } = useI18n();
  return (
    <>
      <Section title={t("inspector.size")}>
        <SizeField label={t("inspector.diameter")} value={el.diameter} min={3} onChange={(diameter) => editor.updateElement(el.id, { diameter })} />
      </Section>
      <StrokeSection editor={editor} el={el} />
    </>
  );
}

function EllipseEditor({ editor, el }: { editor: Editor; el: Extract<LabelElement, { type: "ellipse" }> }) {
  const { t } = useI18n();
  return (
    <>
      <Section title={t("inspector.size")} badge={`${el.width} × ${el.height}`}>
        <div className="grid-2">
          <SizeField label={t("inspector.width")} value={el.width} min={3} onChange={(width) => editor.updateElement(el.id, { width })} />
          <SizeField label={t("inspector.height")} value={el.height} min={3} onChange={(height) => editor.updateElement(el.id, { height })} />
        </div>
      </Section>
      <StrokeSection editor={editor} el={el} />
    </>
  );
}

function DiagonalEditor({ editor, el }: { editor: Editor; el: Extract<LabelElement, { type: "diagonal" }> }) {
  const { t } = useI18n();
  return (
    <>
      <Section title={t("inspector.size")} badge={`${el.width} × ${el.height}`}>
        <div className="grid-2">
          <SizeField label={t("inspector.width")} value={el.width} min={3} onChange={(width) => editor.updateElement(el.id, { width })} />
          <SizeField label={t("inspector.height")} value={el.height} min={3} onChange={(height) => editor.updateElement(el.id, { height })} />
        </div>
        <Field label={t("inspector.slash")}>
          <Segmented
            value={el.slash ? "up" : "down"}
            options={[
              { value: "up", label: t("inspector.slashUp") },
              { value: "down", label: t("inspector.slashDown") },
            ]}
            onChange={(v) => editor.updateElement(el.id, { slash: v === "up" })}
          />
        </Field>
      </Section>
      <StrokeSection editor={editor} el={el} />
    </>
  );
}

/* ------------------------------ barcode ------------------------------ */

function BarcodeEditor({ editor, el }: { editor: Editor; el: BarcodeElement }) {
  const { t, lang } = useI18n();
  const info = SYMBOLOGY_INFO[el.symbology];
  const is2d = info.group === "2d";
  const validation = validateBarcode(el.symbology, el.data, lang);
  const render = barcodeRender(el);
  const box = barcodeBox(el);
  const ids = Object.keys(SYMBOLOGY_INFO) as Symbology[];

  const changeSymbology = (sym: Symbology) => {
    const next = SYMBOLOGY_INFO[sym];
    const prev = SYMBOLOGY_INFO[el.symbology];
    const defaults = DEFAULT_BARCODE[sym];
    const patch: Partial<BarcodeElement> = { symbology: sym, ...defaults };
    if (!el.data.trim() || el.data === prev.placeholder) patch.data = next.placeholder;
    editor.updateElement(el.id, patch as Partial<LabelElement>);
  };

  return (
    <>
      <Section title={t("inspector.barcode")} badge={box.width + " × " + box.height}>
        <Field label={t("inspector.symbology")}>
          <select className="select" value={el.symbology} onChange={(e) => changeSymbology(e.target.value as Symbology)}>
            <optgroup label="1D">
              {ids
                .filter((id) => SYMBOLOGY_INFO[id].group === "1d")
                .map((id) => (
                  <option key={id} value={id}>
                    {SYMBOLOGY_INFO[id].label}
                  </option>
                ))}
            </optgroup>
            <optgroup label="2D">
              {ids
                .filter((id) => SYMBOLOGY_INFO[id].group === "2d")
                .map((id) => (
                  <option key={id} value={id}>
                    {SYMBOLOGY_INFO[id].label}
                  </option>
                ))}
            </optgroup>
          </select>
        </Field>
        <Field label={t("inspector.data")} hint={is2d ? undefined : SYMBOLOGY_INFO[el.symbology].placeholder}>
          <textarea
            className="textarea mono"
            value={el.data}
            rows={2}
            spellCheck={false}
            onFocus={() => editor.beginGesture()}
            onChange={(e) => editor.updateElement(el.id, { data: e.target.value }, false)}
            onBlur={() => editor.endGesture()}
          />
        </Field>
        {validation ? <div className="note error">{validation}</div> : null}
        {!validation && render.error ? <div className="note error">{render.error}</div> : null}
        {el.symbology === "upce" ? <div className="note warn">{t("inspector.upceNote")}</div> : null}
      </Section>

      <Section title={t("inspector.size")}>
        <div className="grid-2">
          <Field label={t("inspector.module")} unit="dot">
            <NumberField
              value={el.moduleWidth}
              min={1}
              max={is2d ? 20 : 10}
              onChange={(moduleWidth) => editor.updateElement(el.id, { moduleWidth })}
            />
          </Field>
          {is2d ? null : (
            <Field label={t("inspector.barHeight")} unit="dot">
              <NumberField value={el.height} min={1} max={32000} onChange={(height) => editor.updateElement(el.id, { height })} />
            </Field>
          )}
        </div>

        {is2d ? null : (
          <>
            <Field label={t("inspector.ratio")} hint={t("inspector.ratioHint")}>
              <select
                className="select"
                value={el.ratio}
                onChange={(e) => editor.updateElement(el.id, { ratio: Number(e.target.value) })}
              >
                {RATIOS.map((r) => (
                  <option key={r} value={r}>
                    {r.toFixed(1)}
                  </option>
                ))}
              </select>
            </Field>
            <Toggle
              checked={el.showText}
              onChange={(showText) => editor.updateElement(el.id, { showText })}
              label={t("inspector.showText")}
            />
            {el.showText ? (
              <Toggle
                checked={el.textAbove}
                onChange={(textAbove) => editor.updateElement(el.id, { textAbove })}
                label={t("inspector.textAbove")}
              />
            ) : null}
            {["code128", "code39", "code93", "upce", "itf", "msi"].includes(el.symbology) ? (
              <Toggle
                checked={el.checkDigit}
                onChange={(checkDigit) => editor.updateElement(el.id, { checkDigit })}
                label={t("inspector.checkDigit")}
              />
            ) : null}
          </>
        )}

        {el.symbology === "qrcode" ? (
          <>
            <Field label={t("inspector.ecc")}>
              <Segmented
                value={el.ecc}
                options={[
                  { value: "L", label: "L" },
                  { value: "M", label: "M" },
                  { value: "Q", label: "Q" },
                  { value: "H", label: "H" },
                ]}
                onChange={(ecc) => editor.updateElement(el.id, { ecc })}
              />
            </Field>
            <Field label={t("inspector.mask")}>
              <Segmented
                value={String(el.mask)}
                options={[0, 1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: String(n), label: String(n) }))}
                onChange={(v) => editor.updateElement(el.id, { mask: Number(v) })}
              />
            </Field>
            <div className="note">{t("inspector.qrNote")}</div>
          </>
        ) : null}

        {el.symbology === "datamatrix" ? <div className="note">{t("inspector.dmNote")}</div> : null}

        <div className="tiny muted mono">
          {t("inspector.dotPreview", { w: box.width, h: box.height })}
        </div>
      </Section>
    </>
  );
}

/* ------------------------------ image ------------------------------ */

function ImageThumb({ el }: { el: ImageElement }) {
  const { t } = useI18n();
  const ref = useRef<HTMLCanvasElement>(null);
  const [tick, setTick] = useState(0);
  const [missing, setMissing] = useState(false);
  const key = `${el.src.length}:${el.src.slice(-32)}|${el.width}x${el.height}|${el.threshold}|${el.dither ? 1 : 0}|${el.invert ? 1 : 0}`;

  useEffect(() => {
    let alive = true;
    setMissing(false);
    prepareImage(el).then((p) => {
      if (alive) {
        if (p) setTick((n) => n + 1);
        else setMissing(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [key]);

  useEffect(() => {
    const canvas = ref.current;
    const processed = getProcessed(el);
    if (!canvas || !processed) return;
    const zoom = Math.min(268 / processed.width, 88 / processed.height);
    canvas.width = Math.max(1, Math.round(processed.width * zoom));
    canvas.height = Math.max(1, Math.round(processed.height * zoom));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(processed.canvas, 0, 0, canvas.width, canvas.height);
  }, [tick, key]);

  if (missing) return <div className="note error">{t("inspector.unprocessed")}</div>;
  return <canvas ref={ref} className="image-preview" style={{ width: "auto", height: "auto" }} />;
}

function ImageEditor({ editor, el, doc }: { editor: Editor; el: ImageElement; doc: Doc }) {
  const { t } = useI18n();
  const file = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [lock, setLock] = useState(true);

  const load = async (f: File | undefined | null) => {
    if (!f || !f.type.startsWith("image/")) return;
    try {
      const img = await readImageFile(f);
      const width = Math.max(8, el.width);
      const height = Math.max(8, Math.round(width * (img.height / img.width)));
      editor.updateElement(el.id, { src: img.src, width, height } as Partial<LabelElement>);
    } catch {
      /* ignore */
    }
  };

  const setWidth = (width: number) => {
    const height = lock ? Math.max(4, Math.round(width * (el.height / Math.max(1, el.width)))) : el.height;
    editor.updateElement(el.id, { width, height });
  };

  const setHeight = (height: number) => {
    const width = lock ? Math.max(4, Math.round(height * (el.width / Math.max(1, el.height)))) : el.width;
    editor.updateElement(el.id, { width, height });
  };

  return (
    <>
      <Section title={t("inspector.image")}>
        <ImageThumb el={el} />
        <div
          className={`image-drop ${over ? "over" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => file.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") file.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            void load(e.dataTransfer.files[0]);
          }}
        >
          {t("inspector.replace")} · PNG, JPG, WEBP
        </div>
        <input
          ref={file}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          style={{ display: "none" }}
          onChange={(e) => {
            void load(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <div className="note">{t("inspector.imageHint")}</div>
      </Section>

      <Section title={t("inspector.size")}>
        <div className="grid-2">
          <SizeField label={t("inspector.width")} value={el.width} min={4} onChange={setWidth} />
          <SizeField label={t("inspector.height")} value={el.height} min={4} onChange={setHeight} />
        </div>
        <Toggle checked={lock} onChange={setLock} label={t("inspector.lockRatio")} />
        <div className="row">
          <button
            className="btn btn-sm"
            type="button"
            onClick={() => {
              const width = Math.max(8, doc.widthDots - el.x * 2);
              const height = Math.max(4, Math.round(width * (el.height / Math.max(1, el.width))));
              editor.updateElement(el.id, { width, height });
            }}
          >
            <Icon name="fit" size={12} />
            {t("inspector.fit")}
          </button>
        </div>
      </Section>

      <Section title={t("inspector.threshold")} badge={String(el.threshold)}>
        <input
          className="range"
          type="range"
          min={0}
          max={255}
          value={el.threshold}
          aria-label={t("inspector.threshold")}
          onPointerDown={() => editor.beginGesture()}
          onChange={(e) => editor.updateElement(el.id, { threshold: Number(e.target.value) }, false)}
          onPointerUp={() => editor.endGesture()}
          onKeyDown={() => editor.beginGesture()}
          onKeyUp={() => editor.endGesture()}
        />
        <Toggle checked={el.dither} onChange={(dither) => editor.updateElement(el.id, { dither })} label={t("inspector.dither")} />
        <Toggle checked={el.invert} onChange={(invert) => editor.updateElement(el.id, { invert })} label={t("inspector.invert")} />
      </Section>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Layers                                                              */
/* ------------------------------------------------------------------ */

function labelFor(el: LabelElement, toolLabel: string): string {
  if (el.name && el.name.trim()) return el.name.trim();
  switch (el.type) {
    case "text":
      return el.text.split("\n")[0].slice(0, 26) || toolLabel;
    case "barcode":
      return `${SYMBOLOGY_INFO[el.symbology].label} · ${el.data.slice(0, 12)}`;
    default:
      return toolLabel;
  }
}

function Layers({ editor, onClear }: { editor: Editor; onClear: () => void }) {
  const { t } = useI18n();
  const items = [...editor.doc.elements].reverse();

  return (
    <div className="layers">
      <div className="layers-head">
        <h3>
          <Icon name="layers" size={13} />
          {t("layers.title")}
        </h3>
        <span className="count">{items.length}</span>
        <span className="spacer" />
        <IconButton
          icon="trash"
          label={editor.selection.length ? t("actions.delete") : t("confirm.clearYes")}
          onClick={() => {
            if (editor.selection.length) editor.removeSelected();
            else onClear();
          }}
          disabled={!editor.doc.elements.length}
          danger
          small
        />
      </div>
      {items.length ? (
        <div className="layers-list">
          {items.map((el) => {
            const active = editor.selection.includes(el.id);
            return (
              <div
                key={el.id}
                className={`layer ${active ? "active" : ""}`}
                onClick={(e) => editor.selectOne(el.id, e.shiftKey)}
                title={labelFor(el, t(`tool.${el.type}` as never))}
              >
                <span className="layer-icon">
                  <Icon name={TYPE_ICON[el.type]} size={12} />
                </span>
                <span className="layer-name">{labelFor(el, t(`tool.${el.type}` as never))}</span>
                {el.locked ? <Icon name="lock" size={11} /> : null}
                <span className="layer-actions" onClick={(e) => e.stopPropagation()}>
                  <IconButton
                    icon={el.locked ? "lock" : "unlock"}
                    label={el.locked ? t("inspector.unlock") : t("inspector.lock")}
                    onClick={() => editor.updateElement(el.id, { locked: !el.locked })}
                    small
                  />
                  <IconButton
                    icon="arrowUp"
                    label={t("layers.forward")}
                    onClick={() => editor.bringForward(el.id, 1)}
                    small
                  />
                  <IconButton
                    icon="arrowDown"
                    label={t("layers.backward")}
                    onClick={() => editor.bringForward(el.id, -1)}
                    small
                  />
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="layers-empty">{t("layers.empty")}</div>
      )}
    </div>
  );
}