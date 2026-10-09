import type { Session } from "@supabase/supabase-js";

import { BUCKET, supabase } from "./client";

// Owner sign-in and the owner-only functions in supabase/002_owner_and_folders.sql.

export type FolderRow = { id: string; name: string; updated_at: string };
export type BoardRow = {
  id: string;
  title: string;
  folder_id: string | null;
  updated_at: string;
  thumbnail: string | null;
  frames: number;
};

const db = () => {
  if (!supabase) throw new Error("Sharing isn't set up.");
  return supabase;
};

async function rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

// ---------- Sign-in ----------

/** Email a one-time sign-in link that returns to this page. */
export async function sendSignInLink(email: string) {
  const redirect = window.location.origin + window.location.pathname;
  const { error } = await db().auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
  if (error) throw new Error(error.message);
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export const onAuthChange = (cb: (s: Session | null) => void) => {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_e, s) => cb(s));
  return () => data.subscription.unsubscribe();
};

export const signOut = () => db().auth.signOut();

export const isAdmin = () => rpc<boolean>("bb_is_admin");

// ---------- Boards and folders ----------

export const adminList = () => rpc<{ folders: FolderRow[]; boards: BoardRow[] }>("bb_admin_list");

export const moveBoard = (id: string, folderId: string | null) =>
  rpc("bb_move_board", { p_id: id, p_folder: folderId });

export const saveFolder = (id: string, name: string) => rpc("bb_save_folder", { p_id: id, p_name: name });

export const deleteFolder = (id: string) => rpc("bb_delete_folder", { p_id: id });

/** Delete a board and its images. */
export async function deleteBoardEverywhere(id: string) {
  await rpc("bb_delete_board", { p_id: id });
  const store = db().storage.from(BUCKET);
  const { data } = await store.list(id, { limit: 1000 });
  if (data?.length) await store.remove(data.map((f) => `${id}/${f.name}`));
}

// ---------- Folder links ----------

export type SharedFolder = {
  id: string;
  name: string;
  boards: { id: string; title: string; updated_at: string; thumbnail: string | null }[];
};

export const getFolder = (id: string) => rpc<SharedFolder | null>("bb_get_folder", { p_id: id });
