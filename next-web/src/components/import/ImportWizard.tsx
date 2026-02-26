// src/components/import/ImportWizard.tsx
'use client';

import { useImportStore } from '@/stores/importStore';
import { ImportProgress } from '@/components/import/ImportProgress';
import { FileUploadStep } from '@/components/import/steps/FileUploadStep';
import { ColumnMappingStep } from '@/components/import/steps/ColumnMappingStep';
import { PreviewStep } from '@/components/import/steps/PreviewStep';
import { ResultsStep } from '@/components/import/steps/ResultsStep';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { History } from 'lucide-react';

export function ImportWizard() {
    const { currentStep } = useImportStore();

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold tracking-tight">אשף ייבוא אנשי קשר</h1>
                <Link
                    href="/dashboard/import/history"
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                    <History className="w-4 h-4" />
                    היסטוריית ייבואים
                </Link>
            </div>

            <ImportProgress currentStep={currentStep} />

            <Card className="mt-8 shadow-sm">
                <CardContent className="p-8">
                    {currentStep === 1 && <FileUploadStep />}
                    {currentStep === 2 && <ColumnMappingStep />}
                    {currentStep === 3 && <PreviewStep />}
                    {currentStep === 4 && <ResultsStep />}
                </CardContent>
            </Card>
        </div>
    );
}
