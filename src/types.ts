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
export type View = "all" | "process" | "docker" | "old" | "system" | "history";
