# System Capabilities & Roadmap / יכולות המערכת ומפת דרכים

## 🇮🇱 עברית (Hebrew)

### ✅ קיים היום (Current Capabilities)

**1. אבטחה ותשתית (Security & Infra):**
*   [x] **בידוד דיירים (Multi-Tenancy):** הפרדה מוחלטת ברמת RLS (לפי `tenant_id`).
*   [x] **אימות משתמשים:** הזדהות מאובטחת (Supabase Auth) וניהול סשנים.
*   [x] **מודל נתונים CTI:** ארכיטקטורת `Cards` (כרטיס אב לכל ישות) – תשתית גמישה לאיש/ארגון.
*   [x] **מניעת כפילויות:** מנגנון `unique_identifiers` לאכיפת ייחודיות אימייל/טלפון.
*   [x] **אבטחה היררכית (Deep Security):** לוגיקת RLS מלאה ("Cone of Visibility") ע"ב `ltree`.
*   [x] **Deal Registration:** מניעת קונפליקטים בין סוכנים (Lead Uniqueness).

**2. מודול CRM (אנשים וארגונים):**
*   [x] **ניהול אנשים:** יצירה, עריכה, ומחיקה של אנשי קשר.
*   [x] **ניהול תפקידים:** קישור אדם לארגון עם תפקיד (`party_memberships`).
*   [x] **תגיות (Tags):** ניהול תגיות דינמי (הוספה/הסרה) + סינון מתקדם.
*   [x] **שדות מותאמים אישית:** תמיכה בשדות דינמיים (`custom_fields`) מסוג טקסט, מספר, תאריך.
*   [x] **רשימות בחירה (Picklists):** תמיכה בסיסית בשדות בחירה.

**3. גריד וחיפוש (Grid & Search):**
*   [x] **גריד "טיפש" (Server-Side):** טעינה אינסופית, מיון וסינון שמבוצעים בשרת (ביצועים גבוהים).
*   [x] **חיפוש היברידי:** חיפוש טקסט חופשי משולב (Prefix + Fuzzy) לתוצאות מהירות.
*   [x] **סינון מתקדם:** תמיכה במסננים מרובים (Tags, Role, Status) בלוגיקה של OR ("או").
*   [x] **תצוגות (Views):** מעבר בין תצוגת רשימה לתצוגת כרטיסים.

**4. ממשק וחווית משתמש (UI/UX):**
*   [x] **ריבוי שפות (i18n):** תשתית מלאה לעברית/אנגלית (RTL/LTR).
*   [x] **עריכה מהירה:** עריכת שדות (סטטוס, תפקיד) ישירות מכותרת הפרופיל.
*   [x] **Chip Filters:** ממשק סינון מודרני מבוסס תגיות חכמות.

---

### 🚀 עתיד (Future Roadmap)

**1. אבטחה היררכית (Deep Security):**
*   [x] **Cone of Visibility:** הרשאות היררכיות (מפיץ צופה בדילר).
*   [x] **Ltree Optimization:** שליפות עץ ארגוני במילי-שניות.
*   [x] **Deal Registration:** מניעת קונפליקטים בין סוכנים.

**2. תשתית ERP ופיננסים:**
*   [ ] **Multi-Entity:** תמיכה בחברות בנות/ישויות משפטיות.
*   [ ] **Currencies & Tax:** ניהול מטבעות ומיסים גלובלי.
*   [ ] **Audit Logs:** יומן שינויים מלא לכל פעולה.

**3. פורטל ושירות עצמי:**
*   [ ] **Customer Portal:** גישה ישירה ללקוח לנתוניו.
*   [ ] **Self-Service Actions:** הלקוח מעדכן פרטים ומסמכים.

**4. מתקדם (Advanced) - ניהול נתונים:**
*   [ ] **Attribute Manager:** מנהל שדות מורחב - צפייה בשדות מערכת (System Fields) ושדות נעולים.
*   [ ] **Global Picklists:** ניהול רשימות בחירה משותפות (ערים, מקצועות) לשימוש חוזר.
*   [ ] **Workflow Engine:** מנוע מצבים לאכיפת תהליכים עסקיים (BPM).
*   [ ] **Connectivity (API/Webhooks):** מנגנון Webhooks יוצאים וניהול API Keys לאינטגרציות (Zapier/External ERP).
*   [ ] **Compliance:** כלי GDPR, מחיקת מידע לפי מדיניות (Retention), והצפנה.

---
---

## 🇺🇸 English

### ✅ Current Capabilities

**1. Security & Infrastructure:**
*   [x] **Multi-Tenancy:** Complete isolation via RLS (based on `tenant_id`).
*   [x] **User Authentication:** Secure identity (Supabase Auth) and session management.
*   [x] **CTI Data Model:** `Cards` architecture (Parent Card for every entity) – flexible infrastructure for Person/Org.
*   [x] **Deduplication:** `unique_identifiers` mechanism to enforce unique Email/Phone.
*   [x] **Hierarchical Security:** Full RLS logic ("Cone of Visibility") based on `ltree`.
*   [x] **Deal Registration:** Agent conflict prevention (Lead Uniqueness).

