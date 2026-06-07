// App entry: wires the toolbar, grid, viewer, and keyboard together.
import { open } from "@tauri-apps/plugin-dialog";
import { state, setItems, applyOrder } from "./state";
import { scanFolder, loadSettings, saveSettings } from "./ipc";
import { Grid } from "./grid/grid";
import { TypeAhead } from "./grid/typeahead";
import { Viewer } from "./viewer/viewer";
import { setupKeys } from "./keys";
const el = (id) => document.getElementById(id);
const scroller = el("grid-scroller");
const canvas = el("grid-canvas");
const viewerView = el("viewer-view");
const stage = el("viewer-stage");
const viewerInfo = el("viewer-info");
const folderPath = el("folder-path");
const status = el("status");
const empty = el("empty");
const typeaheadEl = el("typeahead");
const recent = el("recent");
const MAX_RECENT = 12;
let settings = { lastFolder: null, recentFolders: [] };
const grid = new Grid(scroller, canvas, (i) => viewer.open(i));
const viewer = new Viewer(viewerView, stage, viewerInfo, () => grid.select(state.selected));
const typeahead = new TypeAhead(typeaheadEl, (i) => grid.select(i));
async function openFolder() {
    const dir = await open({ directory: true, multiple: false });
    if (!dir || Array.isArray(dir))
        return;
    await openFolderPath(dir);
}
async function openFolderPath(dir) {
    state.folder = dir;
    folderPath.textContent = dir;
    status.textContent = "Scanning…";
    try {
        const items = await scanFolder(dir);
        setItems(items);
        status.textContent = `${items.length} item${items.length === 1 ? "" : "s"}`;
        empty.style.display = items.length ? "none" : "";
        grid.refresh();
        rememberFolder(dir);
    }
    catch (err) {
        status.textContent = `Error: ${err}`;
    }
}
/** Update + persist last folder and the recent-folders history. */
function rememberFolder(dir) {
    settings.lastFolder = dir;
    settings.recentFolders = [dir, ...settings.recentFolders.filter((f) => f !== dir)].slice(0, MAX_RECENT);
    renderRecent();
    void saveSettings(settings);
}
function renderRecent() {
    recent.length = 1; // keep the "Recent…" placeholder
    for (const folder of settings.recentFolders) {
        const opt = document.createElement("option");
        opt.value = folder;
        opt.textContent = folder.replace(/\/$/, "").split("/").pop() || folder;
        opt.title = folder;
        recent.appendChild(opt);
    }
}
function reorder() {
    applyOrder();
    grid.refresh();
    grid.select(state.selected);
}
// --- toolbar wiring ---
el("open-folder").addEventListener("click", openFolder);
recent.addEventListener("change", () => {
    const dir = recent.value;
    recent.selectedIndex = 0; // reset to placeholder
    if (dir)
        void openFolderPath(dir);
});
const sortKey = el("sort-key");
sortKey.addEventListener("change", () => {
    state.sortKey = sortKey.value;
    state.shuffled = false;
    syncToolbar();
    reorder();
});
const sortDir = el("sort-dir");
sortDir.addEventListener("click", () => {
    state.sortAsc = !state.sortAsc;
    state.shuffled = false;
    syncToolbar();
    reorder();
});
const shuffle = el("shuffle");
shuffle.addEventListener("click", () => {
    state.shuffled = !state.shuffled;
    syncToolbar();
    reorder();
});
const thumbSize = el("thumb-size");
thumbSize.addEventListener("input", () => {
    state.thumbSize = Number(thumbSize.value);
    grid.refresh();
});
function setThumbSize(delta) {
    state.thumbSize = Math.max(96, Math.min(320, state.thumbSize + delta));
    thumbSize.value = String(state.thumbSize);
    grid.refresh();
}
function syncToolbar() {
    sortDir.textContent = state.sortAsc ? "↑ Asc" : "↓ Desc";
    shuffle.classList.toggle("active", state.shuffled);
}
syncToolbar();
setupKeys({ grid, viewer, typeahead, openViewer: (i) => viewer.open(i), setThumbSize });
// Restore persisted state: recent-folders menu + reopen the last folder.
async function init() {
    try {
        settings = await loadSettings();
    }
    catch {
        settings = { lastFolder: null, recentFolders: [] };
    }
    renderRecent();
    if (settings.lastFolder)
        await openFolderPath(settings.lastFolder);
}
void init();
