import { useMemo, useState } from "react";
import type { Editor } from "../store";
import { generateZPL } from "../zpl/generate";
import { useI18n } from "../i18n";
import { copyText, downloadText, slugify } from "../util/file";
import { Icon } from "./Icon";
import { IconButton } from "./ui";

const COMMAND = /(\^[A-Z0-9@]{1,3}|~[A-Z]{1,2})/g;
const IS_COMMAND = /^(\^[A-Z0-9@]{1,3}|~[A-Z]{1,2})$/;

function highlight(line: string) {
  if (!line) return " ";
  if (line.trimStart().startsWith("^FX")) return <span className="comment">{line}</span>;
  const parts = line.split(COMMAND);
  return parts.map((part, i) =>
    IS_COMMAND.test(part) ? (
      <span key={i} className="cmd">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function CodePanel({
  editor,
  onToast,
  onOpenCode,
}: {
  editor: Editor;
  onToast: (msg: string) => void;
  onOpenCode: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const doc = editor.doc;

  const zpl = useMemo(() => generateZPL(doc), [doc, editor.imageTick]);
  const lines = useMemo(() => zpl.split("\n"), [zpl]);
  const stats = useMemo(() => {
    const bytes = new TextEncoder().encode(zpl).length;
    return { bytes, fields: doc.elements.length };
  }, [zpl, doc.elements.length]);

  const filename = `${slugify(doc.name || t("app.untitled"))}-${Math.round(doc.widthMm)}x${Math.round(doc.heightMm)}.zpl`;

  const peek = lines.find((line) => line.startsWith("^FD")) ?? lines.slice(0, 8).join(" ");

  const copy = async () => {
    const ok = await copyText(zpl);
    onToast(ok ? t("toast.copied") : t("toast.importError"));
  };

  const download = () => {
    downloadText(zpl, filename);
    onToast(t("toast.downloaded"));
  };

  return (
    <section className={`codepanel ${open ? "open" : "collapsed"}`}>
      <div
        className="codebar"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
      >
        <span className="code-tag">ZPL</span>
        <span className="code-preview">{peek || "^XA … ^XZ"}</span>
        <span className="code-stats">
          {t("code.stats", { fields: stats.fields, lines: lines.length, bytes: stats.bytes })}
        </span>
        <span className="code-actions" onClick={(e) => e.stopPropagation()}>
          <IconButton icon="code" label={t("code.edit")} onClick={onOpenCode} small />
          <IconButton icon="copy" label={t("export.copy")} onClick={copy} small />
          <IconButton icon="download" label={t("export.download")} onClick={download} small />
        </span>
        <Icon
          name="chevronDown"
          size={15}
          style={{ transform: open ? "none" : "rotate(-90deg)", transition: "transform 140ms ease" }}
        />
      </div>
      {open ? (
        <div className="code-body">
          <div className="code-view" role="region" aria-label={t("export.zpl")}>
            {lines.map((line, i) => (
              <div className="code-line" key={i}>
                <span className="line-no">{i + 1}</span>
                {highlight(line)}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}