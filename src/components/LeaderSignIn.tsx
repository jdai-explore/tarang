"use client";

import { authClient } from "@/lib/auth-client";

export default function LeaderSignIn() {
  return <button type="button" onClick={() => void authClient.signIn.social({ provider: "google", callbackURL: "/leader/" })}>
    Sign in with Google
  </button>;
}
