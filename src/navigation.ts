import {
  Box,
  Clock3,
  History,
  Layers3,
  Settings2,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import type { View } from "./types";
export const views = [
  { id: "all", name: "Vue d’ensemble", icon: Layers3 },
  { id: "process", name: "Serveurs", icon: Terminal },
  { id: "docker", name: "Docker", icon: Box },
  { id: "old", name: "À vérifier", icon: Clock3 },
  { id: "system", name: "Système & outils", icon: ShieldCheck },
  { id: "history", name: "Historique", icon: History },
  { id: "settings", name: "Réglages", icon: Settings2 },
] as const;
const titles: Record<View, { title: string; description: string }> = {
  all: {
    title: "Vos ports, sous contrôle.",
    description:
      "Retrouvez vos services locaux et libérez les ports dont vous n’avez plus besoin.",
  },
  process: {
    title: "Vos serveurs de développement",
    description:
      "Les applications qui tournent encore, même après la fermeture du terminal.",
  },
  docker: {
    title: "Vos conteneurs, au même endroit",
    description:
      "Arrêtez le conteneur concerné directement, sans interrompre le moteur Docker.",
  },
  old: {
    title: "Encore utiles, ces serveurs ?",
    description:
      "Ces processus tournent depuis plus de {hours} heures. Prenez un instant pour les vérifier.",
  },
  system: {
    title: "Le Mac et ses outils",
    description:
      "Ces services sont protégés. Fermez leur application pour les arrêter.",
  },
  history: {
    title: "Les dernières actions",
    description:
      "Votre historique d’arrêt reste sur ce Mac. Aucun compte, aucune synchronisation.",
  },
  settings: {
    title: "Portlight, à votre façon",
    description:
      "Vos réglages restent sur ce Mac. Les protections du moteur Docker et de macOS ne changent pas.",
  },
};
export function heading(view: View, reviewHours: number) {
  const { title, description } = titles[view];
  return {
    title,
    description: description.replace("{hours}", `${reviewHours}`),
  };
}
