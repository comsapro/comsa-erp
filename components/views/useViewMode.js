"use client";

import { useEffect, useState } from "react";

const VALID = new Set(["table", "kanban", "calendar"]);

export function useViewMode(storageKey, defaultMode = "table") {
  const [mode, setModeState] = useState(defaultMode);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved && VALID.has(saved)) setModeState(saved);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, [storageKey]);

  function setMode(next) {
    if (!VALID.has(next)) return;
    setModeState(next);
    try {
      sessionStorage.setItem(storageKey, next);
    } catch {
      /* ignore */
    }
  }

  return { mode, setMode, ready };
}
