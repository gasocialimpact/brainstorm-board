import { isShareId } from "./sync/ids";

// Addresses inside the app (all in the URL hash, so the static host never
// sees them):
//   (none)              the owner's landing page
//   #b=<board>          a board
//   #b=<board>&f=<id>   a board opened from a folder link (shows a way back)
//   #f=<folder>         a shared folder
export type Route =
  | { kind: "home" }
  | { kind: "board"; id: string; folder?: string }
  | { kind: "folder"; id: string };

export function parseRoute(hash = window.location.hash): Route {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const b = params.get("b");
  const f = params.get("f");
  if (b && isShareId(b)) return { kind: "board", id: b, folder: f && isShareId(f) ? f : undefined };
  if (f && isShareId(f)) return { kind: "folder", id: f };
  return hiddenBoard() ?? { kind: "home" };
}

// Participants don't see the board's link: once a board opens for someone
// other than the owner, its address is replaced by the plain app address and
// the board is remembered for this browser tab only (so refreshing still
// works). That keeps the link out of the address bar; it can't stop someone
// forwarding the link they were originally sent.
const HIDDEN_KEY = "bb-open-board";

function hiddenBoard(): Route | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(HIDDEN_KEY) ?? "null");
    if (saved && isShareId(saved.id)) return { kind: "board", id: saved.id, folder: saved.folder };
  } catch {
    // Unreadable or unavailable storage: nothing remembered.
  }
  return null;
}

export function hideBoardAddress(id: string, folder?: string) {
  try {
    sessionStorage.setItem(HIDDEN_KEY, JSON.stringify({ id, folder }));
  } catch {
    return; // Without storage a refresh couldn't find the board again; keep the link.
  }
  history.replaceState(null, "", base() + window.location.search);
}

export function routeHash(r: Route) {
  if (r.kind === "board") return `#b=${r.id}${r.folder ? `&f=${r.folder}` : ""}`;
  if (r.kind === "folder") return `#f=${r.id}`;
  return "";
}

const base = () => window.location.origin + window.location.pathname;

/** The published address, used for links people share (see .env) */
const publicBase = () => (import.meta.env.VITE_PUBLIC_URL as string | undefined) || base();

/** A link to share: the published app address plus the route */
export const linkTo = (r: Route) => publicBase() + routeHash(r);

export function go(r: Route) {
  if (r.kind !== "board") {
    try {
      sessionStorage.removeItem(HIDDEN_KEY);
    } catch {
      // ignore
    }
  }
  const h = routeHash(r);
  if (h) {
    window.location.hash = h; // fires hashchange
  } else {
    history.pushState(null, "", base() + window.location.search);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
}
