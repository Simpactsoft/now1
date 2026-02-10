// EntityCards.tsx - קומפוננט תצוגת כרטיסיות

import React, { useCallback } from 'react';
import { CardsRenderProps } from './types';

interface EntityCardsProps<T> extends CardsRenderProps<T> {
  columns?: number;
  gap?: number;
  minCardWidth?: number;
  maxCardWidth?: number;
}

function EntityCardsInner<T = any>(props: EntityCardsProps<T>) {
  const {
    data,
    loading,
    selectedIds,
    onCardClick,
    onSelectionChange,
    renderCard,
    columns = 3,
    gap = 16,
    minCardWidth = 280,
    maxCardWidth = 400,
  } = props;

  const handleCardClick = useCallback((item: T, id: string) => {
    if (onCardClick) {
      onCardClick(item);
    }
  }, [onCardClick]);

  const handleCheckboxChange = useCallback((id: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter((selectedId) => selectedId !== id));
    }
  }, [selectedIds, onSelectionChange]);

  if (loading) {
    return (
      <div style={loadingContainerStyle}>
        <div style={spinnerStyle} />
        <p>טוען נתונים...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div style={emptyStateStyle}>
        <p>אין נתונים להצגה</p>
      </div>
    );
  }

  return (
    <div
      style={{
        ...gridContainerStyle,
        gap: `${gap}px`,
        gridTemplateColumns: `repeat(auto-fill, minmax(${minCardWidth}px, ${maxCardWidth}px))`,
      }}
    >
      {data.map((item: any) => {
        const id = item.id || item._id;
        const isSelected = selectedIds.includes(id);

        return (
          <div
            key={id}
            style={{
              ...cardWrapperStyle,
              ...(isSelected ? selectedCardStyle : {}),
            }}
            onClick={() => handleCardClick(item, id)}
          >
            {renderCard(item, isSelected)}
          </div>
        );
      })}
    </div>
  );
}

export const EntityCards = React.memo(EntityCardsInner) as typeof EntityCardsInner;

// ==================== Default Card Renderer ====================
// דוגמה לפונקציית renderCard ברירת מחדל
export function createDefaultCardRenderer<T>(config: {
  title: (item: T) => string;
  subtitle?: (item: T) => string;
  description?: (item: T) => string;
  image?: (item: T) => string;
  badges?: (item: T) => Array<{ label: string; color: string }>;
  actions?: (item: T) => React.ReactNode;
}) {
  return (item: T, isSelected: boolean) => (
    <div style={defaultCardStyle}>
      {/* תמונה */}
      {config.image && (
        <div style={cardImageContainerStyle}>
          <img 
            src={config.image(item)} 
            alt={config.title(item)}
            style={cardImageStyle}
          />
        </div>
      )}

      {/* תוכן */}
      <div style={cardContentStyle}>
        {/* כותרת */}
        <h3 style={cardTitleStyle}>{config.title(item)}</h3>

        {/* כותרת משנה */}
        {config.subtitle && (
          <p style={cardSubtitleStyle}>{config.subtitle(item)}</p>
        )}

        {/* תיאור */}
        {config.description && (
          <p style={cardDescriptionStyle}>{config.description(item)}</p>
        )}

        {/* תגיות */}
        {config.badges && config.badges(item).length > 0 && (
          <div style={cardBadgesContainerStyle}>
            {config.badges(item).map((badge, index) => (
              <span
                key={index}
                style={{
                  ...cardBadgeStyle,
                  backgroundColor: badge.color,
                }}
              >
                {badge.label}
              </span>
            ))}
          </div>
        )}

        {/* פעולות */}
        {config.actions && (
          <div style={cardActionsStyle}>
            {config.actions(item)}
          </div>
        )}
      </div>

      {/* סימון בחירה */}
      {isSelected && (
        <div style={selectedIndicatorStyle}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
          </svg>
        </div>
      )}
    </div>
  );
}

// ==================== Styles ====================
const gridContainerStyle: React.CSSProperties = {
  display: 'grid',
  padding: '16px',
  width: '100%',
  justifyContent: 'center',
};

const cardWrapperStyle: React.CSSProperties = {
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  position: 'relative',
};

const selectedCardStyle: React.CSSProperties = {
  transform: 'scale(0.98)',
  opacity: 0.9,
};

const defaultCardStyle: React.CSSProperties = {
  backgroundColor: 'white',
  borderRadius: '8px',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  overflow: 'hidden',
  transition: 'all 0.2s ease',
  position: 'relative',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
};

const cardImageContainerStyle: React.CSSProperties = {
  width: '100%',
  height: '200px',
  overflow: 'hidden',
  backgroundColor: '#f5f5f5',
};

const cardImageStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

const cardContentStyle: React.CSSProperties = {
  padding: '16px',
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const cardTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '18px',
  fontWeight: 600,
  color: '#333',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const cardSubtitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '14px',
  color: '#666',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const cardDescriptionStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '14px',
  color: '#888',
  lineHeight: '1.5',
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
};

const cardBadgesContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
  marginTop: '8px',
};

const cardBadgeStyle: React.CSSProperties = {
  padding: '4px 12px',
  borderRadius: '12px',
  fontSize: '12px',
  fontWeight: 500,
  color: 'white',
};

const cardActionsStyle: React.CSSProperties = {
  marginTop: 'auto',
  paddingTop: '12px',
  borderTop: '1px solid #f0f0f0',
  display: 'flex',
  gap: '8px',
  justifyContent: 'flex-end',
};

const selectedIndicatorStyle: React.CSSProperties = {
  position: 'absolute',
  top: '8px',
  right: '8px',
  width: '32px',
  height: '32px',
  borderRadius: '50%',
  backgroundColor: '#1976d2',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
};

const loadingContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '64px',
  color: '#666',
};

const spinnerStyle: React.CSSProperties = {
  width: '48px',
  height: '48px',
  border: '4px solid #f0f0f0',
  borderTop: '4px solid #1976d2',
  borderRadius: '50%',
  animation: 'spin 1s linear infinite',
};

const emptyStateStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '64px',
  color: '#999',
  fontSize: '16px',
};
