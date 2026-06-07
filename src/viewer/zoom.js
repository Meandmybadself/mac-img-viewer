export function baseScale(mode, natW, natH, stageW, stageH) {
    if (natW === 0 || natH === 0)
        return 1;
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
export function setMode(z, mode, natW, natH, stageW, stageH) {
    z.mode = mode;
    z.scale = baseScale(mode, natW, natH, stageW, stageH);
    z.tx = 0;
    z.ty = 0;
}
/** Multiply the current scale (keyboard +/-), switching to free mode. */
export function zoomBy(z, factor) {
    z.mode = "free";
    z.scale = clamp(z.scale * factor, 0.05, 40);
}
export function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}
/** Apply the transform to a centered element of natural size. */
export function apply(el, z) {
    el.style.transform = `translate(${z.tx}px, ${z.ty}px) scale(${z.scale})`;
}
