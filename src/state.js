export const state = {
    folder: null,
    items: [],
    selected: 0,
    sortKey: "name",
    sortAsc: true,
    shuffled: false,
    thumbSize: 176,
};
// The unordered scan result; `items` is always derived from this.
let source = [];
export function setItems(items) {
    source = items;
    state.selected = 0;
    applyOrder();
}
/** Rebuild `state.items` from the current sort/shuffle settings, keeping the
 *  selected item stable by path where possible. */
export function applyOrder() {
    const prevPath = state.items[state.selected]?.path;
    const arr = [...source];
    if (state.shuffled) {
        shuffleInPlace(arr);
    }
    else {
        const dir = state.sortAsc ? 1 : -1;
        arr.sort((a, b) => {
            const c = state.sortKey === "name"
                ? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
                : a.modified - b.modified;
            return c * dir;
        });
    }
    state.items = arr;
    const idx = prevPath ? arr.findIndex((i) => i.path === prevPath) : -1;
    state.selected = idx >= 0 ? idx : 0;
}
function shuffleInPlace(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
}