**2. CRM Module (People & Organizations):**
*   [x] **People Management:** Create, Edit, and Delete contacts.
*   [x] **Role Management:** Link Person to Organization with a role (`party_memberships`).
*   [x] **Tags:** Dynamic tag management (Add/Remove) + Advanced filtering.
*   [x] **Custom Fields:** Support for dynamic fields (`custom_fields`) - Text, Number, Date.
*   [x] **Picklists:** Basic support for selection lists.

**3. Grid & Search:**
*   [x] **"Dumb" Grid (Server-Side):** Infinite scroll, Sorting, and Filtering executed on the server (High Performance).
*   [x] **Hybrid Search:** Combined Free-Text search (Prefix + Fuzzy) for fast results.
*   [x] **Advanced Filtering:** Support for multiple filters (Tags, Role, Status) with OR logic.
*   [x] **Views:** Toggle between List View and Card View.

**4. UI/UX:**
*   [x] **Internationalization (i18n):** Full infrastructure for Hebrew/English (RTL/LTR).
*   [x] **Quick Edit:** Edit fields (Status, Role) directly from the Profile Header.
*   [x] **Chip Filters:** Modern smart-tag based filtering interface.

---

### 🚀 Future Roadmap

**1. Hierarchical Security (Deep Security):**
*   [x] **Cone of Visibility:** Hierarchical permissions (Distributor sees Dealer).
*   [x] **Ltree Optimization:** Millisecond-speed organizational tree queries.
*   [x] **Deal Registration:** Prevent conflicts between agents.

**2. ERP & Finance Infrastructure:**
*   [ ] **Multi-Entity:** Support for Subsidiaries / Legal Entities.
*   [ ] **Currencies & Tax:** Global Currency and Tax management.
*   [ ] **Audit Logs:** Full change log for every action.

**3. Portal & Self-Service:**
*   [ ] **Customer Portal:** Direct customer access to their data.
*   [ ] **Self-Service Actions:** Customer updates details and documents.

**4. Advanced - Data Management:**
*   [ ] **Attribute Manager:** Enhanced manager - View System Fields and Locked Fields.
*   [ ] **Global Picklists:** Reusable shared picklists (Cities, Occupations).
*   [ ] **Workflow Engine:** State machine for enforcing business processes (BPM).
*   [ ] **Connectivity (API/Webhooks):** Outbound Webhooks and API Key management for integrations.
*   [ ] **Compliance:** GDPR tools, Data Retention policies, and Encryption features.

**5. Deep Infrastructure - *Added post-reviews (Combined)*:**
*   [x] **RBAC Engine:** Declarative permission management (Read/Write/Delete definitions).
*   [x] **Auditing:** Full change history (`audit_logs`) tracking specific field changes.
*   [x] **Unified Activity Stream:** Centralized timeline infrastructure per entity.
*   [x] **Input Masks & Validation:** DB-level enforcement (Regex, Min/Max) for custom fields.
*   [ ] **Soft Delete:** Recoverability logic.
*   [ ] **Soft Delete:** Recoverability logic.
*   [ ] **Workflow Engine:** State machine for enforcing business processes (BPM).
*   [ ] **Connectivity (API/Webhooks):** Outbound Webhooks and API Key management for integrations.
*   [ ] **Compliance:** GDPR tools, Data Retention policies, and Encryption features.

**5. תשתית עמוקה (Deep Infrastructure) - *נוסף בעקבות סקירה א' ו-ב' (סקירה משולבת)*:**
*   [x] **RBAC Engine:** ניהול הרשאות דקלרטיבי (מי יכול לערוך/למחוק).
*   [x] **Auditing:** היסטוריית שינויים מלאה (`audit_logs`) עם פירוט שדות שהשתנו.
*   [x] **Unified Activity Stream:** יומן פעולות מרכזי לכל ישות (Timeline infrastructure).
*   [x] **Input Masks & Validation:** אכיפת חוקי קלט (למשל Regex, אורך) ברמת DB.
*   [ ] **Soft Delete:** מחיקה רכה (שחזור) לכל טבלה.
*   [ ] **Soft Delete:** מחיקה רכה (שחזור) לכל טבלה.
*   [ ] **Workflow Engine:** מנוע מצבים לאכיפת תהליכים עסקיים (BPM).
*   [ ] **Connectivity (API/Webhooks):** מנגנון Webhooks יוצאים וניהול API Keys לאינטגרציות (Zapier/External ERP).
*   [ ] **Compliance:** כלי GDPR, מחיקת מידע לפי מדיניות (Retention), והצפנה.
