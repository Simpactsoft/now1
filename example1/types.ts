// types.ts - הגדרות טיפוסים מרכזיות

export type ViewMode = 'grid' | 'cards' | 'tags' | 'list';

export type FilterOperator = 
  | 'equals' 
  | 'notEquals' 
  | 'contains' 
  | 'notContains'
  | 'greaterThan' 
  | 'lessThan'
  | 'between'
  | 'in'
  | 'isEmpty'
  | 'isNotEmpty';

export interface FilterChip {
  id: string;
  field: string;
  operator: FilterOperator;
  value: any;
  label: string;
  color?: string;
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

export interface PaginationConfig {
  page: number;
  pageSize: number;
  totalPages?: number;
  totalRecords?: number;
}

export interface SavedView {
  id: string;
  name: string;
  filters: FilterChip[];
  sorting?: SortConfig[];
  columns?: string[];
  viewMode: ViewMode;
  isDefault?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: Date;
  resultCount: number;
}

export interface ColumnDef<T = any> {
  field: keyof T | string;
  headerName: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  sortable?: boolean;
  filterable?: boolean;
  resizable?: boolean;
  hide?: boolean;
  cellRenderer?: (params: { value: any; data: T }) => React.ReactNode;
  valueGetter?: (data: T) => any;
  valueFormatter?: (value: any) => string;
  headerClass?: string;
  cellClass?: string;
  pinned?: 'left' | 'right';
  checkboxSelection?: boolean;
}

export interface EntityViewConfig<T = any> {
  // State
  viewMode: ViewMode;
  filters: FilterChip[];
  searchQuery: string;
  sorting: SortConfig[];
  pagination: PaginationConfig;
  selectedIds: string[];
  
  // Data
  data: T[];
  filteredData: T[];
  loading: boolean;
  error?: Error | null;
  
  // Actions
  setViewMode: (mode: ViewMode) => void;
  addFilter: (filter: FilterChip) => void;
  removeFilter: (filterId: string) => void;
  clearFilters: () => void;
  setSearchQuery: (query: string) => void;
  setSorting: (sorting: SortConfig[]) => void;
  setPagination: (pagination: Partial<PaginationConfig>) => void;
  setSelectedIds: (ids: string[]) => void;
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  
  // View Management
  saveView: (name: string) => Promise<void>;
  loadView: (viewId: string) => Promise<void>;
  deleteView: (viewId: string) => Promise<void>;
  
  // Refresh
  refresh: () => Promise<void>;
}

export interface EntityViewLayoutProps<T = any> {
  // Basic Config
  title: string;
  entityType: string;
  columns: ColumnDef<T>[];
  
  // View Config (מגיע מ-useEntityView)
  config: EntityViewConfig<T>;
  
  // Actions
  onRowClick?: (item: T) => void;
  onRowDoubleClick?: (item: T) => void;
  onSelectionChange?: (selectedItems: T[]) => void;
  
  // Toolbar Actions
  customActions?: React.ReactNode;
  enableExport?: boolean;
  enableImport?: boolean;
  enableBulkActions?: boolean;
  
  // View Options
  availableViewModes?: ViewMode[];
  defaultViewMode?: ViewMode;
  
  // Render Functions
  renderGrid?: (props: GridRenderProps<T>) => React.ReactNode;
  renderCards?: (props: CardsRenderProps<T>) => React.ReactNode;
  renderTags?: (props: TagsRenderProps<T>) => React.ReactNode;
  
  // Saved Views
  savedViews?: SavedView[];
  onSaveView?: (view: SavedView) => void;
  onLoadView?: (viewId: string) => void;
  
  // Search History
  searchHistory?: SearchHistoryItem[];
  maxHistoryItems?: number;
  
  // Customization
  className?: string;
  style?: React.CSSProperties;
}

export interface GridRenderProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  loading: boolean;
  selectedIds: string[];
  sorting: SortConfig[];
  pagination: PaginationConfig;
  onRowClick?: (item: T) => void;
  onSelectionChange: (ids: string[]) => void;
  onSortChange: (sorting: SortConfig[]) => void;
  onPaginationChange: (pagination: Partial<PaginationConfig>) => void;
}

export interface CardsRenderProps<T> {
  data: T[];
  loading: boolean;
  selectedIds: string[];
  onCardClick?: (item: T) => void;
  onSelectionChange: (ids: string[]) => void;
  renderCard: (item: T, selected: boolean) => React.ReactNode;
}

export interface TagsRenderProps<T> {
  data: T[];
  loading: boolean;
  groupBy?: keyof T;
  onTagClick?: (item: T) => void;
}
