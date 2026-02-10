// EntityAgGrid.tsx - קומפוננט תצוגת Grid

import React, { useMemo, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridReadyEvent, SelectionChangedEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { ColumnDef, GridRenderProps } from './types';

interface EntityAgGridProps<T> extends GridRenderProps<T> {
  getRowId?: (data: T) => string;
  rowHeight?: number;
  headerHeight?: number;
  enableRangeSelection?: boolean;
  enableCellTextSelection?: boolean;
  suppressRowClickSelection?: boolean;
  theme?: 'alpine' | 'alpine-dark' | 'balham' | 'material';
}

function EntityAgGridInner<T = any>(props: EntityAgGridProps<T>) {
  const {
    data,
    columns,
    loading,
    selectedIds,
    sorting,
    pagination,
    onRowClick,
    onSelectionChange,
    onSortChange,
    onPaginationChange,
    getRowId = (item: any) => item.id,
    rowHeight = 48,
    headerHeight = 56,
    enableRangeSelection = false,
    enableCellTextSelection = true,
    suppressRowClickSelection = false,
    theme = 'alpine',
  } = props;

  // המרת ColumnDef שלנו ל-ColDef של ag-grid
  const columnDefs: ColDef[] = useMemo(() => {
    return columns.map((col) => ({
      field: String(col.field),
      headerName: col.headerName,
      width: col.width,
      minWidth: col.minWidth || 100,
      maxWidth: col.maxWidth,
      sortable: col.sortable !== false,
      filter: col.filterable !== false,
      resizable: col.resizable !== false,
      hide: col.hide,
      pinned: col.pinned,
      checkboxSelection: col.checkboxSelection,
      headerCheckboxSelection: col.checkboxSelection,
      cellRenderer: col.cellRenderer,
      valueGetter: col.valueGetter ? (params) => col.valueGetter!(params.data) : undefined,
      valueFormatter: col.valueFormatter ? (params) => col.valueFormatter!(params.value) : undefined,
      headerClass: col.headerClass,
      cellClass: col.cellClass,
    }));
  }, [columns]);

  // Grid Options
  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    suppressMenu: true,
  }), []);

  // Row Selection
  const rowSelection = useMemo(() => ({
    mode: 'multiRow' as const,
    checkboxes: true,
    headerCheckbox: true,
  }), []);

  // Handle Grid Ready
  const onGridReady = useCallback((params: GridReadyEvent) => {
    // אפשר להוסיף לוגיקה נוספת כשה-grid מוכן
    if (sorting.length > 0) {
      const sortModel = sorting.map((s) => ({
        colId: s.field,
        sort: s.direction,
      }));
      params.api.applyColumnState({ state: sortModel });
    }
  }, [sorting]);

  // Handle Selection Change
  const handleSelectionChanged = useCallback((event: SelectionChangedEvent) => {
    const selectedRows = event.api.getSelectedRows();
    const selectedRowIds = selectedRows.map(getRowId);
    onSelectionChange(selectedRowIds);
  }, [getRowId, onSelectionChange]);

  // Handle Sort Change
  const handleSortChanged = useCallback((event: any) => {
    const sortModel = event.api.getColumnState()
      .filter((col: any) => col.sort)
      .map((col: any) => ({
        field: col.colId,
        direction: col.sort,
      }));
    onSortChange(sortModel);
  }, [onSortChange]);

  // Handle Row Click
  const handleRowClicked = useCallback((event: any) => {
    if (onRowClick && !suppressRowClickSelection) {
      onRowClick(event.data);
    }
  }, [onRowClick, suppressRowClickSelection]);

  // Handle Pagination
  const handlePaginationChanged = useCallback((event: any) => {
    if (event.newPage) {
      onPaginationChange({
        page: event.api.paginationGetCurrentPage() + 1,
      });
    }
  }, [onPaginationChange]);

  return (
    <div 
      className={`ag-theme-${theme}`}
      style={{ width: '100%', height: '100%' }}
    >
      <AgGridReact
        rowData={data}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        rowSelection={rowSelection}
        
        // Selection
        rowMultiSelectWithClick={false}
        suppressRowClickSelection={suppressRowClickSelection}
        
        // Pagination
        pagination={true}
        paginationPageSize={pagination.pageSize}
        suppressPaginationPanel={true} // נשתמש ב-pagination שלנו
        
        // Sizing
        rowHeight={rowHeight}
        headerHeight={headerHeight}
        
        // Features
        enableRangeSelection={enableRangeSelection}
        enableCellTextSelection={enableCellTextSelection}
        
        // Loading
        loading={loading}
        
        // RTL Support
        enableRtl={true}
        
        // Events
        onGridReady={onGridReady}
        onSelectionChanged={handleSelectionChanged}
        onSortChanged={handleSortChanged}
        onRowClicked={handleRowClicked}
        onPaginationChanged={handlePaginationChanged}
        
        // Row ID
        getRowId={(params) => getRowId(params.data)}
        
        // Localization
        localeText={{
          page: 'עמוד',
          of: 'מתוך',
          to: 'עד',
          more: 'עוד',
          next: 'הבא',
          last: 'אחרון',
          first: 'ראשון',
          previous: 'קודם',
          loadingOoo: 'טוען...',
          noRowsToShow: 'אין נתונים להצגה',
          selectAll: 'בחר הכל',
          searchOoo: 'חיפוש...',
          filterOoo: 'סינון...',
        }}
      />
      
      {/* Custom Pagination Controls */}
      {pagination.totalPages && pagination.totalPages > 1 && (
        <div className="grid-pagination" style={paginationStyle}>
          <button
            onClick={() => onPaginationChange({ page: 1 })}
            disabled={pagination.page === 1}
            style={buttonStyle}
          >
            ראשון
          </button>
          <button
            onClick={() => onPaginationChange({ page: pagination.page - 1 })}
            disabled={pagination.page === 1}
            style={buttonStyle}
          >
            קודם
          </button>
          
          <span style={{ margin: '0 16px', fontSize: '14px' }}>
            עמוד {pagination.page} מתוך {pagination.totalPages}
            {pagination.totalRecords && ` (${pagination.totalRecords} רשומות)`}
          </span>
          
          <button
            onClick={() => onPaginationChange({ page: pagination.page + 1 })}
            disabled={pagination.page === pagination.totalPages}
            style={buttonStyle}
          >
            הבא
          </button>
          <button
            onClick={() => onPaginationChange({ page: pagination.totalPages })}
            disabled={pagination.page === pagination.totalPages}
            style={buttonStyle}
          >
            אחרון
          </button>
        </div>
      )}
    </div>
  );
}

// Memoize the component for performance
export const EntityAgGrid = React.memo(EntityAgGridInner) as typeof EntityAgGridInner;

// Styles
const paginationStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '16px',
  borderTop: '1px solid #e0e0e0',
  backgroundColor: '#fafafa',
};

const buttonStyle: React.CSSProperties = {
  padding: '8px 16px',
  margin: '0 4px',
  border: '1px solid #d0d0d0',
  borderRadius: '4px',
  backgroundColor: 'white',
  cursor: 'pointer',
  fontSize: '14px',
};
