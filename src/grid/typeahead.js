// Finder-style type-to-search: accumulate keystrokes into a buffer that resets
// after a short pause, and jump selection to the first matching filename.
import { state } from "../state";
const RESET_MS = 900;
export class TypeAhead {
    constructor(overlay, onJump) {
        this.buffer = "";
        this.timer = 0;
        this.overlay = overlay;
        this.onJump = onJump;
    }
    /** Feed a printable character. Returns true if it was consumed. */
    push(ch) {
        this.buffer += ch.toLowerCase();
        this.show();
        this.restartTimer();
        const idx = this.match();
        if (idx >= 0)
            this.onJump(idx);
        return true;
    }
    match() {
        const items = state.items;
        const startsWith = items.findIndex((i) => i.name.toLowerCase().startsWith(this.buffer));
        if (startsWith >= 0)
            return startsWith;
        return items.findIndex((i) => i.name.toLowerCase().includes(this.buffer));
    }
    show() {
        this.overlay.textContent = this.buffer;
        this.overlay.classList.remove("hidden");
    }
    restartTimer() {
        clearTimeout(this.timer);
        this.timer = window.setTimeout(() => {
            this.buffer = "";
            this.overlay.classList.add("hidden");
        }, RESET_MS);
    }
}
