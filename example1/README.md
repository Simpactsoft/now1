# Entity View System - מערכת תצוגה אוניברסלית

מערכת מקיפה לתצוגה וניהול ישויות (Entities) עם תמיכה בגריד, כרטיסיות ותגיות.

## 📦 התקנה

```bash
npm install ag-grid-react ag-grid-community
```

## 🏗️ ארכיטקטורה

המערכת מורכבת מ-3 שכבות עיקריות:

### 1️⃣ State Management - `useEntityView`
Hook מרכזי שמנהל את כל ה-State:
- סינונים וחיפוש
- מיון ודפדוף
- בחירת רשומות
- תצוגות שמורות

### 2️⃣ Layout Container - `EntityViewLayout`
קומפוננט המעטפת שמספק:
- Toolbar עם פעולות
- שורת חיפוש וסינון
- החלפת תצוגות (Grid/Cards/Tags)
- Smart Chips לפילטרים פעילים

### 3️⃣ View Components
- **EntityAgGrid** - תצוגת טבלה עם ag-grid
- **EntityCards** - תצוגת כרטיסיות
- **Custom Views** - תצוגות מותאמות אישית

## 🚀 שימוש בסיסי

### דוגמה פשוטה

```tsx
import { useEntityView, EntityViewLayout } from './entity-view';

interface Person {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive';
}

function PeoplePage() {
  // 1. הגדר את ה-Hook
  const config = useEntityView<Person>({
    entityType: 'people',
    initialData: myPeople,
    initialPageSize: 20,
  });

  // 2. הגדר עמודות
  const columns = [
    { field: 'name', headerName: 'שם' },
    { field: 'email', headerName: 'אימייל' },
    { field: 'status', headerName: 'סטטוס' },
  ];

  // 3. רנדר
  return (
    <EntityViewLayout
      title="אנשי קשר"
      entityType="people"
      columns={columns}
      config={config}
      onRowClick={(person) => console.log(person)}
    />
  );
}
```

## 📊 תכונות מתקדמות

### Client-Side vs Server-Side

#### Client-Side (כל הנתונים בזיכרון)
```tsx
const config = useEntityView({
  entityType: 'people',
  initialData: allPeople, // כל הנתונים
  serverSide: false, // ברירת מחדל
});
```

**מתאים ל:**
- עד ~1,000 רשומות
- נתונים סטטיים
- פרוטוטייפים מהירים

#### Server-Side (שליפה מהשרת)
```tsx
const fetchData = async (params) => {
  const response = await fetch('/api/people', {
    method: 'POST',
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

const config = useEntityView({
  entityType: 'people',
  serverSide: true,
  onFetchData: fetchData,
  initialPageSize: 50,
});
```

**מתאים ל:**
- יותר מ-1,000 רשומות
- נתונים דינמיים
- אפליקציות production

### הוספת פילטרים מותאמים

```tsx
// הוסף פילטר ידנית
config.addFilter({
  id: 'status-active',
  field: 'status',
  operator: 'equals',
  value: 'active',
  label: 'סטטוס: פעיל',
  color: '#2e7d32',
});

// הסר פילטר
config.removeFilter('status-active');

// נקה את כל הפילטרים
config.clearFilters();
```

### אופרטורי סינון זמינים

```typescript
type FilterOperator = 
  | 'equals'        // שווה ל
  | 'notEquals'     // לא שווה ל
  | 'contains'      // מכיל
  | 'notContains'   // לא מכיל
  | 'greaterThan'   // גדול מ
  | 'lessThan'      // קטן מ
  | 'between'       // בטווח
  | 'in'            // ברשימה
  | 'isEmpty'       // ריק
  | 'isNotEmpty';   // לא ריק
```

### תצוגת כרטיסיות מותאמת אישית

```tsx
import { createDefaultCardRenderer } from './entity-view';

const renderPersonCard = createDefaultCardRenderer<Person>({
  title: (person) => person.name,
  subtitle: (person) => person.role,
  description: (person) => person.bio,
  image: (person) => person.avatar,
  badges: (person) => [
    { label: person.status, color: getStatusColor(person.status) }
  ],
  actions: (person) => (
    <>
      <button onClick={() => sendEmail(person)}>✉️ מייל</button>
      <button onClick={() => call(person)}>📞 התקשר</button>
    </>
  ),
});

<EntityViewLayout
  {...props}
  renderCards={(props) => (
    <EntityCards
      {...props}
      renderCard={renderPersonCard}
      columns={3}
      gap={16}
    />
  )}
/>
```

### עמודות מתקדמות

```tsx
const columns: ColumnDef<Person>[] = [
  // עמודה רגילה
  {
    field: 'name',
    headerName: 'שם מלא',
    width: 200,
    sortable: true,
    filterable: true,
  },
  
  // עמודה עם Custom Renderer
  {
    field: 'avatar',
    headerName: 'תמונה',
    width: 100,
    cellRenderer: (params) => (
      <img src={params.value} style={{ width: 40, height: 40, borderRadius: '50%' }} />
    ),
  },
  
  // עמודה עם Value Formatter
  {
    field: 'salary',
    headerName: 'משכורת',
    valueFormatter: (value) => `${value.toLocaleString('he-IL')} ₪`,
  },
  
  // עמודה עם Value Getter
  {
    field: 'fullName',
    headerName: 'שם מלא',
    valueGetter: (data) => `${data.firstName} ${data.lastName}`,
  },
  
  // עמודה עם Checkbox
  {
    field: 'id',
    headerName: 'בחר',
    checkboxSelection: true,
    width: 80,
  },
  
  // עמודה נעוצה (Pinned)
  {
    field: 'actions',
    headerName: 'פעולות',
    pinned: 'right',
    cellRenderer: (params) => (
      <button onClick={() => edit(params.data)}>✏️</button>
    ),
  },
];
```

