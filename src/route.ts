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
  return { kind: "home" };
}

export function routeHash(r: Route) {
  if (r.kind === "board") return `#b=${r.id}${r.folder ? `&f=${r.folder}` : ""}`;
  if (r.kind === "folder") return `#f=${r.id}`;
  return "";
}

const base = () => window.location.origin + window.location.pathname;

/** A link to share: the app address plus the route */
export const linkTo = (r: Route) => base() + routeHash(r);

export function go(r: Route) {
  const h = routeHash(r);
  if (h) {
    window.location.hash = h; // fires hashchange
  } else {
    history.pushState(null, "", base() + window.location.search);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
}
