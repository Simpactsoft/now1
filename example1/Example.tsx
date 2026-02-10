// Example.tsx - דוגמת שימוש מלאה

import React from 'react';
import { EntityViewLayout } from './EntityViewLayout';
import { EntityCards, createDefaultCardRenderer } from './EntityCards';
import { useEntityView } from './useEntityView';
import { ColumnDef } from './types';

// ==================== טיפוס הישות ====================
interface Person {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  role: string;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  avatar?: string;
}

// ==================== נתוני דמו ====================
const samplePeople: Person[] = [
  {
    id: '1',
    name: 'יוסי כהן',
    email: 'yossi@example.com',
    phone: '050-1234567',
    company: 'חברת הייטק בע"מ',
    role: 'מנהל פיתוח',
    status: 'active',
    createdAt: new Date('2024-01-15'),
    avatar: 'https://i.pravatar.cc/150?img=1',
  },
  {
    id: '2',
    name: 'שרה לוי',
    email: 'sarah@example.com',
    phone: '052-9876543',
    company: 'סטארטאפ חדש',
    role: 'מנכ"לית',
    status: 'active',
    createdAt: new Date('2024-02-20'),
    avatar: 'https://i.pravatar.cc/150?img=5',
  },
  {
    id: '3',
    name: 'דוד מזרחי',
    email: 'david@example.com',
    phone: '054-5555555',
    company: 'חברת ייעוץ',
    role: 'יועץ בכיר',
    status: 'pending',
    createdAt: new Date('2024-03-10'),
    avatar: 'https://i.pravatar.cc/150?img=12',
  },
  // הוסף עוד רשומות לפי הצורך...
];

// ==================== הגדרת עמודות לגריד ====================
const personColumns: ColumnDef<Person>[] = [
  {
    field: 'id',
    headerName: 'מזהה',
    width: 80,
    checkboxSelection: true,
  },
  {
    field: 'name',
    headerName: 'שם מלא',
    width: 200,
    cellRenderer: (params) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {params.data.avatar && (
          <img
            src={params.data.avatar}
            alt={params.value}
            style={{ width: 32, height: 32, borderRadius: '50%' }}
          />
        )}
        <strong>{params.value}</strong>
      </div>
    ),
  },
  {
    field: 'email',
    headerName: 'אימייל',
    width: 250,
  },
  {
    field: 'phone',
    headerName: 'טלפון',
    width: 150,
  },
  {
    field: 'company',
    headerName: 'חברה',
    width: 200,
  },
  {
    field: 'role',
    headerName: 'תפקיד',
    width: 180,
  },
  {
    field: 'status',
    headerName: 'סטטוס',
    width: 120,
    cellRenderer: (params) => {
      const statusColors = {
        active: { bg: '#e8f5e9', text: '#2e7d32' },
        inactive: { bg: '#ffebee', text: '#c62828' },
        pending: { bg: '#fff3e0', text: '#e65100' },
      };
      const color = statusColors[params.value];
      return (
        <span
          style={{
            padding: '4px 12px',
            borderRadius: '12px',
            backgroundColor: color.bg,
            color: color.text,
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          {params.value === 'active' ? 'פעיל' : params.value === 'inactive' ? 'לא פעיל' : 'ממתין'}
        </span>
      );
    },
  },
  {
    field: 'createdAt',
    headerName: 'תאריך יצירה',
    width: 150,
    valueFormatter: (value) => {
      return new Date(value).toLocaleDateString('he-IL');
    },
  },
];

// ==================== הקומפוננט הראשי ====================
export function PeopleExample() {
  // השתמש ב-Hook המרכזי
  const config = useEntityView<Person>({
    entityType: 'people',
    initialData: samplePeople,
    initialViewMode: 'grid',
    initialPageSize: 10,
    serverSide: false, // במקרה זה הנתונים ב-client
  });

  // Handler לחיצה על שורה
  const handleRowClick = (person: Person) => {
    console.log('נלחץ על:', person);
    // כאן תוכל לפתוח דיאלוג, לנווט לעמוד פרטים וכו'
  };

  // Handler לשינוי בחירה
  const handleSelectionChange = (selectedPeople: Person[]) => {
    console.log('נבחרו:', selectedPeople);
  };

  // יצירת renderCard לתצוגת כרטיסיות
  const renderPersonCard = createDefaultCardRenderer<Person>({
    title: (person) => person.name,
    subtitle: (person) => person.role,
    description: (person) => `${person.company} • ${person.email}`,
    image: (person) => person.avatar || 'https://via.placeholder.com/300x200',
    badges: (person) => [
      {
        label: person.status === 'active' ? 'פעיל' : person.status === 'inactive' ? 'לא פעיל' : 'ממתין',
        color: person.status === 'active' ? '#2e7d32' : person.status === 'inactive' ? '#c62828' : '#e65100',
      },
    ],
    actions: (person) => (
      <>
        <button style={cardActionButtonStyle}>✉️ שלח מייל</button>
        <button style={cardActionButtonStyle}>📞 התקשר</button>
      </>
    ),
  });

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <EntityViewLayout<Person>
        // הגדרות בסיסיות
        title="אנשי קשר"
        entityType="people"
        columns={personColumns}
        config={config}
        
        // Handlers
        onRowClick={handleRowClick}
        onSelectionChange={handleSelectionChange}
        
        // פעולות מותאמות אישית
        customActions={
          <>
            <button style={customActionButtonStyle}>
              ➕ הוסף איש קשר
            </button>
            <button style={customActionButtonStyle}>
              📧 שלח מייל לנבחרים
            </button>
          </>
        }
        
        // אפשרויות
        enableExport={true}
        enableImport={true}
        enableBulkActions={true}
        availableViewModes={['grid', 'cards']}
        
        // תצוגת כרטיסיות מותאמת אישית
        renderCards={(props) => (
          <EntityCards
            {...props}
            renderCard={renderPersonCard}
            columns={3}
            gap={16}
            minCardWidth={300}
            maxCardWidth={400}
          />
        )}
      />
    </div>
  );
}

