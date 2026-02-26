// src/components/import/steps/ResultsStep.tsx
import { useImportStore } from '@/stores/importStore';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, RefreshCw, Download, AlertTriangle, History } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { downloadErrorReport } from '@/lib/importApi';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function ResultsStep() {
    const { importType, results, jobId, jobStatus, reset } = useImportStore();
    const router = useRouter();

    const entityLabels: Record<string, { name: string; route: string }> = {
        people: { name: 'אנשי קשר', route: '/dashboard/people' },
        organizations: { name: 'ארגונים', route: '/dashboard/organizations' },
        relationships: { name: 'קשרים', route: '/dashboard/people' },
    };
    const entity = entityLabels[importType] || entityLabels.people;

    if (jobStatus === 'failed') {
        return (
            <div className="flex flex-col items-center justify-center space-y-6 py-12">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">הייבוא נכשל</h2>
                <p className="text-muted-foreground text-center max-w-md">
                    אירעה שגיאה קריטית במהלך הייבוא המונעת את השלמתו.
                    אנא נסה שנית או העלה קובץ אחר.
                </p>
                <div className="flex gap-4 mt-8">
                    <Button onClick={reset} size="lg">נסה שוב</Button>
                </div>
            </div>
        );
    }

    if (!results) {
        return null;
    }

    const { created, updated, skipped, errors } = results;
    const isPerfect = errors === 0;

    return (
        <div className="flex flex-col space-y-8">
            <div className="text-center space-y-2">
                <div className="flex justify-center mb-4">
                    {isPerfect ? (
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-8 h-8 text-green-600" />
                        </div>
                    ) : (
                        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
                            <AlertTriangle className="w-8 h-8 text-orange-500" />
                        </div>
                    )}
                </div>
                <h2 className="text-2xl font-bold tracking-tight">סיכום תהליך הייבוא</h2>
                <p className="text-muted-foreground text-center max-w-md mx-auto">
                    {isPerfect ?
                        `כל הרשומות עובדו בהצלחה וללא שגיאות. ה${entity.name} זמינים כעת במערכת.` :
                        "תהליך הייבוא הסתיים, אך היו מספר שגיאות או כפילויות שיש לתת עליהן את הדעת."}
                </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="border rounded-lg p-4 bg-card flex flex-col items-center text-center">
                    <div className="text-3xl font-bold text-green-600 mb-1">{created}</div>
                    <div className="text-sm text-muted-foreground">נוצרו בהצלחה</div>
                </div>
                <div className="border rounded-lg p-4 bg-card flex flex-col items-center text-center">
                    <div className="text-3xl font-bold text-blue-600 mb-1">{updated}</div>
                    <div className="text-sm text-muted-foreground">עודכנו</div>
                </div>
                <div className="border rounded-lg p-4 bg-card flex flex-col items-center text-center">
                    <div className="text-3xl font-bold text-orange-500 mb-1">{skipped}</div>
                    <div className="text-sm text-muted-foreground">נדלגו (כפילויות)</div>
                </div>
                <div className="border rounded-lg p-4 bg-card flex flex-col items-center text-center">
                    <div className="text-3xl font-bold text-red-600 mb-1">{errors}</div>
                    <div className="text-sm text-muted-foreground">שגיאות</div>
                </div>
            </div>

            {errors > 0 && jobId && (
                <Alert className="bg-red-50 border-red-200">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertTitle className="text-red-800">דוח שגיאות זמין</AlertTitle>
                    <AlertDescription className="text-red-700 mt-2 flex items-center justify-between">
                        <span>
                            נמצאו {errors} שורות שלא יובאו עקב שגיאות ולידציה. הורד את הדוח לפרטים ותיקון.
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-white"
                            onClick={() => downloadErrorReport(jobId)}
                        >
                            <Download className="w-4 h-4 mr-2" />
                            הורד דוח CSV
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            <div className="flex justify-center gap-4 mt-8 pt-6 border-t">
                <Button variant="outline" onClick={reset}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    ייבא קובץ נוסף
                </Button>
                <Button variant="outline" onClick={() => router.push('/dashboard/import/history')}>
                    <History className="w-4 h-4 mr-2" />
                    היסטוריית ייבואים
                </Button>
                <Button onClick={() => router.push(entity.route)}>
                    סיום ומעבר ל{entity.name}
                </Button>
            </div>
        </div>
    );
}
