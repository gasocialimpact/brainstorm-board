import { useEffect, useState } from "react";

import { getSession, isAdmin, onAuthChange } from "../sync/owner";

export type OwnerState =
  | { status: "loading" }
  | { status: "signed-out"; problem?: string }
  | { status: "not-owner"; email: string }
  | { status: "owner"; email: string };

/**
 * A sign-in link that couldn't be completed here leaves ?code= or ?error= in
 * the address (for example when it's opened in a different browser from the
 * one that asked for it). Explain that once, and tidy the address.
 */
function takeSignInProblem(): string | undefined {
  const q = new URLSearchParams(window.location.search);
  const failed = q.has("code") || q.has("error") || q.has("error_description");
  if (!failed) return undefined;
  history.replaceState(null, "", window.location.pathname + window.location.hash);
  return (
    q.get("error_description") ??
    "That sign-in link couldn't be completed here. Links only work in the browser that asked for them and expire after an hour. Request a new one below."
  );
}

/** Whether the person using the app is signed in as the board owner. */
export function useOwner(): OwnerState {
  const [state, setState] = useState<OwnerState>({ status: "loading" });
  useEffect(() => {
    let live = true;
    const check = async () => {
      const session = await getSession();
      if (!session) return live && setState({ status: "signed-out", problem: takeSignInProblem() });
      const email = session.user.email ?? "";
      let owner = false;
      try {
        owner = await isAdmin();
      } catch (err) {
        console.error(err);
      }
      if (live) setState(owner ? { status: "owner", email } : { status: "not-owner", email });
    };
    void check();
    const off = onAuthChange(() => void check());
    return () => {
      live = false;
      off();
    };
  }, []);
  return state;
}
