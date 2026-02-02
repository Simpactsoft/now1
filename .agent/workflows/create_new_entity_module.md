---
description: Comprehensive guide to adding a new Entity Module (e.g., Items, Products) to the application.
---

# Creating a New Entity Module

This workflow documents the necessary steps to add a new entity category (e.g., "Items", "Projects") with full functionality: List View, Grid/Card Switching, Filters, and Detail/Profile View.

## 1. Database & RPCs (Backend)

- [ ] **Create List RPC (`fetch_<entities>_crm`)**:
    -   Should return paginated results.
    -   Should accept `arg_filters`, `arg_sort_col`, `arg_sort_dir`.
    -   Return standard columns: `ret_id`, `ret_name`, `ret_status`, `ret_updated_at`, plus entity-specific fields (e.g., `ret_sku`, `ret_price`).
    -   **Tip**: Use `jsonb_path_query_first` or `custom_fields->>` to extract data efficiently.

- [ ] **Create Profile RPC (`fetch_<entity>_profile`)**:
    -   **Critical**: usage of `SECURITY DEFINER` to bypass strict RLS if users need to view details but don't own the record directly (depending on permission model).
    -   Return standardized logic: `id`, `display_name`, `tags`, `custom_fields`, and computed fields (`email`, `phone`, `location`).

- [ ] **Verify RLS Policies**:
    -   Ensure `cards` table policies allow `SELECT` and `UPDATE` for the new `type`.

## 2. Server Actions (Next.js)

- [ ] **List Action (`fetch<Entities>.ts`)**:
    -   Call `fetch_<entities>_crm` RPC.
    -   Handle total count retrieval (often via separate `get_counts` or included in RPC).

- [ ] **Detail Action (`fetchDetails.ts` or `fetch<Entity>Details.ts`)**:
    -   Call `fetch_<entity>_profile` RPC.
    -   Call `fetch_person_timeline` (or specific timeline RPC) for the Activity Stream.

- [ ] **Update Action (`update<Entity>.ts`)**:
    -   Implement Optimistic Locking (check `updated_at`).
    -   Handle specific field mapping logic.
    -   Revalidate paths (`/dashboard/<entities>`, `/dashboard/<entities>/[id]`).

## 3. Frontend Components

### List Views
- [ ] **`<Entity>ViewWrapper.tsx`**:
    -   **State persistence**: Implement `sessionStorage` for `highlightId` (e.g., `lastClicked<Entity>Id`).
    -   **Routing**: `router.push('/dashboard/<entities>/[id]')`.
    -   **View Modes**: Toggle between Grid (`SimpleTable`) and Cards (`EntityCard`).
    -   **Auto-Scroll**: Implement `useEffect` to scroll to restored `highlightId`.

- [ ] **`Simple<Entity>Table.tsx`**:
    -   Accept `highlightId`.
    -   Add `id="row-{id}"` to `<tr>` for scroll targeting.
    -   Apply visual highlight (`bg-primary/5`).

- [ ] **`EntityCard.tsx` integration**:
    -   Ensure `EntityCard` supports specific fields for this entity (or map them cleanly in the Wrapper).
    -   Pass `isHighlighted` prop.

### Profile / Detail View
- [ ] **`<Entity>Header.tsx`**:
    -   Clone `ProfileHeader` or `OrganizationHeader`.
    -   Adapt icons (e.g., Box for Items).
    -   Wire up editable fields to `update<Entity>`.
    -   Implement Status/Category dropdowns.

## 4. Pages

- [ ] **`/dashboard/<entities>/page.tsx`**:
    -   Wrap `<Entity>ViewWrapper`.

- [ ] **`/dashboard/<entities>/[id]/page.tsx`**:
    -   Fetch data using Detail Action.
    -   Render `<Entity>Header`.
    -   Render Quick Stats / Tags / Timeline.

## 5. Navigation

- [ ] **Sidebar**: Add entry to `src/components/Sidebar.tsx`.
- [ ] **View Config**: Update `ViewConfigContext` if specific standard filters are needed globally.
