"use client";

import { usePathname } from "next/navigation";

// Hidden on the library, where the page fits the window and only the table scrolls.
export function Footer() {
  if (usePathname() === "/") return null;
  return (
    <footer className="foot">
      <span>Every guide cites its sources. Agent-generated guides are labelled as such and are not human-reviewed.</span>
      <span>A concept for agent builders using Composio. Not affiliated with any provider.</span>
    </footer>
  );
}
