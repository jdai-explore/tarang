"use client";

import { useEffect, useState } from "react";

export default function Preferences({ showSize = false }: { showSize?: boolean }) {
  const [theme, setTheme] = useState("light");
  const [size, setSize] = useState("normal");
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme || "light");
    setSize(document.documentElement.dataset.size || "normal");
  }, []);
  function changeTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("tarang-theme", next); } catch {}
  }
  function changeSize() {
    const next = size === "normal" ? "large" : "normal";
    setSize(next);
    document.documentElement.dataset.size = next;
    try { localStorage.setItem("tarang-size", next); } catch {}
  }
  return <div className="preferences">
    {showSize && <button type="button" onClick={changeSize} aria-label={size === "normal" ? "Increase lyric text size" : "Reset lyric text size"} title="Text size">{size === "normal" ? "A+" : "A−"}</button>}
    <button type="button" onClick={changeTheme} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`} title="Appearance">{theme === "light" ? "☾" : "☀"}<span className="mode-label"> {theme === "light" ? "Dark" : "Light"}</span></button>
  </div>;
}
