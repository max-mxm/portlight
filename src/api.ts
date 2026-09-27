import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Snapshot, StopResult } from "./types";
export const native = isTauri();
export const scan = () => invoke<Snapshot>("scan_services");
export const stop = (id: string, force = false) =>
  invoke<StopResult>("stop_service", { id, force });
export const openPort = (id: string, port: number) =>
  invoke<void>("open_port", { id, port });
