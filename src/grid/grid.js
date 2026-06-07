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
    constructor(scroller, canvas, onOpen, onContext) {
        this.cols = 1;
        this.rowH = 0;
        this.cellW = 0;
        // index -> active cell element; detached cells are parked in `free`.
        this.active = new Map();
        this.free = [];
        this.frame = 0;
        this.thumbs = new ThumbScheduler(Math.max(4, Math.min(8, navigator.hardwareConcurrency || 6)));
        this.scroller = scroller;
        this.canvas = canvas;
        this.onOpen = onOpen;
        this.onContext = onContext;
        this.scroller.addEventListener("scroll", () => this.scheduleRender(), { passive: true });
        new ResizeObserver(() => this.relayout()).observe(this.scroller);
    }
    /** Full rebuild after the item list changes (new folder, sort, shuffle). */
    refresh() {
        this.recycleAll();
        this.relayout();
    }
    relayout() {
        this.cellW = state.thumbSize;
        const inner = this.scroller.clientWidth - PAD * 2;
        this.cols = Math.max(1, Math.floor((inner + GAP) / (this.cellW + GAP)));
        this.rowH = this.cellW + LABEL_H + GAP;
        const rows = Math.ceil(state.items.length / this.cols);
        this.canvas.style.height = `${PAD * 2 + rows * this.rowH}px`;
        this.render();
    }
    scheduleRender() {
        if (this.frame)
            return;
        this.frame = requestAnimationFrame(() => {
            this.frame = 0;
            this.render();
        });
    }
    render() {
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
                if (el.dataset.path)
                    this.thumbs.cancel(el.dataset.path);
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
    createCell() {
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
        el.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            const idx = Number(el.dataset.index);
            state.selected = idx;
            this.render();
            this.onContext(e.clientX, e.clientY, idx);
        });
        this.canvas.appendChild(el);
        return el;
    }
    /** Bind a cell to an item: label, kind badge, and async thumbnail. */
    fill(el, index) {
        const item = state.items[index];
        el.dataset.index = String(index);
        el.dataset.path = item.path;
        el.querySelector(".name").textContent = item.name;
        el.classList.toggle("is-video", item.kind === "video");
        const img = el.querySelector("img");
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
    position(el, index) {
        const col = index % this.cols;
        const row = Math.floor(index / this.cols);
        const x = PAD + col * (this.cellW + GAP);
        const y = PAD + row * this.rowH;
        el.style.transform = `translate(${x}px, ${y}px)`;
        el.style.width = `${this.cellW}px`;
        el.querySelector(".thumb").style.height = `${this.cellW}px`;
        if (Number(el.dataset.index) !== index)
            this.fill(el, index);
    }
    recycleAll() {
        for (const [, el] of this.active) {
            if (el.dataset.path)
                this.thumbs.cancel(el.dataset.path);
            el.style.display = "none";
            this.free.push(el);
        }
        this.active.clear();
    }
    /** Move selection and keep it on-screen. */
    select(index) {
        const n = state.items.length;
        if (n === 0)
            return;
        state.selected = Math.max(0, Math.min(n - 1, index));
        this.ensureVisible(state.selected);
        this.render();
    }
    get columns() {
        return this.cols;
    }
    ensureVisible(index) {
        const row = Math.floor(index / this.cols);
        const y = PAD + row * this.rowH;
        const top = this.scroller.scrollTop;
        const viewH = this.scroller.clientHeight;
        if (y < top)
            this.scroller.scrollTop = y - PAD;
        else if (y + this.rowH > top + viewH)
            this.scroller.scrollTop = y + this.rowH - viewH + PAD;
    }
}
