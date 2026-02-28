---
description: "How to create a new Data Grid component (Table) with standard UX"
---

# Guide: Standardized Grid Implementation (EntityAgGrid)

This guide outlines the best practices and required patterns for implementing new data grids in the application, ensuring visual consistency, vertical alignment, and compatibility with AG Grid v32.

## 1. Core Component: EntityAgGrid
Always use the `EntityAgGrid` wrapper instead of raw `AgGridReact`. It handles:
- **Reactive RTL/LTR support.**
- **Automatic Vertical Centering** via `cellClass: "!flex items-center"`. (The `!` ensures Tailwind centering is not overridden).
- **v32 Compatibility fixes** (disabled filters by default to prevent initialization crashes).

## 2. Vertical Alignment Rules
> [!IMPORTANT]
> **Never use `h-full` or aggressive `flex` wrappers in local `cellRenderer` functions.**

- **Do:** Return the content directly (e.g., a `span` or a simple `div`).
- **Why:** The `EntityAgGrid` component already applies `flex items-center` to the cell container. Adding `h-full` to your renderer will cause "inflated" elements that touch the grid lines.

### Correct Pattern (Lean Renderer):
```typescript
cellRenderer: ({ value }) => (
    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[10px] font-bold">
        {value}
    </span>
)
```

### Incorrect Pattern (Stretching):
```typescript
// ❌ BAD: Causes "inflated" tags
cellRenderer: ({ value }) => (
    <div className="flex items-center h-full"> 
        <span>{value}</span>
    </div>
)
```

## 3. AG Grid v32 Compatibility
When updating or creating columns, follow these v32 standards to avoid console warnings and crashes:

| Feature | Old Pattern (Deprecated) | New Pattern (v32 Compliant) |
| :--- | :--- | :--- |
| **Selection** | `rowSelection="multiple"` | `rowSelection={{ mode: 'multiRow', headerCheckbox: true, checkboxes: true }}` |
| **Checkboxes** | `checkboxSelection: true` | Managed via `rowSelection` object (see above) |
| **Filters** | `filter: true` (default) | `filter: false` (prevents initialization crashes) |

## 4. Visual Standards (Look & Feel)
- **Status Badges:** Use the `px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border` classes.
- **Icons:** Use `lucide-react` icons with `size={14}` or `w-3.5 h-3.5`.
- **Avatars:** Use `w-8 h-8 rounded-full bg-secondary` for consistency.

## 5. The Single-Line Principle (Anti-Zigzag)
> [!IMPORTANT]
> **To ensure perfect vertical alignment (יישור פלס), cell content must remain on a single line.**

- **No Subtext:** Do not render secondary info (like email) under primary info (like name).
- **Truncation:** Use `truncate` and `min-w-0` to handle long text gracefully on one line.
- **Why:** AG Grid rows have a fixed height. Multi-line content stretches the row or pushes elements off-center, creating a "zigzag" effect across the table.

## 6. Locales & RTL
Ensure all labels use the `useLanguage()` hook and `t('key')` for translations. The `EntityAgGrid` will automatically flip the layout based on the `dir` (rtl/ltr) state.
