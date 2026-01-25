## 2024-05-22 - ARIA Tab Interface & Keyboard Navigation
**Learning:** implementing `role="tab"` with manual `tabindex` management (0/-1) requires implementing full arrow-key navigation logic. Without it, keyboard users get stuck on the active tab.
**Action:** For simple "tab-like" toggles where full ARIA complexity is overkill, keep `tabindex` natural (or 0) for all tabs so users can Tab through them, or ensure full keyboard event handling is implemented.

## 2026-01-25 - Retrofitting ARIA Tabs
**Learning:** Adding standard arrow-key navigation to an existing `role="tablist"` interface is straightforward: listen for `ArrowLeft`/`ArrowRight`, toggle selection, move focus, and update `tabindex` (0/-1). This transforms a "fake" accessible interface into a truly compliant one with <20 lines of code.
**Action:** Always verify `role="tab"` implementations with arrow keys; if they fail, adding the handler is a high-value, low-effort fix.
