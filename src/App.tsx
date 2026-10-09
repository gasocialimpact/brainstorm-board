import { useEffect, useState } from "react";

import { loadBoard, loadFiles, saveBoard } from "./board/storage";
import type { Board, BoardFiles } from "./board/types";
import { BoardEditor } from "./components/BoardEditor";
import { FolderPage } from "./components/FolderPage";
import { Home } from "./components/Home";
import { SignIn } from "./components/SignIn";
import { takePendingPdf } from "./owner/pending";
import { useOwner, type OwnerState } from "./owner/useOwner";
import { go, parseRoute, type Route } from "./route";
import { supabase } from "./sync/client";
import { fetchBoard } from "./sync/remote";
import { framesForBoard } from "./templates/boardTemplates";

export function App() {
  const [route, setRoute] = useState<Route>(parseRoute);
  const owner = useOwner();

  useEffect(() => {
    const on = () => setRoute(parseRoute());
    window.addEventListener("hashchange", on);
    window.addEventListener("popstate", on);
    return () => {
      window.removeEventListener("hashchange", on);
      window.removeEventListener("popstate", on);
    };
  }, []);

  if (!supabase) {
    return <div className="loading">Brainstorm Board isn't connected to its database.</div>;
  }

  // Development only: a scratch board that never touches the database
  // (http://localhost:5173/#dev). Not included in the published build.
  if (import.meta.env.DEV && window.location.hash === "#dev") {
    return (
      <BoardEditor
        initialBoard={{ id: "dev-scratch", title: "Dev scratch board", updated: Date.now(), frames: framesForBoard("strategy") }}
        initialFiles={{}}
      />
    );
  }

  if (route.kind === "board") {
    return <BoardRoute key={route.id} id={route.id} folder={route.folder} owner={owner} />;
  }
  if (route.kind === "folder") {
    return <FolderPage key={route.id} id={route.id} />;
  }
  if (owner.status === "loading") return <div className="loading">Loading...</div>;
  if (owner.status !== "owner") return <SignIn owner={owner} />;
  return <Home email={owner.email} />;
}

type Loaded = { board: Board; files: BoardFiles; pdf?: File };

/** Opens a board from its link: latest from the server, or this device's copy if offline. */
function BoardRoute({ id, folder, owner }: { id: string; folder?: string; owner: OwnerState }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      let board: Board | null | undefined = null;
      let offline = false;
      try {
        board = await fetchBoard(id);
      } catch (err) {
        console.error(err);
        board = await loadBoard(id);
        offline = true;
      }
      if (!live) return;
      if (!board) {
        setProblem("This board wasn't found. The link may be incomplete, or the board was deleted.");
        return;
      }
      if (offline) alert("Couldn't reach the server, so this is the copy saved on this device.");
      await saveBoard(board);
      const files = await loadFiles(id);
      if (live) setLoaded({ board, files, pdf: takePendingPdf(id) });
    })();
    return () => {
      live = false;
    };
  }, [id]);

  if (problem) return <div className="loading">{problem}</div>;
  if (!loaded) return <div className="loading">Opening board...</div>;

  // Who gets a way back: folder visitors return to the folder, the owner to
  // the landing page, everyone else stays on the board.
  const back = folder
    ? { label: "← Folder", go: () => go({ kind: "folder", id: folder }) }
    : owner.status === "owner"
      ? { label: "← Boards", go: () => go({ kind: "home" }) }
      : undefined;

  return (
    <BoardEditor
      initialBoard={loaded.board}
      initialFiles={loaded.files}
      initialPdf={loaded.pdf}
      backLabel={back?.label}
      onExit={back?.go}
    />
  );
}
