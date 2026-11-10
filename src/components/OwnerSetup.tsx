"use client";

import { useState } from "react";

export default function OwnerSetup() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function setup() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/bootstrap/", { method: "POST" });
      const data = await response.json();
      setMessage(response.ok ? `Private library ready: ${data.songs} songs.` : data.error ?? "Setup failed.");
    } catch { setMessage("Setup failed. Check the connection."); }
    finally { setBusy(false); }
  }
  return <section><button type="button" disabled={busy} onClick={() => void setup()}>
    {busy ? "Preparing…" : "Prepare private library"}
  </button><p role="status">{message}</p></section>;
}
