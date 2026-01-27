## 2024-05-22 - ARIA Tab Interface & Keyboard Navigation
**Learning:** implementing `role="tab"` with manual `tabindex` management (0/-1) requires implementing full arrow-key navigation logic. Without it, keyboard users get stuck on the active tab.
**Action:** For simple "tab-like" toggles where full ARIA complexity is overkill, keep `tabindex` natural (or 0) for all tabs so users can Tab through them, or ensure full keyboard event handling is implemented.

## 2024-05-24 - Dynamic Status Notifications
**Learning:** Visual status overlays (toasts) are completely invisible to screen readers unless marked with `aria-live`.
**Action:** When creating dynamic status elements (`document.createElement`), always add `role="status"` and `aria-live="polite"` immediately.
