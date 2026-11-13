import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./Icon";

export function IconButton({
  icon,
  label,
  onClick,
  active,
  disabled,
  danger,
  small,
  className = "",
}: {
  icon: IconName;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  small?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`icon-btn ${active ? "active" : ""} ${danger ? "danger" : ""} ${small ? "sm" : ""} ${className}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} size={small ? 15 : 17} />
    </button>
  );
}

export function Field({
  label,
  children,
  unit,
  hint,
}: {
  label?: string;
  children: ReactNode;
  unit?: string;
  hint?: string;
}) {
  return (
    <label className="field">
      {label ? (
        <span className="field-label">
          {label}
          {unit ? <span className="unit">{unit}</span> : null}
        </span>
      ) : null}
      {children}
      {hint ? <span className="tiny muted">{hint}</span> : null}
    </label>
  );
}

export function NumberField({
  value,
  onChange,
  min = 0,
  max = 99999,
  step = 1,
  suffix,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);

  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const commit = (raw: string) => {
    const parsed = Number(raw.replace(",", "."));
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const next = Math.round(parsed);
    onChange(clamp(next));
    setDraft(String(next));
  };

  return (
    <div className="num">
      <input
        className="input"
        inputMode="numeric"
        aria-label={ariaLabel}
        value={draft}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
          commit(draft);
        }}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const delta = (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
            const next = clamp(Math.round(value + delta));
            onChange(next);
            setDraft(String(next));
          }
        }}
      />
      {suffix ? (
        <span className="num-suffix" style={{ position: "absolute", right: 7, fontSize: 9, color: "var(--ink-faint)", pointerEvents: "none" }}>
          {suffix}
        </span>
      ) : null}
      <div className="num-steps">
        <button type="button" tabIndex={-1} aria-label="+" onClick={() => onChange(clamp(Math.round(value + step)))}>
          <Icon name="chevronDown" size={9} style={{ transform: "rotate(180deg)" }} />
        </button>
        <button type="button" tabIndex={-1} aria-label="−" onClick={() => onChange(clamp(Math.round(value - step)))}>
          <Icon name="chevronDown" size={9} />
        </button>
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; icon?: IconName }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg" role="group">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={value === opt.value ? "active" : ""}
          onClick={() => onChange(opt.value)}
          title={opt.label}
          aria-pressed={value === opt.value}
        >
          {opt.icon ? <Icon name={opt.icon} size={13} /> : opt.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="switch">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch-track" />
    </label>
  );
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = "normal",
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "normal" | "wide" | "xwide";
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${size !== "normal" ? size : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p className="sub">{subtitle}</p> : null}
          </div>
          <IconButton icon="x" label="Cerrar" onClick={onClose} />
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export function ColorPick({ value, onChange }: { value: "B" | "W"; onChange: (v: "B" | "W") => void }) {
  return (
    <div className="color-pick">
      <button type="button" data-color="B" className={value === "B" ? "active" : ""} onClick={() => onChange("B")} aria-label="Negro" />
      <button type="button" data-color="W" className={value === "W" ? "active" : ""} onClick={() => onChange("W")} aria-label="Blanco" />
    </div>
  );
}