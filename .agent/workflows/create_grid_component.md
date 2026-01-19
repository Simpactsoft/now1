---
description: How to create a new Data Grid component (Table) with standard UX
---

# Workflow: Create Data Grid Component

Follow these steps when implementing a new Grid/List view (e.g., Log Viewer, Audit Trail, Entity List).

## 1. Prerequisites
- Ensure the API/RPC exists to fetch the data.
- Ensure the data has a unique `id` field.

## 2. Component Structure
- Create `src/components/[Name]Grid.tsx`.
- Use a `client` component (`"use client"`).
- Import `useGridPersistence` from `@/hooks/useGridPersistence`.

## 3. Implementation Checklist

### A. Persistence Setup
Initialize the persistence hook with a unique key for this grid.
```typescript
const { saveState, restoredState, restoreScroll } = useGridPersistence('unique-grid-key');
```

### B. Scroll Restoration Logic
Add a `useEffect` to trigger scroll restoration when data loads.
```typescript
useEffect(() => {
    if (restoredState?.rowId && data.length > 0) {
        restoreScroll(restoredState.rowId);
    }
}, [restoredState, data, restoreScroll]);
```

### C. Row Rendering
Every row (`<tr>` or `div`) **MUST** have:
1. `id={item.id}` (Required for `document.getElementById` lookup).
2. `onClick` handler that saves state before navigation.
3. `cursor-pointer` class.

```tsx
<tr 
    key={item.id}
    id={item.id} // <--- CRITICAL
    className="group hover:bg-white/5 transition-colors cursor-pointer"
    onClick={() => {
        saveState({ rowId: item.id }); // <--- CRITICAL
        // Navigation Logic (router.push or window.location)
    }}
>
    {/* Cells */}
</tr>
```

### D. Empty States
Always handle the `length === 0` case with a standard Empty State component (Icon + Message).

## 4. UI Consistency
- Use Tailwind classes for the table structure (`w-full text-left`).
- Use `bg-[#1C1C1E]/80 backdrop-blur-xl` for the container background.
- Use `border-white/10` for borders.
- Use `text-zinc-400` for headers (`uppercase tracking-wider`).

## 5. Verification
- [ ] Click a row -> Navigate to details.
- [ ] Go Back.
- [ ] Verify the grid scrolls to the row.
- [ ] Verify the row pulses/highlights.
