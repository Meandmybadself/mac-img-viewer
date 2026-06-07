// Full-screen media viewer for a single image or video.
import { state } from "../state";
import { assetUrl } from "../ipc";
import { apply, setMode, zoomBy } from "./zoom";
export class Viewer {
    constructor(view, stage, info, onClose) {
        this.el = null;
        this.natW = 0;
        this.natH = 0;
        this.z = { mode: "fit", scale: 1, tx: 0, ty: 0 };
        this.loop = false;
        this.view = view;
        this.stage = stage;
        this.info = info;
        this.onClose = onClose;
        this.enablePan();
        window.addEventListener("resize", () => this.isOpen && this.reflow());
    }
    get isOpen() {
        return !this.view.classList.contains("hidden");
    }
    open(index) {
        state.selected = index;
        this.view.classList.remove("hidden");
        this.load();
    }
    close() {
        this.teardownMedia();
        this.view.classList.add("hidden");
        this.onClose();
    }
    next() {
        if (state.selected < state.items.length - 1) {
            state.selected++;
            this.load();
        }
    }
    prev() {
        if (state.selected > 0) {
            state.selected--;
            this.load();
        }
    }
    // --- media loading ---
    load() {
        this.teardownMedia();
        const item = state.items[state.selected];
        if (!item)
            return;
        if (item.kind === "video") {
            const v = document.createElement("video");
            v.className = "media";
            v.src = assetUrl(item.path);
            v.controls = true;
            v.autoplay = true;
            v.loop = this.loop;
            v.addEventListener("loadedmetadata", () => {
                this.natW = v.videoWidth;
                this.natH = v.videoHeight;
                this.reflow();
            });
            v.play().catch(() => { });
            this.el = v;
        }
        else {
            const img = document.createElement("img");
            img.className = "media";
            img.draggable = false;
            img.src = assetUrl(item.path);
            img.addEventListener("load", () => {
                this.natW = img.naturalWidth;
                this.natH = img.naturalHeight;
                this.reflow();
            });
            this.el = img;
        }
        this.stage.appendChild(this.el);
        this.updateInfo();
    }
    teardownMedia() {
        if (this.el) {
            if (this.el instanceof HTMLVideoElement) {
                this.el.pause();
                this.el.removeAttribute("src");
                this.el.load();
            }
            this.el.remove();
            this.el = null;
        }
        this.natW = this.natH = 0;
    }
    /** Recompute the active (non-free) zoom mode against the current stage size. */
    reflow() {
        if (!this.el || this.natW === 0)
            return;
        this.el.style.width = `${this.natW}px`;
        this.el.style.height = `${this.natH}px`;
        if (this.z.mode === "free")
            apply(this.el, this.z);
        else
            this.setZoom(this.z.mode);
    }
    // --- zoom / pan controls (driven by keys.ts) ---
    setZoom(mode) {
        if (!this.el)
            return;
        setMode(this.z, mode, this.natW, this.natH, this.stage.clientWidth, this.stage.clientHeight);
        apply(this.el, this.z);
        this.updateInfo();
    }
    zoom(factor) {
        if (!this.el)
            return;
        zoomBy(this.z, factor);
        apply(this.el, this.z);
        this.updateInfo();
    }
    toggleLoop() {
        this.loop = !this.loop;
        if (this.el instanceof HTMLVideoElement)
            this.el.loop = this.loop;
        this.updateInfo();
    }
    togglePlay() {
        if (this.el instanceof HTMLVideoElement) {
            if (this.el.paused)
                this.el.play().catch(() => { });
            else
                this.el.pause();
        }
    }
    enablePan() {
        let dragging = false;
        let lastX = 0;
        let lastY = 0;
        this.stage.addEventListener("pointerdown", (e) => {
            if (!this.el)
                return;
            dragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
            this.stage.setPointerCapture(e.pointerId);
        });
        this.stage.addEventListener("pointermove", (e) => {
            if (!dragging || !this.el)
                return;
            this.z.tx += e.clientX - lastX;
            this.z.ty += e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;
            apply(this.el, this.z);
        });
        const stop = () => {
            dragging = false;
        };
        this.stage.addEventListener("pointerup", stop);
        this.stage.addEventListener("pointercancel", stop);
    }
    updateInfo() {
        const item = state.items[state.selected];
        if (!item)
            return;
        const pct = Math.round(this.z.scale * 100);
        const loop = item.kind === "video" ? ` · loop ${this.loop ? "on" : "off"}` : "";
        this.info.textContent = `${item.name}  (${state.selected + 1}/${state.items.length}) · ${pct}%${loop}`;
    }
}
