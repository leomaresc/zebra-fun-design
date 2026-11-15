import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "cursor" | "text" | "square" | "line" | "circle" | "ellipse" | "diagonal"
  | "barcode" | "image" | "hand" | "undo" | "redo" | "chevronDown" | "chevronRight"
  | "plus" | "minus" | "trash" | "copy" | "layers" | "download" | "upload" | "check"
  | "x" | "grid" | "magnet" | "zoomIn" | "zoomOut" | "fit" | "settings" | "help"
  | "globe" | "arrowUp" | "arrowDown" | "front" | "back" | "lock" | "unlock"
  | "eye" | "eyeOff" | "alignLeft" | "alignCenterH" | "alignRight" | "alignTop"
  | "alignCenterV" | "alignBottom" | "distributeH" | "distributeV" | "folder"
  | "code" | "printer" | "fileImage" | "fileJson" | "sparkle" | "warning"
  | "external" | "keyboard" | "panelRight" | "drag" | "textCursor" | "scan" | "icons";

const paths: Record<IconName, ReactNode> = {
  cursor: <path d="M5 3l14 8-6.1 1.7L16.6 20l-2.5 1-3.7-7.4L5 18z" />,
  text: <><path d="M6 5V3h12v2" /><path d="M12 3v18" /><path d="M9 21h6" /></>,
  square: <rect x="4" y="4" width="16" height="16" rx="1.5" />,
  line: <path d="M4 20L20 4" />,
  circle: <circle cx="12" cy="12" r="8.5" />,
  ellipse: <ellipse cx="12" cy="12" rx="9" ry="6" />,
  diagonal: <><path d="M4 20L20 4" /><path d="M4 15v5h5" /><path d="M15 4h5v5" /></>,
  barcode: <><path d="M5 5v14" /><path d="M8.6 5v14" /><path d="M11.4 5v10" /><path d="M14.2 5v14" /><path d="M17.4 5v8" /><path d="M20 5v14" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.4" /><path d="M21 15l-5-5L5 20" /></>,
  hand: <path d="M8 11V6.2a1.6 1.6 0 013.2 0V11m0-1.6a1.6 1.6 0 013.2 0V12m0-1.2a1.6 1.6 0 013.2 0v4.4A5.8 5.8 0 0111.8 21h-.9a5.8 5.8 0 01-4.2-1.8L5 15.4a1.7 1.7 0 012.4-2.4L9 14.6" />,
  undo: <><path d="M4 9h9a5 5 0 010 10H8" /><path d="M8 5L4 9l4 4" /></>,
  redo: <><path d="M20 9h-9a5 5 0 000 10h5" /><path d="M16 5l4 4-4 4" /></>,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  minus: <path d="M5 12h14" />,
  trash: <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M7 7l1 13h8l1-13" /><path d="M10 11v5" /><path d="M14 11v5" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a1 1 0 011-1h9" /></>,
  layers: <><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /><path d="M3 17.5l9 5 9-5" /></>,
  download: <><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M4 21h16" /></>,
  upload: <><path d="M12 21V9" /><path d="M7 14l5-5 5 5" /><path d="M4 3h16" /></>,
  check: <path d="M5 12.5l4.2 4.2L19 6.4" />,
  x: <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>,
  grid: <><circle cx="6" cy="6" r="1.2" fill="currentColor" stroke="none" /><circle cx="12" cy="6" r="1.2" fill="currentColor" stroke="none" /><circle cx="18" cy="6" r="1.2" fill="currentColor" stroke="none" /><circle cx="6" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="18" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="6" cy="18" r="1.2" fill="currentColor" stroke="none" /><circle cx="12" cy="18" r="1.2" fill="currentColor" stroke="none" /><circle cx="18" cy="18" r="1.2" fill="currentColor" stroke="none" /></>,
  magnet: <><path d="M6 4h4v7a2 2 0 004 0V4h4v7a6 6 0 01-12 0z" /><path d="M6 8h4" /><path d="M14 8h4" /></>,
  zoomIn: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /><path d="M11 8v6" /><path d="M8 11h6" /></>,
  zoomOut: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /><path d="M8 11h6" /></>,
  fit: <><path d="M4 9V4h5" /><path d="M20 9V4h-5" /><path d="M4 15v5h5" /><path d="M20 15v5h-5" /></>,
  settings: <><path d="M4 7h9" /><path d="M18.5 7H21" /><path d="M4 17h3" /><path d="M11.5 17H21" /><circle cx="15.5" cy="7" r="2.2" /><circle cx="8" cy="17" r="2.2" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.4 9.2a2.7 2.7 0 115.1 1c-.5 1.3-2.5 1.6-2.5 3.2" /><circle cx="12" cy="17.2" r="0.9" fill="currentColor" stroke="none" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.8 2.6 2.8 15.4 0 18" /><path d="M12 3c-2.8 2.6-2.8 15.4 0 18" /></>,
  arrowUp: <><path d="M12 20V4" /><path d="M6 10l6-6 6 6" /></>,
  arrowDown: <><path d="M12 4v16" /><path d="M6 14l6 6 6-6" /></>,
  front: <><path d="M12 3l9 5-9 5-9-5z" /><path d="M12 14v7" /><path d="M9 18l3 3 3-3" /></>,
  back: <><path d="M12 21l9-5-9-5-9 5z" /><path d="M12 10V3" /><path d="M9 6l3-3 3 3" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10.5" rx="2" /><path d="M8 10.5V8a4 4 0 018 0v2.5" /></>,
  unlock: <><rect x="5" y="10.5" width="14" height="10.5" rx="2" /><path d="M8 10.5V8a4 4 0 016.9-2.7" /></>,
  eye: <><path d="M2.2 12S5.8 6.2 12 6.2 21.8 12 21.8 12 18.2 17.8 12 17.8 2.2 12 2.2 12z" /><circle cx="12" cy="12" r="2.6" /></>,
  eyeOff: <><path d="M4 4l16 16" /><path d="M9.5 6.8A9.8 9.8 0 0112 6.2c6.2 0 9.8 5.8 9.8 5.8a17 17 0 01-2.4 3.1" /><path d="M6.2 8.2A17.3 17.3 0 002.2 12S5.8 17.8 12 17.8a9.5 9.5 0 003.5-.65" /></>,
  alignLeft: <><path d="M4 3v18" /><rect x="7" y="6" width="11" height="4" rx="1" /><rect x="7" y="14" width="7" height="4" rx="1" /></>,
  alignCenterH: <><path d="M12 3v18" /><rect x="4.5" y="6" width="15" height="4" rx="1" /><rect x="7.5" y="14" width="9" height="4" rx="1" /></>,
  alignRight: <><path d="M20 3v18" /><rect x="6" y="6" width="11" height="4" rx="1" /><rect x="10" y="14" width="7" height="4" rx="1" /></>,
  alignTop: <><path d="M3 4h18" /><rect x="6" y="7" width="4" height="11" rx="1" /><rect x="14" y="7" width="4" height="7" rx="1" /></>,
  alignCenterV: <><path d="M3 12h18" /><rect x="6" y="4.5" width="4" height="15" rx="1" /><rect x="14" y="7.5" width="4" height="9" rx="1" /></>,
  alignBottom: <><path d="M3 20h18" /><rect x="6" y="6" width="4" height="11" rx="1" /><rect x="14" y="10" width="4" height="7" rx="1" /></>,
  distributeH: <><rect x="3" y="5" width="4" height="14" rx="1" /><rect x="10" y="5" width="4" height="14" rx="1" /><rect x="17" y="5" width="4" height="14" rx="1" /></>,
  distributeV: <><rect x="5" y="3" width="14" height="4" rx="1" /><rect x="5" y="10" width="14" height="4" rx="1" /><rect x="5" y="17" width="14" height="4" rx="1" /></>,
  folder: <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />,
  code: <><path d="M8 6l-5 6 5 6" /><path d="M16 6l5 6-5 6" /></>,
  printer: <><path d="M7 8V3h10v5" /><rect x="4" y="8" width="16" height="8" rx="1.5" /><path d="M7 16h10v5H7z" /></>,
  fileImage: <><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" /><path d="M14 3v6h6" /><circle cx="9" cy="13" r="1.2" /><path d="M18 20l-4-4-6 6" /></>,
  fileJson: <><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" /><path d="M14 3v6h6" /><path d="M10 13c-1 0-1 1-1 2s0 2-1 2M14 13c1 0 1 1 1 2s0 2 1 2" /></>,
  sparkle: <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" /></>,
  warning: <><path d="M12 3.5L21 20H3z" /><path d="M12 9v5" /><circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" /></>,
  external: <><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" /></>,
  keyboard: <><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M8 14h8" /></>,
  panelRight: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></>,
  drag: <><circle cx="9" cy="7" r="1.1" fill="currentColor" stroke="none" /><circle cx="15" cy="7" r="1.1" fill="currentColor" stroke="none" /><circle cx="9" cy="12" r="1.1" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="1.1" fill="currentColor" stroke="none" /><circle cx="9" cy="17" r="1.1" fill="currentColor" stroke="none" /><circle cx="15" cy="17" r="1.1" fill="currentColor" stroke="none" /></>,
  textCursor: <><path d="M9 4h2v16H9" /><path d="M15 4h-2v16h2" /><path d="M6 4h12" /><path d="M6 20h12" /></>,
  scan: <><path d="M4 8V5a1 1 0 011-1h3" /><path d="M16 4h3a1 1 0 011 1v3" /><path d="M20 16v3a1 1 0 01-1 1h-3" /><path d="M8 20H5a1 1 0 01-1-1v-3" /><path d="M4 12h16" /></>,
  icons: <><circle cx="12" cy="12" r="8.5" /><circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" /><path d="M8.6 14.4a4.6 4.6 0 006.8 0" /></>,
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}

export function Icon({ name, size = 18, strokeWidth = 1.7, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}