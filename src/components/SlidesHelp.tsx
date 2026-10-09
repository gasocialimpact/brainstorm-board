import { useEffect } from "react";

// Browsers can't open PowerPoint or Keynote files, so slide decks come in as
// PDFs: each slide then becomes a frame, exactly as designed. The upload
// buttons accept slide files too, and show this guide when one is chosen.

/** What the upload pickers accept: PDFs plus slide decks (which get the guide). */
export const UPLOAD_ACCEPT = [
  "application/pdf",
  ".pdf",
  ".pptx",
  ".ppt",
  ".ppsx",
  ".pps",
  ".key",
  ".odp",
].join(",");

const SLIDE_EXT = /\.(pptx?|ppsx?|key|odp)$/i;

export const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
export const isSlides = (f: File) => SLIDE_EXT.test(f.name);

export function SlidesHelpDialog({
  fileName,
  onChoosePdf,
  onClose,
}: {
  fileName: string;
  onChoosePdf: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-small slides-help"
        role="dialog"
        aria-modal="true"
        aria-labelledby="slides-help-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="slides-help-title">Save your slides as a PDF first</h2>
        <p>
          <strong>{fileName}</strong> is a slide deck. Save it as a PDF and upload that instead; each
          slide becomes its own frame, looking exactly as designed.
        </p>
        <ul>
          <li>
            <strong>PowerPoint:</strong> File → Save As (or Export) → PDF
          </li>
          <li>
            <strong>Keynote:</strong> File → Export To → PDF
          </li>
          <li>
            <strong>Google Slides:</strong> File → Download → PDF document
          </li>
        </ul>
        <div className="modal-actions" style={{ gap: 8 }}>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              onClose();
              onChoosePdf();
            }}
          >
            Choose the PDF
          </button>
        </div>
      </div>
    </div>
  );
}
