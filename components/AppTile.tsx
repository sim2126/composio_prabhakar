"use client";

import { useState } from "react";

// Logo when the CDN has one, otherwise the app's initial.
export function AppTile({ name, logo, large }: { name: string; logo?: string | null; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`mono-tile${large ? " mono-tile-lg" : ""}`} aria-hidden="true">
      {logo && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" loading={large ? "eager" : "lazy"} referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        name.trim().charAt(0).toUpperCase()
      )}
    </span>
  );
}
