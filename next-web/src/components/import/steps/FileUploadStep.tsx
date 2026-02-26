// src/components/import/steps/FileUploadStep.tsx
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File, AlertCircle, Users, Building2, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useImportStore, ImportType } from '@/stores/importStore';
import { parseImportFile } from '@/lib/importParser';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const IMPORT_TYPES: { value: ImportType; label: string; description: string; icon: typeof Users }[] = [
    { value: 'people', label: 'אנשי קשר', description: 'שם, אימייל, טלפון, תפקיד', icon: Users },
    { value: 'organizations', label: 'ארגונים', description: 'שם חברה, תעשייה, גודל', icon: Building2 },
    { value: 'relationships', label: 'קשרים', description: 'אימייל ← ארגון, סוג קשר', icon: Link2 },
];

export function FileUploadStep() {
    const { importType, setImportType, setFile, nextStep } = useImportStore();
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

    const currentType = IMPORT_TYPES.find(t => t.value === importType) || IMPORT_TYPES[0];

    return (
        <div className="flex flex-col space-y-6">
            <div className="text-center">
                <h2 className="text-2xl font-bold tracking-tight">אשף ייבוא נתונים</h2>
                <p className="text-muted-foreground mt-2">
                    בחר את סוג הנתונים לייבוא והעלה קובץ Excel או CSV.
                </p>
            </div>

            {/* Entity Type Selector */}
            <div className="grid grid-cols-3 gap-3">
                {IMPORT_TYPES.map(type => {
                    const Icon = type.icon;
                    const isSelected = importType === type.value;
                    return (
                        <button
                            key={type.value}
                            onClick={() => setImportType(type.value)}
                            className={`
                                flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer
                                ${isSelected
                                    ? 'border-primary bg-primary/5 shadow-sm'
                                    : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30'
                                }
                            `}
                        >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSelected ? 'bg-primary/15' : 'bg-muted'}`}>
                                <Icon className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                            </div>
                            <div className="text-center">
                                <div className={`text-sm font-semibold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                                    {type.label}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                    {type.description}
                                </div>
                            </div>
                        </button>
                    );
                })}
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
                            {isDragActive ? 'שחרר את הקובץ כאן' : `העלה קובץ ${currentType.label}`}
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
