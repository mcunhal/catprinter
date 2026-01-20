## 2024-05-22 - ARIA Tab Interface & Keyboard Navigation
**Learning:** implementing `role="tab"` with manual `tabindex` management (0/-1) requires implementing full arrow-key navigation logic. Without it, keyboard users get stuck on the active tab.
**Action:** For simple "tab-like" toggles where full ARIA complexity is overkill, keep `tabindex` natural (or 0) for all tabs so users can Tab through them, or ensure full keyboard event handling is implemented.
