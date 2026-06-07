// Central application state plus the sort/shuffle ordering logic.
import type { MediaItem } from "./ipc";

export type SortKey = "name" | "modified";

export interface AppState {
  folder: string | null;
  items: MediaItem[]; // current display order (always sorted)
  selected: number; // index into `items`
  sortKey: SortKey;
  sortAsc: boolean;
  thumbSize: number;
}

export const state: AppState = {
  folder: null,
  items: [],
  selected: 0,
  sortKey: "name",
  sortAsc: true,
  thumbSize: 176,
};

// The unordered scan result; `items` is always derived from this.
let source: MediaItem[] = [];

export function setItems(items: MediaItem[]): void {
  source = items;
  state.selected = 0;
  applyOrder();
}

/** Rebuild `state.items` from the current sort settings, keeping the selected
 *  item stable by path where possible. */
export function applyOrder(): void {
  const prevPath = state.items[state.selected]?.path;
  const arr = [...source];
  const dir = state.sortAsc ? 1 : -1;
  arr.sort((a, b) => {
    const c =
      state.sortKey === "name"
        ? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
        : a.modified - b.modified;
    return c * dir;
  });

  state.items = arr;
  const idx = prevPath ? arr.findIndex((i) => i.path === prevPath) : -1;
  state.selected = idx >= 0 ? idx : 0;
}

/** A shuffled permutation of item indices, for the slideshow. */
export function shuffledOrder(n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
