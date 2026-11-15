import { Icon } from "./Icon";
import { IconButton } from "./ui";
import { useI18n } from "../i18n";
import type { Doc } from "../types";

export function TopBar({
  doc,
  name,
  onName,
  canUndo,
  canRedo,
  undo,
  redo,
  onSetup,
  onExport,
  onPrint,
  onTemplates,
  onHelp,
  saveState,
  onToggleInspector,
  inspectorOpen,
}: {
  doc: Doc;
  name: string;
  onName: (name: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  onSetup: () => void;
  onExport: () => void;
  onPrint: () => void;
  onTemplates: () => void;
  onHelp: () => void;
  saveState: "saved" | "saving";
  onToggleInspector: () => void;
  inspectorOpen: boolean;
}) {
  const { t, lang, setLang } = useI18n();
  return (
    <header className="topbar">
      <div className="brand">
        <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
          <rect width="32" height="32" rx="8" fill="#15161a" />
          <path d="M9 9h14l-11 14h14" stroke="#fff" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M24.5 4.5l3 3M4.5 24.5l3 3" stroke="#fff" strokeWidth="1.1" opacity="0.55" strokeLinecap="round" />
        </svg>
        <div className="brand-text">
          <span className="brand-name">Zebra Fun Design</span>
          <span className="brand-tag">{t("app.tagline")}</span>
        </div>
      </div>

      <div className="project">
        <input
          className="project-input"
          value={name}
          placeholder={t("app.untitled")}
          aria-label={t("app.untitled")}
          onChange={(e) => onName(e.target.value)}
        />
        <span className="save-flag" data-state={saveState}>
          <span className="save-dot" />
          {saveState === "saving" ? t("top.saving") : t("top.saved")}
        </span>
      </div>

      <div className="top-actions">
        <button className="chip" type="button" onClick={onSetup} title={t("top.setup")}>
          <Icon name="settings" size={15} />
          <span>
            {Math.round(doc.widthMm)}×{Math.round(doc.heightMm)} mm
          </span>
          <span className="mono">{doc.dpi} dpi</span>
        </button>

        <button className="chip" type="button" onClick={onTemplates} title={t("top.templates")}>
          <Icon name="sparkle" size={15} />
          <span className="chip-label">{t("top.templates")}</span>
        </button>

        <div className="top-group">
          <IconButton icon="undo" label={t("top.undo")} onClick={undo} disabled={!canUndo} small />
          <IconButton icon="redo" label={t("top.redo")} onClick={redo} disabled={!canRedo} small />
        </div>

        <div className="lang-toggle" role="group" aria-label={t("top.lang")}>
          <button type="button" className={lang === "es" ? "active" : ""} onClick={() => setLang("es")}>
            ES
          </button>
          <button type="button" className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>
            EN
          </button>
        </div>

        <IconButton icon="help" label={t("top.help")} onClick={onHelp} />
        <IconButton
          icon="panelRight"
          label={t("inspector.title")}
          onClick={onToggleInspector}
          active={inspectorOpen}
          className="drawer-toggle"
        />

        <button className="btn" type="button" onClick={onPrint} title={t("top.print")}>
          <Icon name="printer" size={15} />
          <span className="btn-label">{t("top.print")}</span>
        </button>
        <button className="btn btn-primary" type="button" onClick={onExport}>
          <Icon name="download" size={15} />
          <span className="btn-label">{t("top.export")}</span>
        </button>
      </div>
    </header>
  );
}