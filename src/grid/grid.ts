// A virtualized thumbnail grid: only cells inside the viewport (plus a small
// buffer) exist in the DOM, so the grid stays smooth with thousands of items.
import { state } from "../state";
import { cachedThumbUrl } from "../ipc";
import { ThumbScheduler } from "./thumbqueue";

const GAP = 12;
const PAD = 16;
const LABEL_H = 28;
const BUFFER_ROWS = 2;

export class Grid {
  private scroller: HTMLElement;
  private canvas: HTMLElement;
  private onOpen: (index: number) => void;

  private cols = 1;
  private rowH = 0;
  private cellW = 0;

  // index -> active cell element; detached cells are parked in `free`.
  private active = new Map<number, HTMLElement>();
  private free: HTMLElement[] = [];
  private frame = 0;
  private thumbs = new ThumbScheduler(Math.max(4, Math.min(8, navigator.hardwareConcurrency || 6)));

  constructor(scroller: HTMLElement, canvas: HTMLElement, onOpen: (index: number) => void) {
    this.scroller = scroller;
    this.canvas = canvas;
    this.onOpen = onOpen;

    this.scroller.addEventListener("scroll", () => this.scheduleRender(), { passive: true });
    new ResizeObserver(() => this.relayout()).observe(this.scroller);
  }

  /** Full rebuild after the item list changes (new folder, sort, shuffle). */
  refresh(): void {
    this.recycleAll();
    this.relayout();
  }

  private relayout(): void {
    this.cellW = state.thumbSize;
    const inner = this.scroller.clientWidth - PAD * 2;
    this.cols = Math.max(1, Math.floor((inner + GAP) / (this.cellW + GAP)));
    this.rowH = this.cellW + LABEL_H + GAP;
    const rows = Math.ceil(state.items.length / this.cols);
    this.canvas.style.height = `${PAD * 2 + rows * this.rowH}px`;
    this.render();
  }

  private scheduleRender(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.render();
    });
  }

  private render(): void {
    const top = this.scroller.scrollTop;
    const viewH = this.scroller.clientHeight;
    const firstRow = Math.max(0, Math.floor((top - PAD) / this.rowH) - BUFFER_ROWS);
    const lastRow = Math.floor((top + viewH - PAD) / this.rowH) + BUFFER_ROWS;

    const start = firstRow * this.cols;
    const end = Math.min(state.items.length, (lastRow + 1) * this.cols);

    // Retire cells that scrolled out of range, cancelling their pending thumbs.
    for (const [index, el] of this.active) {
      if (index < start || index >= end) {
        this.active.delete(index);
        if (el.dataset.path) this.thumbs.cancel(el.dataset.path);
        el.style.display = "none";
        this.free.push(el);
      }
    }

    // Ensure a cell exists for every visible index.
    for (let i = start; i < end; i++) {
      let el = this.active.get(i);
      if (!el) {
        el = this.free.pop() ?? this.createCell();
        el.style.display = "";
        this.active.set(i, el);
        this.fill(el, i);
      }
      this.position(el, i);
      el.classList.toggle("selected", i === state.selected);
    }
  }

  private createCell(): HTMLElement {
    const el = document.createElement("div");
    el.className = "cell";
    el.innerHTML =
      '<div class="thumb"><img alt="" draggable="false"/><span class="badge">▶</span></div><div class="name"></div>';
    el.addEventListener("click", () => {
      const idx = Number(el.dataset.index);
      state.selected = idx;
      this.render();
    });
    el.addEventListener("dblclick", () => this.onOpen(Number(el.dataset.index)));
    this.canvas.appendChild(el);
    return el;
  }

  /** Bind a cell to an item: label, kind badge, and async thumbnail. */
  private fill(el: HTMLElement, index: number): void {
    const item = state.items[index];
    el.dataset.index = String(index);
    el.dataset.path = item.path;
    (el.querySelector(".name") as HTMLElement).textContent = item.name;
    el.classList.toggle("is-video", item.kind === "video");

    const img = el.querySelector("img") as HTMLImageElement;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const max = Math.round(this.cellW * dpr);

    // Already-generated thumbnails resolve instantly; only queue real work.
    const cached = cachedThumbUrl(item.path, max);
    if (cached) {
      img.src = cached;
      img.classList.remove("loading");
      return;
    }
    img.removeAttribute("src");
    img.classList.add("loading");
    this.thumbs.request(item.path, item.path, max, (url) => {
      // Guard against recycling: only apply if the cell still shows this item.
      if (el.dataset.path === item.path) {
        img.src = url;
        img.classList.remove("loading");
      }
    });
  }

  private position(el: HTMLElement, index: number): void {
    const col = index % this.cols;
    const row = Math.floor(index / this.cols);
    const x = PAD + col * (this.cellW + GAP);
    const y = PAD + row * this.rowH;
    el.style.transform = `translate(${x}px, ${y}px)`;
    el.style.width = `${this.cellW}px`;
    (el.querySelector(".thumb") as HTMLElement).style.height = `${this.cellW}px`;
    if (Number(el.dataset.index) !== index) this.fill(el, index);
  }

  private recycleAll(): void {
    for (const [, el] of this.active) {
      if (el.dataset.path) this.thumbs.cancel(el.dataset.path);
      el.style.display = "none";
      this.free.push(el);
    }
    this.active.clear();
  }

  /** Move selection and keep it on-screen. */
  select(index: number): void {
    const n = state.items.length;
    if (n === 0) return;
    state.selected = Math.max(0, Math.min(n - 1, index));
    this.ensureVisible(state.selected);
    this.render();
  }

  get columns(): number {
    return this.cols;
  }

  private ensureVisible(index: number): void {
    const row = Math.floor(index / this.cols);
    const y = PAD + row * this.rowH;
    const top = this.scroller.scrollTop;
    const viewH = this.scroller.clientHeight;
    if (y < top) this.scroller.scrollTop = y - PAD;
    else if (y + this.rowH > top + viewH) this.scroller.scrollTop = y + this.rowH - viewH + PAD;
  }
}
