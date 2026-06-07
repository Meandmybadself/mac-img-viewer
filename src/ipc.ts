// Typed wrappers around the Rust backend commands.
import { invoke, convertFileSrc } from "@tauri-apps/api/core";

export type MediaKind = "image" | "video";

export interface MediaItem {
  path: string;
  name: string;
  kind: MediaKind;
  size: number;
  modified: number; // milliseconds since epoch
}

/** Scan a single folder (non-recursive) for supported media. */
export function scanFolder(path: string): Promise<MediaItem[]> {
  return invoke("scan_folder", { path });
}

// Memoize resolved thumbnail URLs so re-scrolling never re-invokes the backend.
const thumbUrlCache = new Map<string, string>();

/** Synchronous hit for an already-resolved thumbnail URL, if any. */
export function cachedThumbUrl(path: string, max: number): string | undefined {
  return thumbUrlCache.get(`${path}@${max}`);
}

/** Ensure a cached thumbnail exists and return an asset URL the webview can load. */
export async function getThumbnail(path: string, max: number): Promise<string> {
  const key = `${path}@${max}`;
  const cached = thumbUrlCache.get(key);
  if (cached) return cached;
  const cachePath = await invoke<string>("get_thumbnail", { path, max });
  const url = convertFileSrc(cachePath);
  thumbUrlCache.set(key, url);
  return url;
}

export interface Settings {
  lastFolder: string | null;
  recentFolders: string[];
}

export function loadSettings(): Promise<Settings> {
  return invoke("load_settings");
}

export function saveSettings(settings: Settings): Promise<void> {
  return invoke("save_settings", { settings });
}

/** Asset URL for loading an original file (image or streaming video) in the viewer. */
export function assetUrl(path: string): string {
  return convertFileSrc(path);
}
