// src/app/api/v1/import/templates/route.ts
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET() {
    try {
        // Create a new workbook
        const wb = XLSX.utils.book_new();

        // Template Headers
        const headers = [
            'first_name', 'last_name', 'email', 'phone',
            'status', 'tags', 'job_title', 'company_name', 'notes'
        ];

        // Example Rows
        const data = [
            headers,
            ["ישראל", "ישראלי", "israel@example.com", "050-1234567", "lead", "VIP;כנס", "מנכ\"ל", "חברה בע\"מ", "הערה לדוגמה"],
            ["שרה", "כהן", "sara@example.com", "052-9876543", "customer", "לקוח", "סמנכ\"לית", "ספק בע\"מ", "-"]
        ];

        const ws = XLSX.utils.aoa_to_sheet(data);

        // Add sheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, "People");

        // Write to buffer
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        return new NextResponse(buf, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename="now-system-import-template.xlsx"',
            },
        });
    } catch (error) {
        console.error('Error generating template:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
