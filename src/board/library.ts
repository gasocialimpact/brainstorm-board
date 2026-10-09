import type { LibraryPersistenceAdapter } from "@excalidraw/excalidraw/data/library";
import { createStore, get, set } from "idb-keyval";

// Excalidraw's library (the Library panel). It starts with the GSIC bundles in
// public/libraries; after that it's saved in this browser, including items
// people add or remove themselves.

const BUNDLES = ["presentation-bundle", "make-your-calendar"];
const KEY = "excalidraw-library";
const db = createStore("brainstorm-board-library", "kv");

async function loadBundles() {
  const lists = await Promise.all(
    BUNDLES.map(async (name) => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}libraries/${name}.excalidrawlib`);
        const data = await res.json();
        return data.libraryItems ?? data.library ?? [];
      } catch (err) {
        console.error(`Library ${name} didn't load`, err);
        return [];
      }
    }),
  );
  return lists.flat();
}

export const libraryAdapter: LibraryPersistenceAdapter = {
  async load() {
    const saved = await get(KEY, db).catch(() => undefined);
    if (saved) return saved;
    return { libraryItems: await loadBundles() };
  },
  async save(data) {
    await set(KEY, data, db);
  },
};