// ==================== דוגמה עם Server-Side ====================
export function PeopleServerSideExample() {
  // פונקציה לטעינת נתונים מהשרת
  const fetchPeopleFromServer = async (params: any) => {
    // כאן תשלח בקשה לשרת שלך
    const response = await fetch('/api/people', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: params.filters,
        search: params.searchQuery,
        sort: params.sorting,
        page: params.pagination.page,
        pageSize: params.pagination.pageSize,
      }),
    });

    const data = await response.json();
    
    return {
      data: data.items,
      totalRecords: data.totalCount,
      totalPages: Math.ceil(data.totalCount / params.pagination.pageSize),
    };
  };

  const config = useEntityView<Person>({
    entityType: 'people',
    serverSide: true,
    onFetchData: fetchPeopleFromServer,
    initialPageSize: 20,
  });

  return (
    <EntityViewLayout<Person>
      title="אנשי קשר (Server-Side)"
      entityType="people"
      columns={personColumns}
      config={config}
    />
  );
}

// ==================== דוגמה עם פילטרים מותאמים אישית ====================
export function PeopleWithFiltersExample() {
  const config = useEntityView<Person>({
    entityType: 'people',
    initialData: samplePeople,
  });

  // הוסף פילטר מותאם אישית
  const handleAddStatusFilter = (status: Person['status']) => {
    config.addFilter({
      id: `status-${Date.now()}`,
      field: 'status',
      operator: 'equals',
      value: status,
      label: `סטטוס: ${status === 'active' ? 'פעיל' : status === 'inactive' ? 'לא פעיל' : 'ממתין'}`,
      color: status === 'active' ? '#2e7d32' : status === 'inactive' ? '#c62828' : '#e65100',
    });
  };

  return (
    <EntityViewLayout<Person>
      title="אנשי קשר עם פילטרים"
      entityType="people"
      columns={personColumns}
      config={config}
      
      customActions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => handleAddStatusFilter('active')} style={filterButtonStyle}>
            🟢 פעילים בלבד
          </button>
          <button onClick={() => handleAddStatusFilter('pending')} style={filterButtonStyle}>
            🟡 ממתינים בלבד
          </button>
          <button onClick={() => handleAddStatusFilter('inactive')} style={filterButtonStyle}>
            🔴 לא פעילים בלבד
          </button>
        </div>
      }
    />
  );
}

// ==================== Styles ====================
const customActionButtonStyle: React.CSSProperties = {
  padding: '8px 16px',
  border: 'none',
  borderRadius: '6px',
  backgroundColor: '#1976d2',
  color: 'white',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 500,
  transition: 'all 0.2s',
};

const cardActionButtonStyle: React.CSSProperties = {
  padding: '6px 12px',
  border: '1px solid #d0d0d0',
  borderRadius: '4px',
  backgroundColor: 'white',
  cursor: 'pointer',
  fontSize: '12px',
};

const filterButtonStyle: React.CSSProperties = {
  padding: '6px 12px',
  border: '1px solid #d0d0d0',
  borderRadius: '6px',
  backgroundColor: 'white',
  cursor: 'pointer',
  fontSize: '13px',
};
