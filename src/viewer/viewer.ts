// Full-screen media viewer for a single image or video.
import { state } from "../state";
import { assetUrl } from "../ipc";
import { apply, setMode, zoomBy, type ZoomState } from "./zoom";

const SLIDESHOW_MS = 10_000;

export class Viewer {
  private view: HTMLElement;
  private stage: HTMLElement;
  private info: HTMLElement;
  private onClose: () => void;

  private el: HTMLImageElement | HTMLVideoElement | null = null;
  private natW = 0;
  private natH = 0;
  private z: ZoomState = { mode: "fit", scale: 1, tx: 0, ty: 0 };
  private loop = false;

  // Navigation playlist: `order` holds indices into state.items; `pos` is the
  // position within it. Sequential viewing uses the natural order; a shuffle
  // slideshow uses a shuffled order and auto-advances on a timer.
  private order: number[] = [];
  private pos = 0;
  private slideshow = false;
  private paused = false;
  private timer = 0;

  constructor(view: HTMLElement, stage: HTMLElement, info: HTMLElement, onClose: () => void) {
    this.view = view;
    this.stage = stage;
    this.info = info;
    this.onClose = onClose;
    this.enablePan();
    window.addEventListener("resize", () => this.isOpen && this.reflow());
  }

  get isOpen(): boolean {
    return !this.view.classList.contains("hidden");
  }

  /** Open a single item for normal (sequential) viewing. */
  open(index: number): void {
    this.slideshow = false;
    this.stopTimer();
    this.order = state.items.map((_, i) => i);
    this.pos = index;
    this.view.classList.remove("hidden");
    this.sync();
  }

  /** Start a looping shuffle slideshow over `order` (indices into state.items). */
  startSlideshow(order: number[]): void {
    if (order.length === 0) return;
    this.slideshow = true;
    this.paused = false;
    this.order = order;
    this.pos = 0;
    this.view.classList.remove("hidden");
    this.sync();
    this.restartTimer();
  }

  close(): void {
    this.stopTimer();
    this.slideshow = false;
    this.teardownMedia();
    this.view.classList.add("hidden");
    this.onClose();
  }

  next(): void {
    this.step(1);
  }

  prev(): void {
    this.step(-1);
  }

  private step(delta: number): void {
    const n = this.order.length;
    if (n === 0) return;
    const at = this.pos + delta;
    if (at < 0 || at >= n) {
      if (!this.slideshow) return; // clamp when not looping
      this.pos = (at + n) % n; // wrap during the slideshow
    } else {
      this.pos = at;
    }
    this.sync();
    if (this.slideshow && !this.paused) this.restartTimer();
  }

  /** Point state.selected at the current playlist position and load it. */
  private sync(): void {
    state.selected = this.order[this.pos];
    this.load();
  }

  /** Pause/resume slideshow auto-advance (no-op outside a slideshow). */
  toggleAutoAdvance(): void {
    if (!this.slideshow) return;
    this.paused = !this.paused;
    if (this.paused) this.stopTimer();
    else this.restartTimer();
    this.updateInfo();
  }

  private restartTimer(): void {
    this.stopTimer();
    this.timer = window.setTimeout(() => this.step(1), SLIDESHOW_MS);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = 0;
    }
  }

  // --- media loading ---

  private load(): void {
    this.teardownMedia();
    const item = state.items[state.selected];
    if (!item) return;

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
      v.play().catch(() => {});
      this.el = v;
    } else {
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

  private teardownMedia(): void {
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
  private reflow(): void {
    if (!this.el || this.natW === 0) return;
    this.el.style.width = `${this.natW}px`;
    this.el.style.height = `${this.natH}px`;
    if (this.z.mode === "free") apply(this.el, this.z);
    else this.setZoom(this.z.mode);
  }

  // --- zoom / pan controls (driven by keys.ts) ---

  setZoom(mode: "fit" | "fill" | "actual"): void {
    if (!this.el) return;
    setMode(this.z, mode, this.natW, this.natH, this.stage.clientWidth, this.stage.clientHeight);
    apply(this.el, this.z);
    this.updateInfo();
  }

  zoom(factor: number): void {
    if (!this.el) return;
    zoomBy(this.z, factor);
    apply(this.el, this.z);
    this.updateInfo();
  }

  toggleLoop(): void {
    this.loop = !this.loop;
    if (this.el instanceof HTMLVideoElement) this.el.loop = this.loop;
    this.updateInfo();
  }

  private enablePan(): void {
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    this.stage.addEventListener("pointerdown", (e) => {
      if (!this.el) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      this.stage.setPointerCapture(e.pointerId);
    });
    this.stage.addEventListener("pointermove", (e) => {
      if (!dragging || !this.el) return;
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

  private updateInfo(): void {
    const item = state.items[state.selected];
    if (!item) return;
    const pct = Math.round(this.z.scale * 100);
    const loop = item.kind === "video" ? ` · loop ${this.loop ? "on" : "off"}` : "";
    const show = this.slideshow ? ` · slideshow${this.paused ? " (paused)" : ""}` : "";
    this.info.textContent = `${item.name}  (${this.pos + 1}/${this.order.length}) · ${pct}%${loop}${show}`;
  }
}
