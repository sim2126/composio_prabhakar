import { useState } from "react";

// The Clipboard API needs a secure context and permission; fall back to a hidden textarea.
function legacyCopy(text: string) {
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  el.remove();
  return ok;
}

export function useCopy() {
  const [state, setState] = useState<{ key: string; ok: boolean } | null>(null);
  async function copy(key: string, text: string) {
    let ok = true;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      ok = legacyCopy(text);
    }
    setState({ key, ok });
    window.setTimeout(() => setState((s) => (s?.key === key ? null : s)), 1800);
  }
  const label = (key: string, idle: string, done = "Copied") => (state?.key === key ? (state.ok ? done : "Copy failed") : idle);
  return { copy, label };
}
