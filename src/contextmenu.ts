// Minimal right-click context menu.
export interface MenuItem {
  label: string;
  action: () => void;
}

let current: HTMLElement | null = null;

export function showContextMenu(x: number, y: number, items: MenuItem[]): void {
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

export function closeContextMenu(): void {
  if (!current) return;
  current.remove();
  current = null;
  window.removeEventListener("pointerdown", onPointerDown, true);
  window.removeEventListener("keydown", onKeyDown, true);
}

function onPointerDown(e: PointerEvent): void {
  if (current && !current.contains(e.target as Node)) closeContextMenu();
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    e.stopPropagation();
    closeContextMenu();
  }
}
