import { useState } from "react";

import type { OwnerState } from "../owner/useOwner";
import { Brand } from "./Brand";
import { sendSignInLink, signInWithPassword, signOut } from "../sync/owner";

// The landing page is only for the board owner. Everyone else arrives through
// a board or folder link and never sees this. Password sign-in is the usual
// way in; the emailed link is a fallback (Supabase limits how many sign-in
// emails it sends per hour).
export function SignIn({ owner }: { owner: OwnerState }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "working" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const run = async (fn: () => Promise<void>, after: typeof state = "idle") => {
    setState("working");
    try {
      await fn();
      setState(after);
    } catch (err) {
      setError(friendly((err as Error).message));
      setState("error");
    }
  };

  if (owner.status === "not-owner") {
    return (
      <Shell>
        <p>
          You're signed in as <strong>{owner.email}</strong>, which doesn't have access to this page.
        </p>
        <p className="muted">If someone shared a board or folder with you, open the link they sent.</p>
        <button className="btn" onClick={() => void signOut()}>
          Sign out
        </button>
      </Shell>
    );
  }

  if (state === "sent") {
    return (
      <Shell>
        <p>
          Check <strong>{email}</strong> for a sign-in link. Open it in this browser and it brings
          you back here, signed in.
        </p>
        <button className="btn" onClick={() => setState("idle")}>
          Back
        </button>
      </Shell>
    );
  }

  return (
    <Shell>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => signInWithPassword(email.trim(), password));
        }}
      >
        <p className="muted">
          This page is for the board owner. If someone shared a board or folder with you, open the
          link they sent.
        </p>
        {owner.status === "signed-out" && owner.problem && <p className="form-error">{owner.problem}</p>}
        <label className="field-label" htmlFor="owner-email">
          Email
        </label>
        <input
          id="owner-email"
          className="text-input"
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label className="field-label" htmlFor="owner-password">
          Password
        </label>
        <input
          id="owner-password"
          className="text-input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {state === "error" && <p className="form-error">{error}</p>}
        <div className="landing-actions" style={{ marginTop: 14 }}>
          <button className="btn btn-primary" type="submit" disabled={state === "working" || !password}>
            {state === "working" ? "Signing in..." : "Sign in"}
          </button>
          <button
            className="btn"
            type="button"
            disabled={state === "working" || !email.trim()}
            onClick={() => void run(() => sendSignInLink(email.trim()), "sent")}
          >
            Email me a sign-in link instead
          </button>
        </div>
        <p className="muted small" style={{ marginTop: 14 }}>
          No password yet? Use the emailed link once, then choose <strong>Set password</strong> on
          your boards page.
        </p>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="signin">
      <div className="signin-card">
        <Brand />
        {children}
      </div>
    </div>
  );
}

/** Supabase's messages, in plainer words where it helps */
function friendly(message: string) {
  if (/rate limit/i.test(message)) {
    return "Too many sign-in emails were sent recently. Sign in with your password, or try the emailed link again in about an hour.";
  }
  if (/invalid login credentials/i.test(message)) {
    return "That email and password don't match. If you haven't set a password yet, use the emailed link once and set one from your boards page.";
  }
  return message;
}
