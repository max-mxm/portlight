import { useEffect, useRef } from "react";

interface Shortcuts {
  palette: () => void;
  refresh: () => void;
  search: () => void;
}

/** ⌘K quick actions, ⌘R refresh, ⌘F search. */
export function useShortcuts(shortcuts: Shortcuts) {
  const current = useRef(shortcuts);
  current.current = shortcuts;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const action = ({ k: "palette", r: "refresh", f: "search" } as const)[
        e.key.toLowerCase()
      ];
      if (!action) return;
      e.preventDefault();
      current.current[action]();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
