// EntityViewLayout.tsx - הקומפוננט הראשי

import React, { useState, useCallback } from 'react';
import { EntityViewLayoutProps, ViewMode, FilterChip } from './types';
import { EntityAgGrid } from './EntityAgGrid';
import { EntityCards } from './EntityCards';

export function EntityViewLayout<T = any>(props: EntityViewLayoutProps<T>) {
  const {
    title,
    entityType,
    columns,
    config,
    onRowClick,
    onRowDoubleClick,
    onSelectionChange,
    customActions,
    enableExport = true,
    enableImport = false,
    enableBulkActions = true,
    availableViewModes = ['grid', 'cards', 'tags'],
    defaultViewMode = 'grid',
    renderGrid,
    renderCards,
    renderTags,
    savedViews = [],
    searchHistory = [],
    maxHistoryItems = 5,
    className = '',
    style = {},
  } = props;

  const [showSavedViews, setShowSavedViews] = useState(false);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const [newViewName, setNewViewName] = useState('');

  // ==================== Handlers ====================
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    config.setSearchQuery(e.target.value);
  }, [config]);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    config.setViewMode(mode);
  }, [config]);

  const handleRemoveFilter = useCallback((filterId: string) => {
    config.removeFilter(filterId);
  }, [config]);

  const handleSaveView = useCallback(async () => {
    if (newViewName.trim()) {
      await config.saveView(newViewName.trim());
      setNewViewName('');
      setSaveViewDialogOpen(false);
    }
  }, [newViewName, config]);

  const handleExport = useCallback(() => {
    // TODO: הוסף לוגיקת ייצוא
    console.log('Export data:', config.filteredData);
  }, [config.filteredData]);

  // ==================== Render View ====================
  const renderCurrentView = () => {
    const commonProps = {
      data: config.data,
      loading: config.loading,
      selectedIds: config.selectedIds,
    };

    switch (config.viewMode) {
      case 'grid':
        if (renderGrid) {
          return renderGrid({
            ...commonProps,
            columns,
            sorting: config.sorting,
            pagination: config.pagination,
            onRowClick,
            onSelectionChange: config.setSelectedIds,
            onSortChange: config.setSorting,
            onPaginationChange: config.setPagination,
          });
        }
        return (
          <EntityAgGrid
            {...commonProps}
            columns={columns}
            sorting={config.sorting}
            pagination={config.pagination}
            onRowClick={onRowClick}
            onSelectionChange={config.setSelectedIds}
            onSortChange={config.setSorting}
            onPaginationChange={config.setPagination}
          />
        );

      case 'cards':
        if (renderCards) {
          return renderCards({
            ...commonProps,
            onCardClick: onRowClick,
            onSelectionChange: config.setSelectedIds,
            renderCard: (item, selected) => (
              <div>Default Card - implement renderCard prop</div>
            ),
          });
        }
        return <div>Cards view - implement renderCards prop</div>;

      case 'tags':
        if (renderTags) {
          return renderTags({
            ...commonProps,
            onTagClick: onRowClick,
          });
        }
        return <div>Tags view - implement renderTags prop</div>;

      default:
        return <div>Unknown view mode</div>;
    }
  };

  // ==================== Render ====================
  return (
    <div className={`entity-view-layout ${className}`} style={{ ...containerStyle, ...style }}>
      {/* Toolbar */}
      <div style={toolbarStyle}>
        <div style={toolbarLeftStyle}>
          <h1 style={titleStyle}>{title}</h1>
          {config.filteredData && (
            <span style={recordsCountStyle}>
              {config.filteredData.length} רשומות
              {config.filters.length > 0 && ` (${config.data.length} סה"כ)`}
            </span>
          )}
        </div>

        <div style={toolbarRightStyle}>
          {/* Custom Actions */}
          {customActions}

          {/* Export */}
          {enableExport && (
            <button onClick={handleExport} style={toolbarButtonStyle}>
              📥 ייצוא
            </button>
          )}

          {/* Refresh */}
          <button onClick={config.refresh} style={toolbarButtonStyle} disabled={config.loading}>
            🔄 רענן
          </button>

          {/* Save View */}
          <button onClick={() => setSaveViewDialogOpen(true)} style={toolbarButtonStyle}>
            💾 שמור תצוגה
          </button>

          {/* Saved Views */}
          {savedViews.length > 0 && (
            <button onClick={() => setShowSavedViews(!showSavedViews)} style={toolbarButtonStyle}>
              📁 תצוגות שמורות ({savedViews.length})
            </button>
          )}
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div style={searchBarStyle}>
        {/* Search Input */}
        <div style={searchInputContainerStyle}>
          <input
            type="text"
            placeholder="חיפוש..."
            value={config.searchQuery}
            onChange={handleSearchChange}
            style={searchInputStyle}
          />
          <button
            onClick={() => setShowSearchHistory(!showSearchHistory)}
            style={historyButtonStyle}
            title="היסטוריית חיפוש"
          >
            🕐
          </button>
        </div>

        {/* View Mode Switcher */}
        <div style={viewSwitcherStyle}>
          {availableViewModes.map((mode) => (
            <button
              key={mode}
              onClick={() => handleViewModeChange(mode)}
              style={{
                ...viewModeButtonStyle,
                ...(config.viewMode === mode ? activeViewModeStyle : {}),
              }}
            >
              {getViewModeIcon(mode)} {getViewModeLabel(mode)}
            </button>
          ))}
        </div>
      </div>

      {/* Active Filters (Smart Chips) */}
      {config.filters.length > 0 && (
        <div style={filtersBarStyle}>
          <span style={filtersLabelStyle}>סינונים פעילים:</span>
          {config.filters.map((filter) => (
            <div key={filter.id} style={filterChipStyle}>
              <span>{filter.label}</span>
              <button
                onClick={() => handleRemoveFilter(filter.id)}
                style={chipRemoveButtonStyle}
              >
                ✕
              </button>
            </div>
          ))}
          <button onClick={config.clearFilters} style={clearFiltersButtonStyle}>
            נקה הכל
          </button>
        </div>
      )}

      {/* Bulk Actions */}
      {enableBulkActions && config.selectedIds.length > 0 && (
        <div style={bulkActionsBarStyle}>
          <span style={bulkActionsLabelStyle}>
            {config.selectedIds.length} נבחרו
          </span>
          <button onClick={config.clearSelection} style={bulkActionButtonStyle}>
            בטל בחירה
          </button>
          {/* Add more bulk actions here */}
        </div>
      )}

      {/* Main Content Area */}
      <div style={contentAreaStyle}>
        {config.error ? (
          <div style={errorStyle}>
            <p>שגיאה: {config.error.message}</p>
            <button onClick={config.refresh} style={toolbarButtonStyle}>
              נסה שוב
            </button>
          </div>
        ) : (
          renderCurrentView()
        )}
      </div>

      {/* Save View Dialog */}
      {saveViewDialogOpen && (
        <div style={dialogOverlayStyle} onClick={() => setSaveViewDialogOpen(false)}>
          <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
            <h3>שמור תצוגה חדשה</h3>
            <input
              type="text"
              placeholder="שם התצוגה..."
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              style={dialogInputStyle}
              autoFocus
            />
            <div style={dialogActionsStyle}>
              <button onClick={handleSaveView} style={dialogButtonStyle}>
                שמור
              </button>
              <button onClick={() => setSaveViewDialogOpen(false)} style={dialogButtonStyle}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== Helper Functions ====================
function getViewModeIcon(mode: ViewMode): string {
  switch (mode) {
    case 'grid': return '📊';
    case 'cards': return '🗂️';
    case 'tags': return '🏷️';
    case 'list': return '📋';
    default: return '📄';
  }
}

function getViewModeLabel(mode: ViewMode): string {
  switch (mode) {
    case 'grid': return 'טבלה';
    case 'cards': return 'כרטיסיות';
    case 'tags': return 'תגיות';
    case 'list': return 'רשימה';
    default: return mode;
  }
}

// ==================== Styles ====================
const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: '#fafafa',
};

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '16px 24px',
  backgroundColor: 'white',
  borderBottom: '1px solid #e0e0e0',
};

const toolbarLeftStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
};

const toolbarRightStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '24px',
  fontWeight: 600,
  color: '#333',
};

const recordsCountStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#666',
  backgroundColor: '#f5f5f5',
  padding: '4px 12px',
  borderRadius: '12px',
};

const toolbarButtonStyle: React.CSSProperties = {
  padding: '8px 16px',
  border: '1px solid #d0d0d0',
  borderRadius: '6px',
  backgroundColor: 'white',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 500,
  transition: 'all 0.2s',
};

const searchBarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '16px 24px',
  backgroundColor: 'white',
  borderBottom: '1px solid #e0e0e0',
  gap: '16px',
};

const searchInputContainerStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  position: 'relative',
  maxWidth: '500px',
};

const searchInputStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px 16px',
  fontSize: '14px',
  border: '1px solid #d0d0d0',
  borderRadius: '6px',
  outline: 'none',
};

const historyButtonStyle: React.CSSProperties = {
  position: 'absolute',
  right: '8px',
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '18px',
};

const viewSwitcherStyle: React.CSSProperties = {
  display: 'flex',
  gap: '4px',
  backgroundColor: '#f5f5f5',
  padding: '4px',
  borderRadius: '8px',
};

const viewModeButtonStyle: React.CSSProperties = {
  padding: '8px 16px',
  border: 'none',
  borderRadius: '6px',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 500,
  transition: 'all 0.2s',
};

const activeViewModeStyle: React.CSSProperties = {
  backgroundColor: 'white',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
};

const filtersBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '12px 24px',
  backgroundColor: '#f9f9f9',
  borderBottom: '1px solid #e0e0e0',
  flexWrap: 'wrap',
};

const filtersLabelStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 500,
  color: '#666',
};

const filterChipStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 12px',
  backgroundColor: '#e3f2fd',
  color: '#1976d2',
  borderRadius: '16px',
  fontSize: '13px',
  fontWeight: 500,
};

const chipRemoveButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '14px',
  color: '#1976d2',
  padding: '0 4px',
};

const clearFiltersButtonStyle: React.CSSProperties = {
  padding: '6px 12px',
  backgroundColor: 'transparent',
  border: '1px solid #d0d0d0',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 500,
  color: '#666',
};

const bulkActionsBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px 24px',
  backgroundColor: '#fff3e0',
  borderBottom: '1px solid #e0e0e0',
};

const bulkActionsLabelStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#e65100',
};

const bulkActionButtonStyle: React.CSSProperties = {
  padding: '6px 12px',
  border: '1px solid #ff9800',
  borderRadius: '6px',
  backgroundColor: 'white',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 500,
  color: '#e65100',
};

const contentAreaStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  backgroundColor: 'white',
};

const errorStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '64px',
  color: '#d32f2f',
};

const dialogOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const dialogStyle: React.CSSProperties = {
  backgroundColor: 'white',
  padding: '24px',
  borderRadius: '8px',
  minWidth: '400px',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
};

const dialogInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  fontSize: '14px',
  border: '1px solid #d0d0d0',
  borderRadius: '6px',
  marginTop: '16px',
  outline: 'none',
};

const dialogActionsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
  marginTop: '16px',
};

const dialogButtonStyle: React.CSSProperties = {
  padding: '8px 16px',
  border: '1px solid #d0d0d0',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 500,
};
