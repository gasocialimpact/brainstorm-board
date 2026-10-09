import { useEffect, useState } from "react";

import { go } from "../route";
import { Brand } from "./Brand";
import { getFolder, type SharedFolder } from "../sync/owner";

const edited = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// What someone with a folder link sees: the folder's boards, nothing else.
export function FolderPage({ id }: { id: string }) {
  const [folder, setFolder] = useState<SharedFolder | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    getFolder(id)
      .then((f) => live && setFolder(f))
      .catch((err) => {
        console.error(err);
        if (live) setFolder(null);
      });
    return () => {
      live = false;
    };
  }, [id]);

  if (folder === undefined) return <div className="loading">Opening folder...</div>;
  if (!folder) {
    return <div className="loading">This folder wasn't found. The link may be incomplete, or the folder was deleted.</div>;
  }

  return (
    <div className="folder-page">
      <div className="folder-brand">
        <Brand />
      </div>
      <header>
        <p className="eyebrow">Shared folder</p>
        <h1>{folder.name}</h1>
        <p className="muted">
          {folder.boards.length} board{folder.boards.length === 1 ? "" : "s"}. Anyone with this
          link can open and edit them.
        </p>
      </header>
      {folder.boards.length === 0 ? (
        <p className="muted">There are no boards in this folder yet.</p>
      ) : (
        <ul className="card-grid">
          {folder.boards.map((b) => (
            <li key={b.id}>
              <button className="board-card" onClick={() => go({ kind: "board", id: b.id, folder: id })}>
                {b.thumbnail ? <img src={b.thumbnail} alt="" /> : <span className="card-thumb-empty" />}
                <span className="board-name">{b.title || "Untitled Brainstorm"}</span>
                <span className="muted small">Edited {edited(b.updated_at)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
