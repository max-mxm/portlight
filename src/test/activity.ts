import type { ActivitySnapshot, AppGroup, ProcessInfo } from "../types";

export const proc = (patch: Partial<ProcessInfo> = {}): ProcessInfo => ({
  id: `pid:${patch.pid ?? 1}`,
  pid: 1,
  name: "node",
  path: "/opt/homebrew/bin/node",
  command: "node server.js",
  own: true,
  cpuPercent: 1,
  memoryBytes: 100,
  precise: true,
  exactMemory: true,
  elapsedSeconds: 60,
  stoppable: true,
  reason: null,
  ...patch,
});
export const app = (name: string, processes: ProcessInfo[]): AppGroup => ({
  id: `app:/Applications/${name}.app`,
  name,
  bundle: `/Applications/${name}.app`,
  mainPid: processes[0].pid,
  own: true,
  cpuPercent: processes.reduce((s, p) => s + p.cpuPercent, 0),
  memoryBytes: processes.reduce((s, p) => s + p.memoryBytes, 0),
  precise: true,
  exactMemory: true,
  elapsedSeconds: 3600,
  stoppable: true,
  reason: null,
  processes,
});
export const activity = (): ActivitySnapshot => ({
  sampledAt: 0,
  system: {
    cpuPercent: 40,
    programsPercent: 30,
    kernelPercent: 10,
    unattributedPercent: 3,
    cores: 8,
    memoryUsed: 8 * 1024 ** 3,
    memoryTotal: 16 * 1024 ** 3,
    memoryPressure: "normal",
    swapUsed: 0,
    swapTotal: 0,
    processCount: 4,
    ownCount: 3,
  },
  apps: [
    app("Chrome", [
      proc({ pid: 10, name: "Chrome", cpuPercent: 5, memoryBytes: 500 }),
      proc({
        pid: 11,
        name: "Chrome Helper",
        cpuPercent: 20,
        memoryBytes: 300,
      }),
    ]),
  ],
  processes: [
    proc({ pid: 20, cpuPercent: 40, memoryBytes: 50 }),
    proc({
      pid: 1,
      name: "launchd",
      own: false,
      stoppable: false,
      cpuPercent: 90,
      memoryBytes: 10,
    }),
  ],
});
