// App entry: wires the toolbar, grid, viewer, and keyboard together.
import { open } from "@tauri-apps/plugin-dialog";
import { state, setItems, applyOrder, shuffledOrder, type SortKey } from "./state";
import { scanFolder, loadSettings, saveSettings, revealInFinder, type Settings } from "./ipc";
import { Grid } from "./grid/grid";
import { TypeAhead } from "./grid/typeahead";
import { Viewer } from "./viewer/viewer";
import { setupKeys } from "./keys";
import { showContextMenu } from "./contextmenu";

const el = (id: string) => document.getElementById(id)!;

const scroller = el("grid-scroller");
const canvas = el("grid-canvas");
const viewerView = el("viewer-view");
const stage = el("viewer-stage");
const viewerInfo = el("viewer-info");
const folderPath = el("folder-path");
const status = el("status");
const empty = el("empty");
const typeaheadEl = el("typeahead");
const recent = el("recent") as HTMLSelectElement;

const MAX_RECENT = 12;
let settings: Settings = { lastFolder: null, recentFolders: [] };

function revealMenu(x: number, y: number, item: { path: string } | undefined): void {
  if (!item) return;
  showContextMenu(x, y, [{ label: "Reveal in Finder", action: () => void revealInFinder(item.path) }]);
}

const grid = new Grid(
  scroller,
  canvas,
  (i) => viewer.open(i),
  (x, y, i) => revealMenu(x, y, state.items[i])
);
const viewer = new Viewer(viewerView, stage, viewerInfo, () => grid.select(state.selected));
const typeahead = new TypeAhead(typeaheadEl, (i) => grid.select(i));

// Right-click in the viewer reveals the current item.
stage.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  revealMenu(e.clientX, e.clientY, state.items[state.selected]);
});

async function openFolder(): Promise<void> {
  const dir = await open({ directory: true, multiple: false });
  if (!dir || Array.isArray(dir)) return;
  await openFolderPath(dir);
}

async function openFolderPath(dir: string): Promise<void> {
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
  } catch (err) {
    status.textContent = `Error: ${err}`;
  }
}

/** Update + persist last folder and the recent-folders history. */
function rememberFolder(dir: string): void {
  settings.lastFolder = dir;
  settings.recentFolders = [dir, ...settings.recentFolders.filter((f) => f !== dir)].slice(0, MAX_RECENT);
  renderRecent();
  void saveSettings(settings);
}

function renderRecent(): void {
  recent.length = 1; // keep the "Recent…" placeholder
  for (const folder of settings.recentFolders) {
    const opt = document.createElement("option");
    opt.value = folder;
    opt.textContent = folder.replace(/\/$/, "").split("/").pop() || folder;
    opt.title = folder;
    recent.appendChild(opt);
  }
}

function reorder(): void {
  applyOrder();
  grid.refresh();
  grid.select(state.selected);
}

// --- toolbar wiring ---

el("open-folder").addEventListener("click", openFolder);

recent.addEventListener("change", () => {
  const dir = recent.value;
  recent.selectedIndex = 0; // reset to placeholder
  if (dir) void openFolderPath(dir);
});

const sortKey = el("sort-key") as HTMLSelectElement;
sortKey.addEventListener("change", () => {
  state.sortKey = sortKey.value as SortKey;
  syncToolbar();
  reorder();
});

const sortDir = el("sort-dir");
sortDir.addEventListener("click", () => {
  state.sortAsc = !state.sortAsc;
  syncToolbar();
  reorder();
});

// Shuffle starts a looping slideshow (it no longer reorders the grid).
const shuffle = el("shuffle");
shuffle.addEventListener("click", () => {
  if (state.items.length > 0) viewer.startSlideshow(shuffledOrder(state.items.length));
});

const thumbSize = el("thumb-size") as HTMLInputElement;
thumbSize.addEventListener("input", () => {
  state.thumbSize = Number(thumbSize.value);
  grid.refresh();
});

function setThumbSize(delta: number): void {
  state.thumbSize = Math.max(96, Math.min(320, state.thumbSize + delta));
  thumbSize.value = String(state.thumbSize);
  grid.refresh();
}

function syncToolbar(): void {
  sortDir.textContent = state.sortAsc ? "↑ Asc" : "↓ Desc";
}

syncToolbar();
setupKeys({ grid, viewer, typeahead, openViewer: (i) => viewer.open(i), setThumbSize });

// Restore persisted state: recent-folders menu + reopen the last folder.
async function init(): Promise<void> {
  try {
    settings = await loadSettings();
  } catch {
    settings = { lastFolder: null, recentFolders: [] };
  }
  renderRecent();
  if (settings.lastFolder) await openFolderPath(settings.lastFolder);
}

void init();
