import { useEffect, useState } from "react";

const KEY = "portlight.collapsedGroups";

function read(): Set<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return new Set(
      Array.isArray(value) ? value.filter((v) => typeof v === "string") : [],
    );
  } catch {
    return new Set();
  }
}

/** Project groups folded in the service list, remembered between launches. */
export function useCollapsed() {
  const [collapsed, setCollapsed] = useState(read);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify([...collapsed]));
    } catch {
      // Kept for this session only.
    }
  }, [collapsed]);
  function toggle(name: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(name)) next.add(name);
      return next;
    });
  }
  function setAll(names: string[], folded: boolean) {
    setCollapsed((current) => {
      const next = new Set(current);
      for (const name of names) {
        if (folded) next.add(name);
        else next.delete(name);
      }
      return next;
    });
  }
  return { collapsed, toggle, setAll };
}
