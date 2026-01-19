## 2026-01-19 - ARIA State Management in Static Sites
**Learning:** Adding semantic roles to static HTML is insufficient for dynamic components like tabs and progress bars; one must piggyback on existing state management functions (like `setActiveMode`) to keep `aria-*` attributes in sync.
**Action:** Always audit the JavaScript corresponding to interactive UI elements when adding ARIA roles to ensure state changes are reflected in the accessibility tree.
