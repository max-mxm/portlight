export interface ProcessSummary {
  pid: number;
  name: string;
  command: string;
  ports: number[];
}
export interface Service {
  id: string;
  pid: number;
  name: string;
  project: string;
  kind: "process" | "docker" | "tool" | "system";
  ports: number[];
  addresses: string[];
  exposed: boolean;
  command: string;
  cwd: string;
  elapsedSeconds: number;
  stoppable: boolean;
  reason: string | null;
  stopCommand: string;
  cpuPercent: number | null;
  memoryBytes: number | null;
  parents: ProcessSummary[];
  launchGroup: ProcessSummary[];
  composeProject: string | null;
  composeContainers: string[];
}
export interface Snapshot {
  services: Service[];
  scannedAt: number;
  warnings: string[];
  dockerAvailable: boolean;
}
export interface StopResult {
  stopped: boolean;
  message: string;
  remainingPorts: number[];
}
export interface Activity {
  id: string;
  name: string;
  ports: number[];
  at: number;
  message: string;
  success: boolean;
}
export interface Settings {
  reviewHours: number;
  projectRoots: string[];
  devBinaries: string[];
  editor: string | null;
}
/** service: the listener only · group: its launcher and descendants · compose: the whole Compose project */
export type StopScope = "service" | "group" | "compose";
export interface StopRequest {
  service: Service;
  force: boolean;
  scope: StopScope;
}
export type ThemePreference = "system" | "light" | "dark";
export type View =
  "all" | "process" | "docker" | "old" | "system" | "history" | "settings";
