---
description: How to create a new Data Grid component (Table) with standard UX
---

// turbo-all
1. Define your data interface and fetch actions.
2. Use the generic `EntityAgGrid` component from `@/components/entity-view/EntityAgGrid`.
3. Define columns using `ColumnDef<T>[]`.
4. Ensure `cellRenderer` functions are "lean" (no `h-full` or height stretching).
5. For status badges, use the standard classes: `px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border`.
6. Refer to [grid_implementation_guide.md](file:///Users/itzhakbenari/Documents/GitHub/now/docs/grid_implementation_guide.md) for detailed styling rules and the v32 compliant `rowSelection` object.
7. Verify vertical alignment is handled by the `EntityAgGrid`'s internal `cellClass` (`!flex items-center`).
