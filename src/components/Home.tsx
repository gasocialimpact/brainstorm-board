import { useCallback, useEffect, useRef, useState } from "react";

import { newFrame } from "../board/frame";
import { readBoardFile } from "../board/io";
import { deleteBoard as deleteLocalCopy, saveBoard, saveFile } from "../board/storage";
import type { Board } from "../board/types";
import { setPendingPdf } from "../owner/pending";
import { go, linkTo } from "../route";
import { newShareId } from "../sync/ids";
import {
  adminList,
  deleteBoardEverywhere,
  deleteFolder,
  moveBoard,
  saveFolder,
  setPassword,
  signOut,
  type BoardRow,
  type FolderRow,
} from "../sync/owner";
import { uploadBoard } from "../sync/remote";
import { framesForBoard } from "../templates/boardTemplates";

import { Brand } from "./Brand";
import { BoardTemplateGrid } from "./TemplatePicker";

/** Which boards the right-hand panel shows */
type View = "all" | "unfiled" | string;

const BOARD_MIME = "application/x-brainstorm-board";

const edited = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    prompt("Copy this link:", text);
    return false;
  }
}

// The owner's landing page: folders on the left, new boards in the middle,
// the boards in the selected folder on the right.
export function Home({ email }: { email: string }) {
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [boards, setBoards] = useState<BoardRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>(() => sessionStorage.getItem("bb-view") ?? "all");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [newFolderName, setNewFolderName] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);

  const flash = (msg: string) => {
    setNote(msg);
    window.setTimeout(() => setNote((n) => (n === msg ? "" : n)), 4000);
  };

  const refresh = useCallback(async () => {
    try {
      const data = await adminList();
      setFolders(data.folders);
      setBoards(data.boards);
    } catch (err) {
      console.error(err);
      flash("Couldn't load your boards. Check your connection and reload.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    try {
      sessionStorage.setItem("bb-view", view);
    } catch {
      // Not important if it can't be remembered.
    }
  }, [view]);

  // A folder that no longer exists falls back to all boards.
  const folder = folders.find((f) => f.id === view);
  useEffect(() => {
    if (loaded && view !== "all" && view !== "unfiled" && !folder) setView("all");
  }, [loaded, view, folder]);

  const targetFolder = folder?.id ?? null;
  const shown = boards.filter((b) =>
    view === "all" ? true : view === "unfiled" ? !b.folder_id : b.folder_id === view,
  );
  const countIn = (id: string | null) => boards.filter((b) => b.folder_id === id).length;

  // ---------- Creating boards ----------

  const startBoard = async (board: Board, files = {}, pdf?: File) => {
    setBusy("Creating board...");
    try {
      await uploadBoard(board, files, targetFolder);
      board.shared = true;
      await saveBoard(board);
      await Promise.all(Object.values(files).map((f) => saveFile(board.id, f as never)));
      if (pdf) setPendingPdf(board.id, pdf);
      go({ kind: "board", id: board.id });
    } catch (err) {
      console.error(err);
      flash("Couldn't create the board. Check your connection and try again.");
      setBusy(null);
    }
  };

  const fromTemplate = (templateId: string) =>
    startBoard({
      id: newShareId(),
      title: title.trim() || "Untitled Brainstorm",
      updated: Date.now(),
      frames: framesForBoard(templateId),
    });

  const fromPdf = (file: File) =>
    startBoard(
      {
        id: newShareId(),
        title: title.trim() || file.name.replace(/\.pdf$/i, ""),
        updated: Date.now(),
        frames: framesForBoard("blank"),
      },
      {},
      file,
    );

  const fromFile = async (file: File) => {
    try {
      const data = await readBoardFile(file);
      const frames = data.board.frames.length ? data.board.frames : [newFrame("Frame 1")];
      await startBoard(
        { ...data.board, frames, id: newShareId(), shared: false, updated: Date.now() },
        data.files,
      );
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // ---------- Folders ----------

  const createFolder = async (name: string) => {
    setNewFolderName(null);
    const id = newShareId();
    try {
      await saveFolder(id, name.trim() || "Untitled folder");
      await refresh();
      setView(id);
    } catch (err) {
      console.error(err);
      flash("Couldn't create the folder.");
    }
  };

  const renameFolder = async (id: string, name: string) => {
    setRenaming(null);
    if (!name.trim()) return;
    setFolders((fs) => fs.map((f) => (f.id === id ? { ...f, name: name.trim() } : f)));
    try {
      await saveFolder(id, name.trim());
    } catch (err) {
      console.error(err);
      flash("Couldn't rename the folder.");
      void refresh();
    }
  };

  const removeFolder = async (f: FolderRow) => {
    const n = countIn(f.id);
    const msg =
      `Delete the folder "${f.name}"?` +
      (n ? ` Its ${n} board${n === 1 ? "" : "s"} will move to Unfiled.` : "") +
      " Its share link will stop working.";
    if (!confirm(msg)) return;
    try {
      await deleteFolder(f.id);
      setView("all");
      await refresh();
    } catch (err) {
      console.error(err);
      flash("Couldn't delete the folder.");
    }
  };

  // ---------- Boards ----------

  const move = async (boardId: string, folderId: string | null) => {
    setBoards((bs) => bs.map((b) => (b.id === boardId ? { ...b, folder_id: folderId } : b)));
    try {
      await moveBoard(boardId, folderId);
    } catch (err) {
      console.error(err);
      flash("Couldn't move the board.");
      void refresh();
    }
  };

  const remove = async (b: BoardRow) => {
    if (!confirm(`Delete "${b.title}" for everyone? This can't be undone.`)) return;
    try {
      await deleteBoardEverywhere(b.id);
      await deleteLocalCopy(b.id);
      setBoards((bs) => bs.filter((x) => x.id !== b.id));
    } catch (err) {
      console.error(err);
      flash("Couldn't delete the board.");
    }
  };

  // Lets the owner sign in without waiting on emails (Supabase rate-limits them).
  const [choosingPassword, setChoosingPassword] = useState(false);

  const panelTitle = view === "all" ? "All boards" : view === "unfiled" ? "Unfiled" : (folder?.name ?? "");

  if (busy) return <div className="loading">{busy}</div>;

  return (
    <div className="home">
      <header className="home-header">
        <Brand />
        <span className="status" role="status">
          {note}
        </span>
        <span className="muted small">{email}</span>
        <button className="btn" onClick={() => setChoosingPassword(true)}>
          Set password
        </button>
        <button className="btn" onClick={() => void signOut()}>
          Sign out
        </button>
      </header>

      <nav className="folders" aria-label="Folders">
        <div className="rail-label">Folders</div>
        {(
          [
            ["all", "All boards", boards.length],
            ["unfiled", "Unfiled", countIn(null)],
          ] as const
        ).map(([id, label, n]) => (
          <button
            key={id}
            className={"folder-item" + (view === id ? " active" : "") + (dropTarget === id ? " drop" : "")}
            onClick={() => setView(id)}
            onDragOver={(e) => {
              if (id !== "unfiled" || !e.dataTransfer.types.includes(BOARD_MIME)) return;
              e.preventDefault();
              setDropTarget(id);
            }}
            onDragLeave={() => setDropTarget(null)}
            onDrop={(e) => {
              setDropTarget(null);
              const boardId = e.dataTransfer.getData(BOARD_MIME);
              if (boardId && id === "unfiled") void move(boardId, null);
            }}
          >
            <span>{label}</span>
            <span className="count">{n}</span>
          </button>
        ))}
        <hr />
        {folders.map((f) => (
          <button
            key={f.id}
            className={"folder-item" + (view === f.id ? " active" : "") + (dropTarget === f.id ? " drop" : "")}
            onClick={() => setView(f.id)}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes(BOARD_MIME)) return;
              e.preventDefault();
              setDropTarget(f.id);
            }}
            onDragLeave={() => setDropTarget(null)}
            onDrop={(e) => {
              setDropTarget(null);
              const boardId = e.dataTransfer.getData(BOARD_MIME);
              if (boardId) void move(boardId, f.id);
            }}
          >
            <span className="folder-name">{f.name}</span>
            <span className="count">{countIn(f.id)}</span>
          </button>
        ))}
        {newFolderName === null ? (
          <button className="folder-add" onClick={() => setNewFolderName("")}>
            + New folder
          </button>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void createFolder(newFolderName);
            }}
          >
            <input
              className="text-input"
              autoFocus
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onBlur={() => (newFolderName.trim() ? void createFolder(newFolderName) : setNewFolderName(null))}
              onKeyDown={(e) => e.key === "Escape" && setNewFolderName(null)}
            />
          </form>
        )}
      </nav>

      <main className="home-main">
        <h2>Start a new board</h2>
        <p className="muted small">
          {targetFolder ? (
            <>
              New boards go in <strong>{folder?.name}</strong>.
            </>
          ) : (
            "New boards are unfiled. Select a folder first to create boards in it."
          )}
        </p>
        <label className="field-label" htmlFor="newTitle">
          Board name
        </label>
        <input
          id="newTitle"
          className="text-input"
          placeholder="Untitled Brainstorm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void fromTemplate("blank")}
        />
        <div className="section-row">
          <h2>Start from a template</h2>
          <div className="landing-actions">
            <button className="btn" onClick={() => pdfInput.current?.click()}>
              Start from a PDF
            </button>
            <button className="btn" onClick={() => importInput.current?.click()}>
              Open a file
            </button>
          </div>
        </div>
        <BoardTemplateGrid onPick={(id) => void fromTemplate(id)} />
        <input
          ref={pdfInput}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void fromPdf(file);
          }}
        />
        <input
          ref={importInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void fromFile(file);
          }}
        />
      </main>

      <aside className="recent" aria-labelledby="panel-title">
        <div className="panel-head">
          {folder && renaming === folder.id ? (
            <input
              className="text-input"
              autoFocus
              defaultValue={folder.name}
              aria-label="Folder name"
              onBlur={(e) => void renameFolder(folder.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void renameFolder(folder.id, (e.target as HTMLInputElement).value);
                if (e.key === "Escape") setRenaming(null);
              }}
            />
          ) : (
            <h2 id="panel-title">{panelTitle}</h2>
          )}
          {folder && renaming !== folder.id && (
            <div className="panel-actions">
              <button
                className="btn btn-small btn-primary"
                onClick={async () => {
                  if (await copy(linkTo({ kind: "folder", id: folder.id }))) {
                    flash("Folder link copied. Anyone with it can open the boards in this folder.");
                  }
                }}
              >
                Copy folder link
              </button>
              <button className="btn btn-small" onClick={() => setRenaming(folder.id)}>
                Rename
              </button>
              <button className="btn btn-small" onClick={() => void removeFolder(folder)}>
                Delete
              </button>
            </div>
          )}
        </div>

        {!loaded ? (
          <p className="muted small">Loading...</p>
        ) : shown.length === 0 ? (
          <p className="muted small">
            {view === "all" ? "Boards you create will show up here." : "No boards here yet. Drag boards onto a folder to file them."}
          </p>
        ) : (
          <ul className="board-list">
            {shown.map((b) => (
              <li
                key={b.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(BOARD_MIME, b.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
              >
                <button className="board-open" onClick={() => go({ kind: "board", id: b.id })}>
                  {b.thumbnail ? <img src={b.thumbnail} alt="" /> : <span className="board-thumb-empty" />}
                  <span className="board-text">
                    <span className="board-name">{b.title || "Untitled Brainstorm"}</span>
                    <span className="muted small">
                      {b.frames} frame{b.frames === 1 ? "" : "s"} · {edited(b.updated_at)}
                      {view === "all" && b.folder_id && (
                        <> · {folders.find((f) => f.id === b.folder_id)?.name}</>
                      )}
                    </span>
                  </span>
                </button>
                <div className="board-actions">
                  <button
                    className="icon-btn"
                    title="Copy board link"
                    aria-label={`Copy link to ${b.title}`}
                    onClick={async () => {
                      if (await copy(linkTo({ kind: "board", id: b.id }))) {
                        flash("Board link copied. Anyone with it can open and edit this board.");
                      }
                    }}
                  >
                    🔗
                  </button>
                  <select
                    className="move-select"
                    aria-label={`Folder for ${b.title}`}
                    value={b.folder_id ?? ""}
                    onChange={(e) => void move(b.id, e.target.value || null)}
                  >
                    <option value="">Unfiled</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="icon-btn"
                    title="Delete board"
                    aria-label={`Delete ${b.title}`}
                    onClick={() => void remove(b)}
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>
      {choosingPassword && (
        <PasswordDialog
          onClose={() => setChoosingPassword(false)}
          onSaved={() => {
            setChoosingPassword(false);
            flash("Password saved. Next time, sign in with your email and this password.");
          }}
        />
      )}
    </div>
  );
}

function PasswordDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal modal-small"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pw-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          if (pw.length < 8) return setError("Use at least 8 characters.");
          if (pw !== again) return setError("The two passwords don't match.");
          setSaving(true);
          try {
            await setPassword(pw);
            onSaved();
          } catch (err) {
            setError((err as Error).message);
            setSaving(false);
          }
        }}
      >
        <h2 id="pw-title">Set a password</h2>
        <p className="muted">Sign in with your email and this password, without waiting for an email.</p>
        <input
          className="text-input"
          type="password"
          autoComplete="new-password"
          autoFocus
          placeholder="New password (8+ characters)"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        <input
          className="text-input"
          type="password"
          autoComplete="new-password"
          placeholder="Same password again"
          value={again}
          onChange={(e) => setAgain(e.target.value)}
        />
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions" style={{ gap: 8 }}>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save password"}
          </button>
        </div>
      </form>
    </div>
  );
}
