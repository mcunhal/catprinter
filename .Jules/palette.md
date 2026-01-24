## 2024-05-22 - ARIA Tab Interface & Keyboard Navigation
**Learning:** implementing `role="tab"` with manual `tabindex` management (0/-1) requires implementing full arrow-key navigation logic. Without it, keyboard users get stuck on the active tab.
**Action:** For simple "tab-like" toggles where full ARIA complexity is overkill, keep `tabindex` natural (or 0) for all tabs so users can Tab through them, or ensure full keyboard event handling is implemented.

## 2024-05-23 - Action Inputs and Enter Key
**Learning:** For inputs associated with a specific "Apply" button (like font size), users expect the Enter key to trigger the action. Without it, the interaction feels disjointed. Also, `e.preventDefault()` is crucial when handling Enter in non-form inputs to prevent unexpected side effects (like newlines in editors).
**Action:** Always add a `keydown` listener for Enter on "action parameter" inputs, and ensure to prevent default behavior if the context implies it (e.g. adjacent to an editor).
