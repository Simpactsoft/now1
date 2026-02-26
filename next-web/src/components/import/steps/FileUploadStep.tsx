// src/components/import/steps/FileUploadStep.tsx
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useImportStore } from '@/stores/importStore';
import { parseImportFile } from '@/lib/importParser';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function FileUploadStep() {
    const { setFile, nextStep } = useImportStore();
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const onDrop = useCallback(async (acceptedFiles: File[], fileRejections: any[]) => {
        setError(null);

        if (fileRejections.length > 0) {
            const rejection = fileRejections[0];
            if (rejection.errors[0]?.code === 'file-too-large') {
                setError('הקובץ חורג מהגודל המקסימלי המותר (10MB).');
            } else {
                setError('סוג קובץ לא נתמך. אנא העלה קובץ CSV או Excel.');
            }
            return;
        }

        const file = acceptedFiles[0];
        if (!file) return;

        setIsLoading(true);
        try {
            const parsed = await parseImportFile(file);
            setFile(file, parsed.headers, parsed.rows, parsed.rowCount);
            nextStep();
        } catch (err: any) {
            setError(err.message || 'שגיאה בפענוח הקובץ.');
        } finally {
            setIsLoading(false);
        }
    }, [setFile, nextStep]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'text/csv': ['.csv'],
            'text/tab-separated-values': ['.tsv'],
            'application/vnd.ms-excel': ['.xls'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
        },
        maxSize: 10 * 1024 * 1024, // 10MB
        multiple: false
    });

    return (
        <div className="flex flex-col space-y-6">
            <div className="text-center">
                <h2 className="text-2xl font-bold tracking-tight">העלאת קובץ אנשי קשר</h2>
                <p className="text-muted-foreground mt-2">
                    העלה קובץ Excel או CSV עד 10MB בפורמט התואם לייבוא אנשי קשר.
                </p>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>שגיאה בהעלאה</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div
                {...getRootProps()}
                className={`
                    border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
                    ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}
                    ${isLoading ? 'opacity-50 pointer-events-none' : ''}
                `}
            >
                <input {...getInputProps()} />

                <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="p-4 bg-primary/10 rounded-full">
                        {isLoading ? (
                            <File className="w-8 h-8 text-primary animate-pulse" />
                        ) : (
                            <UploadCloud className="w-8 h-8 text-primary" />
                        )}
                    </div>
                    <div>
                        <p className="text-lg font-medium">
                            {isDragActive ? 'שחרר את הקובץ כאן' : 'לחץ או גרור קובץ לכאן'}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                            תומך ב-XLSX, XLS, CSV ו-TSV.
                        </p>
                    </div>
                    {isLoading && (
                        <p className="text-sm text-primary font-medium">קורא נתונים...</p>
                    )}
                </div>
            </div>

            <div className="flex justify-between items-center bg-muted/50 p-4 rounded-lg">
                <div className="text-sm">
                    <span className="font-semibold">צריך עזרה?</span> הורד קובץ תבנית לדוגמה.
                </div>
                <Button variant="outline" size="sm" onClick={() => window.location.href = '/api/v1/import/templates'}>
                    הורד תבנית
                </Button>
            </div>
        </div>
    );
}
