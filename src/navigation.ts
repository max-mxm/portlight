import {
  Box,
  Clock3,
  Cpu,
  History,
  Layers3,
  Settings2,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import type { Messages } from "./i18n";
import type { View } from "./types";
export const views = [
  { id: "all", icon: Layers3 },
  { id: "process", icon: Terminal },
  { id: "docker", icon: Box },
  { id: "old", icon: Clock3 },
  { id: "system", icon: ShieldCheck },
  { id: "processes", icon: Cpu },
  { id: "history", icon: History },
  { id: "settings", icon: Settings2 },
] as const;
export function heading(view: View, reviewHours: number, t: Messages) {
  const { title, description } = t.headings[view];
  return {
    title,
    description:
      typeof description === "function"
        ? description(reviewHours)
        : description,
  };
}