### תצוגות שמורות (Saved Views)

```tsx
// שמור תצוגה נוכחית
await config.saveView('תצוגת לקוחות פעילים');

// טען תצוגה שמורה
await config.loadView(viewId);

// מחק תצוגה
await config.deleteView(viewId);

// קבל רשימת תצוגות שמורות
const savedViews = JSON.parse(
  localStorage.getItem('savedViews_people') || '[]'
);
```

### בחירת רשומות

```tsx
// בחר רשומה בודדת
config.toggleSelection(personId);

// בחר הכל
config.selectAll();

// נקה בחירה
config.clearSelection();

// קבל את הרשומות הנבחרות
const selectedPeople = config.data.filter(person => 
  config.selectedIds.includes(person.id)
);

// Handler לשינוי בחירה
<EntityViewLayout
  {...props}
  onSelectionChange={(selectedItems) => {
    console.log('נבחרו:', selectedItems);
  }}
/>
```

### פעולות Bulk

```tsx
<EntityViewLayout
  {...props}
  enableBulkActions={true}
  customActions={
    config.selectedIds.length > 0 ? (
      <>
        <button onClick={() => deleteSelected(config.selectedIds)}>
          🗑️ מחק נבחרים
        </button>
        <button onClick={() => exportSelected(config.selectedIds)}>
          📥 ייצא נבחרים
        </button>
      </>
    ) : null
  }
/>
```

## 🎨 התאמה אישית (Styling)

### תמות ag-grid

```tsx
<EntityAgGrid
  {...props}
  theme="alpine"        // ברירת מחדל
  theme="alpine-dark"   // כהה
  theme="balham"        // מודרני
  theme="material"      // Material Design
/>
```

### CSS מותאם אישית

```tsx
<EntityViewLayout
  {...props}
  className="my-custom-view"
  style={{ 
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
  }}
/>
```

### RTL Support

המערכת תומכת ב-RTL מובנה:
- ag-grid עם `enableRtl={true}`
- כל הטקסטים בעברית
- סידור מימין לשמאל

## 📱 Responsive Design

```tsx
// זיהוי מובייל
const isMobile = useMediaQuery('(max-width: 768px)');

<EntityViewLayout
  {...props}
  defaultViewMode={isMobile ? 'cards' : 'grid'}
  availableViewModes={isMobile ? ['cards', 'list'] : ['grid', 'cards', 'tags']}
/>
```

## ⚡ אופטימיזציות

### 1. Memoization
כל הקומפוננטים עטופים ב-`React.memo`:

```tsx
export const EntityAgGrid = React.memo(EntityAgGridInner);
export const EntityCards = React.memo(EntityCardsInner);
```

### 2. Virtual Scrolling
ag-grid תומך ב-Virtual Scrolling מובנה - מרנדר רק שורות גלויות.

### 3. Debounced Search
```tsx
import { useDebouncedCallback } from 'use-debounce';

const debouncedSearch = useDebouncedCallback(
  (query) => config.setSearchQuery(query),
  300
);
```

### 4. Code Splitting
```tsx
import { lazy, Suspense } from 'react';

const EntityViewLayout = lazy(() => import('./entity-view'));

<Suspense fallback={<Loading />}>
  <EntityViewLayout {...props} />
</Suspense>
```

## 🔒 TypeScript Support

המערכת כתובה ב-TypeScript המלא עם Generics:

```tsx
// טיפוס מותאם אישית
interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
}

// שימוש עם Generics
const config = useEntityView<Product>({...});
const columns: ColumnDef<Product>[] = [...];

<EntityViewLayout<Product>
  columns={columns}
  config={config}
/>
```

## 🧪 בדיקות (Testing)

### Unit Tests
```tsx
import { renderHook } from '@testing-library/react-hooks';
import { useEntityView } from './useEntityView';

test('should filter data correctly', () => {
  const { result } = renderHook(() => useEntityView({
    entityType: 'test',
    initialData: testData,
  }));
  
  result.current.addFilter({
    field: 'status',
    operator: 'equals',
    value: 'active',
  });
  
  expect(result.current.filteredData.length).toBe(5);
});
```

## 📚 דוגמאות נוספות

ראה את קובץ `Example.tsx` לדוגמאות מלאות:
- דוגמה בסיסית
- Server-Side
- פילטרים מותאמים אישית
- כרטיסיות מעוצבות

## 🛠️ פתרון בעיות

### הגריד לא מוצג
וודא שהתקנת את ag-grid:
```bash
npm install ag-grid-react ag-grid-community
```

ויבאת את ה-CSS:
```tsx
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
```

### הנתונים לא מתעדכנים
וודא ש-`onFetchData` מוגדרת נכון ב-Server-Side mode.

### בעיות Performance
- השתמש ב-Server-Side לנתונים רבים
- הפעל Virtual Scrolling
- הגבל את מספר העמודות
- השתמש ב-Pagination

## 📄 רישיון

MIT

## 🤝 תרומה

Pull Requests מתקבלים בברכה!

## 📧 יצירת קשר

לשאלות ובעיות, פתחו Issue ב-GitHub.
