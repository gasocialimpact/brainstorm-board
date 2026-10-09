import { useLayoutEffect, useRef, type ReactNode } from "react";

import { CLUSTERS, type ClusterKind } from "../board/clusters";

export const CLUSTER_MIME = "application/x-brainstorm-cluster";

export type AlignKind = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";

type Props = {
  /** Something is selected or a drawing tool is active: show style tools */
  inspecting: boolean;
  /** Something is selected, so it can be aligned to the frame */
  canAlign: boolean;
  onAlign: (kind: AlignKind) => void;
  onAddCluster: (kind: ClusterKind) => void;
};

const ALIGN: { kind: AlignKind; label: string; icon: ReactNode }[] = [
  { kind: "left", label: "Align to frame's left edge", icon: <path d="M4 3v18M8 7h10v4H8zM8 13h6v4H8z" /> },
  { kind: "hcenter", label: "Center horizontally on frame", icon: <path d="M12 3v18M6 7h12v4H6zM8 13h8v4H8z" /> },
  { kind: "right", label: "Align to frame's right edge", icon: <path d="M20 3v18M6 7h10v4H6zM10 13h6v4h-6z" /> },
  { kind: "top", label: "Align to frame's top edge", icon: <path d="M3 4h18M7 8h4v10H7zM13 8h4v6h-4z" /> },
  { kind: "vcenter", label: "Center vertically on frame", icon: <path d="M3 12h18M7 6h4v12H7zM13 8h4v8h-4z" /> },
  { kind: "bottom", label: "Align to frame's bottom edge", icon: <path d="M3 20h18M7 6h4v10H7zM13 10h4v6h-4z" /> },
];

// The right-hand sidebar. Normally it offers thought clusters; while
// something is selected (or a drawing tool is active) it becomes the style
// inspector: frame alignment on top, and Excalidraw's own style panel docked
// below (positioned over the `.style-dock` area via CSS variables, so it
// never covers the frame).
export function SidePanel({ inspecting, canAlign, onAlign, onAddCluster }: Props) {
  const sideRef = useRef<HTMLElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const side = sideRef.current;
    if (!side) return;
    const place = () => {
      const root = document.documentElement.style;
      const s = side.getBoundingClientRect();
      const d = dockRef.current?.getBoundingClientRect();
      const top = d ? d.top : s.top + 48;
      root.setProperty("--dock-left", `${s.left}px`);
      root.setProperty("--dock-width", `${s.width}px`);
      root.setProperty("--dock-top", `${top}px`);
      root.setProperty("--dock-height", `${Math.max(120, s.bottom - top)}px`);
      // Only dock when the sidebar is actually on screen (it hides on
      // narrow windows, where Excalidraw's own layout applies).
      document.body.classList.toggle("dock-styles", s.width > 0);
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(side);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [inspecting, canAlign]);

  useLayoutEffect(() => () => document.body.classList.remove("dock-styles"), []);

  return (
    <aside className={"side" + (inspecting ? " inspecting" : "")} ref={sideRef} aria-label="Tools">
      {inspecting ? (
        <>
          {canAlign && (
            <section className="align-tools" aria-label="Align to frame">
              <div className="rail-label">Align to frame</div>
              <div className="align-grid">
                {ALIGN.map((a) => (
                  <button key={a.kind} className="align-btn" title={a.label} aria-label={a.label} onClick={() => onAlign(a.kind)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      {a.icon}
                    </svg>
                  </button>
                ))}
              </div>
            </section>
          )}
          <div className="rail-label">Style</div>
          <div className="style-dock" ref={dockRef} />
        </>
      ) : (
        <>
          <div className="rail-label">Thought clusters</div>
          <p className="side-hint">
            Add a column of notes to the frame. Click to place it, or drag it where you want it. Move
            a cluster by dragging its name.
          </p>
          {CLUSTERS.map((k) => (
            <button
              key={k.label}
              className="cluster-btn"
              draggable
              onClick={() => onAddCluster(k)}
              onDragStart={(e) => {
                e.dataTransfer.setData(CLUSTER_MIME, k.label);
                e.dataTransfer.effectAllowed = "copy";
              }}
            >
              <span className="cluster-head" style={{ background: k.head, color: k.ink }}>
                {k.label}
              </span>
              <span className="cluster-body" style={{ background: k.tint }}>
                <span className="cluster-prompt">{k.prompt}</span>
                <span className="cluster-notes">
                  <i style={{ background: k.noteColor }} />
                  <i style={{ background: k.noteColor }} />
                </span>
              </span>
            </button>
          ))}
        </>
      )}
    </aside>
  );
}
