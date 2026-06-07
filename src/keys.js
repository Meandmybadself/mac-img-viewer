// Central keyboard dispatch. In grid mode plain typing drives Finder-style
// type-ahead; in viewer mode keys drive zoom/loop/navigation.
import { state } from "./state";
export function setupKeys(a) {
    window.addEventListener("keydown", (e) => {
        if (a.viewer.isOpen)
            viewerKeys(e, a);
        else
            gridKeys(e, a);
    });
}
function viewerKeys(e, a) {
    switch (e.key) {
        case "Escape":
            a.viewer.close();
            break;
        case "ArrowRight":
            a.viewer.next();
            break;
        case "ArrowLeft":
            a.viewer.prev();
            break;
        case "+":
        case "=":
            a.viewer.zoom(1.25);
            break;
        case "-":
        case "_":
            a.viewer.zoom(0.8);
            break;
        case "0":
            a.viewer.setZoom("fit");
            break;
        case "9":
            a.viewer.setZoom("fill");
            break;
        case "1":
            a.viewer.setZoom("actual");
            break;
        case "l":
        case "L":
            a.viewer.toggleLoop();
            break;
        case " ":
            a.viewer.toggleAutoAdvance();
            break;
        default: return;
    }
    e.preventDefault();
}
function gridKeys(e, a) {
    const cmd = e.metaKey || e.ctrlKey;
    if (cmd && (e.key === "=" || e.key === "+")) {
        a.setThumbSize(16);
        e.preventDefault();
        return;
    }
    if (cmd && (e.key === "-" || e.key === "_")) {
        a.setThumbSize(-16);
        e.preventDefault();
        return;
    }
    if (cmd || e.altKey)
        return; // leave other system shortcuts alone
    const cols = a.grid.columns;
    const sel = state.selected;
    switch (e.key) {
        case "ArrowRight":
            a.grid.select(sel + 1);
            break;
        case "ArrowLeft":
            a.grid.select(sel - 1);
            break;
        case "ArrowDown":
            a.grid.select(sel + cols);
            break;
        case "ArrowUp":
            a.grid.select(sel - cols);
            break;
        case "Home":
            a.grid.select(0);
            break;
        case "End":
            a.grid.select(state.items.length - 1);
            break;
        case "Enter":
            a.openViewer(sel);
            break;
        case " ":
            a.openViewer(sel);
            break; // Finder-style Quick Look
        default:
            // Single printable character → Finder-style type-ahead.
            if (e.key.length === 1 && state.items.length > 0) {
                a.typeahead.push(e.key);
                e.preventDefault();
            }
            return;
    }
    e.preventDefault();
}
