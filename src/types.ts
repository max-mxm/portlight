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
  /** Image of a container, e.g. "postgres:16-alpine". */
  image: string | null;
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
  language: "en" | "fr";
}
/** service: the listener only · group: its launcher and descendants · compose: the whole Compose project · project: every stoppable service of a project group */
export type StopScope = "service" | "group" | "compose" | "project";
export interface StopRequest {
  service: Service;
  force: boolean;
  scope: StopScope;
  /** Project scope: the group name and the services it stops. */
  group?: { name: string; members: Service[] };
}
export type ThemePreference = "system" | "light" | "dark";
export type View =
  | "all"
  | "process"
  | "docker"
  | "old"
  | "system"
  | "processes"
  | "history"
  | "settings";
export interface SystemStats {
  /** Share of the whole machine, 0–100: programs plus kernel. */
  cpuPercent: number;
  programsPercent: number;
  kernelPercent: number;
  /** Gauge minus the sum of every process: work no process accounts for. */
  unattributedPercent: number;
  cores: number;
  memoryUsed: number;
  memoryTotal: number;
  memoryPressure: "normal" | "warning" | "critical";
  swapUsed: number;
  swapTotal: number;
  processCount: number;
  ownCount: number;
  sensors: Sensors;
}
export type ThermalPressure = "nominal" | "moderate" | "heavy" | "critical";
export interface Fan {
  rpm: number;
  minRpm: number;
  maxRpm: number;
}
/** Read from the SMC and the I/O Registry; null when the Mac does not expose it. */
export interface Sensors {
  /** Average of the CPU core sensors, °C. */
  cpuCelsius: number | null;
  cpuMaxCelsius: number | null;
  gpuCelsius: number | null;
  /** From "heavy" on, macOS slows the Mac down to cool it. */
  thermalPressure: ThermalPressure | null;
  /** Empty on a Mac without fan; null when the SMC cannot tell. */
  fans: Fan[] | null;
  gpuPercent: number | null;
  /** Power drawn by the whole Mac, watts. */
  powerWatts: number | null;
  onBattery: boolean | null;
}
export interface ProcessInfo {
  id: string;
  pid: number;
  name: string;
  path: string;
  command: string;
  own: boolean;
  /** Share of one core, like top. */
  cpuPercent: number;
  memoryBytes: number;
  /** CPU measured between two samples; otherwise averaged by ps. */
  precise: boolean;
  /** Footprint as in Activity Monitor; otherwise resident memory. */
  exactMemory: boolean;
  elapsedSeconds: number;
  stoppable: boolean;
  reason: string | null;
}
export interface AppGroup {
  id: string;
  name: string;
  bundle: string;
  mainPid: number | null;
  own: boolean;
  cpuPercent: number;
  memoryBytes: number;
  precise: boolean;
  exactMemory: boolean;
  elapsedSeconds: number;
  stoppable: boolean;
  reason: string | null;
  processes: ProcessInfo[];
}
export interface ActivitySnapshot {
  system: SystemStats;
  apps: AppGroup[];
  processes: ProcessInfo[];
  sampledAt: number;
}
