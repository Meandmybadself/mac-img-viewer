let current = null;
export function showContextMenu(x, y, items) {
    closeContextMenu();
    const menu = document.createElement("div");
    menu.className = "context-menu";
    for (const item of items) {
        const btn = document.createElement("button");
        btn.textContent = item.label;
        btn.addEventListener("click", () => {
            closeContextMenu();
            item.action();
        });
        menu.appendChild(btn);
    }
    document.body.appendChild(menu);
    // Keep the menu on-screen.
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.min(x, window.innerWidth - rect.width - 4)}px`;
    menu.style.top = `${Math.min(y, window.innerHeight - rect.height - 4)}px`;
    current = menu;
    // Dismiss on the next outside interaction.
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
}
export function closeContextMenu() {
    if (!current)
        return;
    current.remove();
    current = null;
    window.removeEventListener("pointerdown", onPointerDown, true);
    window.removeEventListener("keydown", onKeyDown, true);
}
function onPointerDown(e) {
    if (current && !current.contains(e.target))
        closeContextMenu();
}
function onKeyDown(e) {
    if (e.key === "Escape") {
        e.stopPropagation();
        closeContextMenu();
    }
}
