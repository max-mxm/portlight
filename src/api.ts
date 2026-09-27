import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Settings, Snapshot, StopResult, StopScope } from "./types";
export const native = isTauri();
export const scan = () => invoke<Snapshot>("scan_services");
export const stop = (id: string, force = false, scope: StopScope = "service") =>
  invoke<StopResult>("stop_service", { id, force, scope });
export const openPort = (id: string, port: number) =>
  invoke<void>("open_port", { id, port });
export const openFolder = (id: string, editor: string | null = null) =>
  invoke<string>("open_folder", { id, editor });
export const listEditors = () => invoke<string[]>("list_editors");
export const getSettings = () => invoke<Settings>("get_settings");
export const saveSettings = (settings: Settings) =>
  invoke<Settings>("save_settings", { settings });
export const getAutostart = () => invoke<boolean>("get_autostart");
export const setAutostart = (enabled: boolean) =>
  invoke<boolean>("set_autostart", { enabled });
/** Snapshots taken by the backend (menu bar refresh). */
export const onSnapshot = (handler: (snapshot: Snapshot) => void) =>
  listen<Snapshot>("portlight://snapshot", (e) => handler(e.payload));
/** "Stop…" chosen in the menu bar: the window asks for confirmation. */
export const onConfirmStop = (handler: (id: string) => void) =>
  listen<string>("portlight://confirm-stop", (e) => handler(e.payload));
