const XLSX = require('xlsx');

const data = [
    ['First Name', 'Last Name', 'Email', 'Phone', 'Status', 'Tags', 'Job Title', 'Company', 'Notes'],
    ['דני', 'לוי', 'dani.l@example.com', '054-1111111', 'lead', 'VIP, כנס 2024', 'מנהל מכירות', 'טק ויז\'ן', 'לקוח פוטנציאלי חשוב'],
    ['מיכל', 'כהן', 'michal.c@test.co.il', '052-2222222', 'customer', 'תל אביב', 'מנכ"לית', 'חדשנות בע"מ', 'לקוחה קיימת מ-2023'],
    ['אבי', 'אברהמי', 'avi.a@startup.com', '050-3333333', 'prospect', '', 'מפתח תוכנה', 'סטארטאפ ישראל', 'מעוניין בשדרוג'],
    ['רונית', 'שחר', 'ronit.s@enterprise.org', '053-4444444', 'lead', 'B2B', 'סמנכ"ל שיווק', 'אנטרפרייז סולושנס', 'נפגשנו בתערוכה'],
    ['יעל', 'בר', 'yael.bar@gmail.com', '058-5555555', 'lead', 'פרטי', 'יועצת', 'עצמאית', ''],
];

const ws = XLSX.utils.aoa_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Contacts');

XLSX.writeFile(wb, 'test_import_valid.xlsx');
console.log('Created test_import_valid.xlsx');
