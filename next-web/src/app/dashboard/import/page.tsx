// src/app/[locale]/(dashboard)/import/page.tsx
import { ImportWizard } from '@/components/import/ImportWizard';

export const metadata = {
    title: 'ייבוא נתונים | NOW CRM',
    description: 'אשף ייבוא אנשי קשר למערכת NOW CRM',
};

export default function ImportPage() {
    return (
        <div className="container mx-auto max-w-7xl h-full p-4 md:p-8">
            <ImportWizard />
        </div>
    );
}
