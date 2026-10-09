import { useState } from "react";

import type { OwnerState } from "../owner/useOwner";
import { sendSignInLink, signOut } from "../sync/owner";

// The landing page is only for the board owner. Everyone else arrives through
// a board or folder link and never sees this.
export function SignIn({ owner }: { owner: OwnerState }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  return (
    <div className="signin">
      <div className="signin-card">
        <h1>Brainstorm Board</h1>
        {owner.status === "not-owner" ? (
          <>
            <p>
              You're signed in as <strong>{owner.email}</strong>, which doesn't have access to this
              page.
            </p>
            <p className="muted">
              If someone shared a board or folder with you, open the link they sent.
            </p>
            <button className="btn" onClick={() => void signOut()}>
              Sign out
            </button>
          </>
        ) : state === "sent" ? (
          <>
            <p>
              Check <strong>{email}</strong> for a sign-in link. It opens this page signed in.
            </p>
            <button className="btn" onClick={() => setState("idle")}>
              Use a different email
            </button>
          </>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setState("sending");
              try {
                await sendSignInLink(email.trim());
                setState("sent");
              } catch (err) {
                setError((err as Error).message);
                setState("error");
              }
            }}
          >
            <p className="muted">
              This page is for the board owner. If someone shared a board or folder with you, open
              the link they sent.
            </p>
            {owner.status === "signed-out" && owner.problem && <p className="form-error">{owner.problem}</p>}
            <label className="field-label" htmlFor="owner-email">
              Owner email
            </label>
            <input
              id="owner-email"
              className="text-input"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {state === "error" && <p className="form-error">{error}</p>}
            <div className="landing-actions" style={{ marginTop: 12 }}>
              <button className="btn btn-primary" type="submit" disabled={state === "sending"}>
                {state === "sending" ? "Sending..." : "Email me a sign-in link"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
