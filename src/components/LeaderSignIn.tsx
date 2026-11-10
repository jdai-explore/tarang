"use client";

import { authClient } from "@/lib/auth-client";
import { useState } from "react";

export default function LeaderSignIn() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function signIn() {
    setBusy(true);
    setError("");
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: "/leader/" });
      if (result.error) setError(result.error.message ?? "Google sign-in failed. Please try again.");
    } catch { setError("Google sign-in failed. Please try again."); }
    finally { setBusy(false); }
  }
  return <><button type="button" disabled={busy} onClick={() => void signIn()}>
    {busy ? "Opening Google…" : "Sign in with Google"}
  </button>{error && <p role="alert" className="live-error">{error}</p>}</>;
}

export function LeaderSignOut() {
  return <button type="button" onClick={() => void authClient.signOut().then(() => location.reload())}>Sign out</button>;
}
