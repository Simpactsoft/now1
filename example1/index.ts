// index.ts - ייצוא כל הקומפוננטים והטיפוסים

// Components
export { EntityViewLayout } from './EntityViewLayout';
export { EntityAgGrid } from './EntityAgGrid';
export { EntityCards, createDefaultCardRenderer } from './EntityCards';

// Hooks
export { useEntityView } from './useEntityView';

// Types
export type {
  ViewMode,
  FilterOperator,
  FilterChip,
  SortConfig,
  PaginationConfig,
  SavedView,
  SearchHistoryItem,
  ColumnDef,
  EntityViewConfig,
  EntityViewLayoutProps,
  GridRenderProps,
  CardsRenderProps,
  TagsRenderProps,
} from './types';
