// Typed wrappers around the Rust backend commands.
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
/** Scan a single folder (non-recursive) for supported media. */
export function scanFolder(path) {
    return invoke("scan_folder", { path });
}
// Memoize resolved thumbnail URLs so re-scrolling never re-invokes the backend.
const thumbUrlCache = new Map();
/** Synchronous hit for an already-resolved thumbnail URL, if any. */
export function cachedThumbUrl(path, max) {
    return thumbUrlCache.get(`${path}@${max}`);
}
/** Ensure a cached thumbnail exists and return an asset URL the webview can load. */
export async function getThumbnail(path, max) {
    const key = `${path}@${max}`;
    const cached = thumbUrlCache.get(key);
    if (cached)
        return cached;
    const cachePath = await invoke("get_thumbnail", { path, max });
    const url = convertFileSrc(cachePath);
    thumbUrlCache.set(key, url);
    return url;
}
/** Reveal a file in Finder. */
export function revealInFinder(path) {
    return invoke("reveal_in_finder", { path });
}
export function loadSettings() {
    return invoke("load_settings");
}
export function saveSettings(settings) {
    return invoke("save_settings", { settings });
}
/** Asset URL for loading an original file (image or streaming video) in the viewer. */
export function assetUrl(path) {
    return convertFileSrc(path);
}
