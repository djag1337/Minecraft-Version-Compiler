"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("themechange", callback);
  return () => window.removeEventListener("themechange", callback);
}

function getSnapshot(): boolean {
  return document.documentElement.classList.contains("dark");
}

// Matches the "dark" class layout.tsx renders server-side by default, so the
// client's first hydration pass never mismatches the server-rendered HTML —
// useSyncExternalStore reconciles against the live DOM right after.
function getServerSnapshot(): boolean {
  return true;
}

export function useIsDarkMode(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
