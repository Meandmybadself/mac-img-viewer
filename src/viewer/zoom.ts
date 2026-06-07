// Zoom + pan math for the viewer, independent of the media element type.
export type ZoomMode = "fit" | "fill" | "actual" | "free";

export interface ZoomState {
  mode: ZoomMode;
  scale: number;
  tx: number; // pan offset in px
  ty: number;
}

export function baseScale(mode: ZoomMode, natW: number, natH: number, stageW: number, stageH: number): number {
  if (natW === 0 || natH === 0) return 1;
  switch (mode) {
    case "fit":
      return Math.min(stageW / natW, stageH / natH);
    case "fill":
      return Math.max(stageW / natW, stageH / natH);
    case "actual":
      return 1;
    default:
      return 1;
  }
}

/** Compute the scale for a non-free mode and reset pan. */
export function setMode(
  z: ZoomState,
  mode: Exclude<ZoomMode, "free">,
  natW: number,
  natH: number,
  stageW: number,
  stageH: number
): void {
  z.mode = mode;
  z.scale = baseScale(mode, natW, natH, stageW, stageH);
  z.tx = 0;
  z.ty = 0;
}

/** Multiply the current scale (keyboard +/-), switching to free mode. */
export function zoomBy(z: ZoomState, factor: number): void {
  z.mode = "free";
  z.scale = clamp(z.scale * factor, 0.05, 40);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Apply the transform to a centered element of natural size. */
export function apply(el: HTMLElement, z: ZoomState): void {
  el.style.transform = `translate(${z.tx}px, ${z.ty}px) scale(${z.scale})`;
}
