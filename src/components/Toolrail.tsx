import { Icon, type IconName } from "./Icon";
import { useI18n } from "../i18n";
import type { Tool } from "../types";

const TOOLS: { tool: Tool; icon: IconName; label: string; key: string; group: number }[] = [
  { tool: "select", icon: "cursor", label: "tool.select", key: "V", group: 0 },
  { tool: "text", icon: "text", label: "tool.text", key: "T", group: 0 },
  { tool: "box", icon: "square", label: "tool.box", key: "R", group: 1 },
  { tool: "line", icon: "line", label: "tool.line", key: "L", group: 1 },
  { tool: "circle", icon: "circle", label: "tool.circle", key: "C", group: 1 },
  { tool: "ellipse", icon: "ellipse", label: "tool.ellipse", key: "E", group: 1 },
  { tool: "diagonal", icon: "diagonal", label: "tool.diagonal", key: "D", group: 1 },
  { tool: "barcode", icon: "barcode", label: "tool.barcode", key: "B", group: 2 },
  { tool: "image", icon: "image", label: "tool.image", key: "I", group: 2 },
];

export function Toolrail({ tool, setTool }: { tool: Tool; setTool: (t: Tool) => void }) {
  const { t } = useI18n();
  return (
    <nav className="toolrail" aria-label={t("tool.group.draw")}>
      {TOOLS.map((item, index) => {
        const prev = TOOLS[index - 1];
        return (
          <div key={item.tool} style={{ display: "contents" }}>
            {prev && prev.group !== item.group ? <div className="tool-sep" /> : null}
            <button
              type="button"
              className={`tool ${tool === item.tool ? "active" : ""}`}
              data-tip={`${t(item.label as never)} · ${item.key}`}
              aria-label={t(item.label as never)}
              aria-pressed={tool === item.tool}
              onClick={() => setTool(item.tool)}
            >
              <Icon name={item.icon} size={19} />
            </button>
          </div>
        );
      })}
      <div className="tool-spacer" />
      <div className="tool-sep" />
      <button
        type="button"
        className={`tool ${tool === "hand" ? "active" : ""}`}
        data-tip={`${t("tool.hand")} · H`}
        aria-label={t("tool.hand")}
        aria-pressed={tool === "hand"}
        onClick={() => setTool("hand")}
      >
        <Icon name="hand" size={19} />
      </button>
    </nav>
  );
}