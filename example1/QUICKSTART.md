# מדריך התחלה מהירה 🚀

## 📁 מבנה הקבצים

```
entity-view/
├── types.ts                  # טיפוסים מרכזיים
├── useEntityView.ts          # Hook לניהול State
├── EntityViewLayout.tsx      # קומפוננט המעטפת
├── EntityAgGrid.tsx          # תצוגת Grid
├── EntityCards.tsx           # תצוגת כרטיסיות
├── Example.tsx               # דוגמאות שימוש מלאות
├── index.ts                  # ייצוא כל הקומפוננטים
└── README.md                 # תיעוד מלא
```

## ⚡ התחלה ב-3 שלבים

### 1️⃣ העתק את התיקייה לפרויקט שלך

```bash
cp -r entity-view src/components/
```

### 2️⃣ התקן תלויות

```bash
npm install ag-grid-react ag-grid-community
```

### 3️⃣ השתמש!

```tsx
// App.tsx
import { useEntityView, EntityViewLayout } from './components/entity-view';

interface Person {
  id: string;
  name: string;
  email: string;
}

function App() {
  const config = useEntityView<Person>({
    entityType: 'people',
    initialData: myPeople,
  });

  const columns = [
    { field: 'name', headerName: 'שם' },
    { field: 'email', headerName: 'אימייל' },
  ];

  return (
    <EntityViewLayout
      title="אנשי קשר"
      entityType="people"
      columns={columns}
      config={config}
    />
  );
}
```

## 🎯 תכונות מרכזיות

✅ תמיכה ב-Grid, Cards ו-Tags  
✅ חיפוש וסינון מתקדם  
✅ Client-Side ו-Server-Side  
✅ Pagination אוטומטי  
✅ בחירה מרובה  
✅ תצוגות שמורות  
✅ TypeScript מלא  
✅ RTL Support  
✅ Dark Mode (ag-grid)  
✅ Responsive  

## 📚 למידע נוסף

ראה את הקבצים:
- `README.md` - תיעוד מלא
- `Example.tsx` - דוגמאות מפורטות

## 💡 טיפים

1. **התחל עם Client-Side** - קל יותר לפיתוח ראשוני
2. **עבור ל-Server-Side** - כשיש לך יותר מ-1000 רשומות
3. **התאם אישית** - השתמש ב-`renderCard` ו-`cellRenderer` ליצירת UI מיוחד
4. **שמור תצוגות** - למשתמשים שרוצים להגדיר פילטרים מועדפים

## 🔧 בעיות נפוצות

**הגריד לא מוצג?**
→ וודא שיבאת את קבצי ה-CSS של ag-grid

**הנתונים לא מתעדכנים?**
→ בדוק ש-`serverSide: true` ו-`onFetchData` מוגדרים נכון

**איטיות?**
→ עבור ל-Server-Side או הפחת את מספר העמודות

זקוק לעזרה? פתח Issue או שלח שאלה! 💬
