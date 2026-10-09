import { exportToCanvas } from "@excalidraw/excalidraw";
import { jsPDF } from "jspdf";

import { frameSize } from "./frame";
import type { Board, BoardFiles } from "./types";

// Long edge of each page image. Sharp in print and on screen, while keeping a
// many-frame board's PDF a reasonable size.
const PAGE_PX = 2400;
// Page long edge in PDF points (11 in), so pages print at a familiar size.
const PAGE_PT = 792;

/** One PDF page per frame, in frame order, each shaped like its frame. */
export async function exportBoardPdf(
  board: Board,
  files: BoardFiles,
  onProgress?: (page: number, total: number) => void,
) {
  let doc: jsPDF | null = null;
  const frames = board.frames;
  for (const [i, frame] of frames.entries()) {
    onProgress?.(i + 1, frames.length);
    const elements = frame.elements.filter((e) => !e.isDeleted);
    if (!elements.length) continue;
    const { width, height } = frameSize(frame);
    const scale = PAGE_PX / Math.max(width, height);
    const canvas = await exportToCanvas({
      elements,
      files,
      appState: { exportBackground: true, viewBackgroundColor: "#ffffff" },
      exportPadding: 0,
      getDimensions: (w: number, h: number) => ({ width: w * scale, height: h * scale, scale }),
    });
    const k = PAGE_PT / Math.max(canvas.width, canvas.height);
    const pw = canvas.width * k;
    const ph = canvas.height * k;
    const orientation = pw >= ph ? "landscape" : "portrait";
    if (!doc) doc = new jsPDF({ unit: "pt", format: [pw, ph], orientation, compress: true });
    else doc.addPage([pw, ph], orientation);
    doc.addImage(canvas.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, pw, ph, undefined, "FAST");
    canvas.width = canvas.height = 0;
  }
  if (!doc) throw new Error("This board has nothing to export yet.");
  const name = (board.title || "brainstorm-board").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  doc.save(`${name || "brainstorm-board"}.pdf`);
}
