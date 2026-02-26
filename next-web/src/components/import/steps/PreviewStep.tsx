// src/components/import/steps/PreviewStep.tsx
import { useEffect, useMemo, useState } from 'react';
import { useImportStore, ValidationResult } from '@/stores/importStore';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { startImport } from '@/lib/importApi';

export function PreviewStep() {
    const {
        rawRows,
        columnMapping,
        fileHeaders,
        duplicatePolicy,
        setDuplicatePolicy,
        setValidationResults,
        validationResults,
        setJobId,
        setJobStatus,
        setResults,
        nextStep,
        prevStep
    } = useImportStore();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    // Build the mapped data structure expected by the API
    const mappedData = useMemo(() => {
        return rawRows.map(row => {
            const mappedRow: Record<string, string> = {};
            fileHeaders.forEach((header, idx) => {
                const mappedField = columnMapping[header];
                if (mappedField) {
                    mappedRow[mappedField] = row[idx];
                }
            });
            return mappedRow;
        });
    }, [rawRows, columnMapping, fileHeaders]);

    // Validation logic
    useEffect(() => {
        const results: ValidationResult[] = mappedData.map((row, index) => {
            const errors: { field: string; message: string }[] = [];
            const warnings: { field: string; message: string }[] = [];

            // Required fields
            if (!row.first_name?.trim()) {
                errors.push({ field: 'first_name', message: 'שם פרטי הוא שדה חובה' });
            }
            if (!row.last_name?.trim()) {
                errors.push({ field: 'last_name', message: 'שם משפחה הוא שדה חובה' });
            }

            // Email format
            if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) {
                errors.push({ field: 'email', message: 'כתובת אימייל לא תקינה' });
            }

            // Scientific notation (Excel corruption)
            if (row.phone && /^-?\d+\.?\d*[eE][+\-]?\d+$/.test(String(row.phone))) {
                warnings.push({
                    field: 'phone',
                    message: 'ערך נראה כמו כתיב מדעי — ייתכן שהושחת ע"י Excel'
                });
            }

            // Status validation
            const validStatuses = ['lead', 'customer', 'prospect', 'inactive'];
            if (row.status && !validStatuses.includes(row.status.toLowerCase().trim())) {
                warnings.push({
                    field: 'status',
                    message: `סטטוס לא מוכר: "${row.status}". ייקבע כ-"lead"`
                });
            }

            return {
                row: index,
                valid: errors.length === 0,
                errors,
                warnings,
            };
        });

        setValidationResults(results);
    }, [mappedData, setValidationResults]);

    const errorCount = validationResults.filter(r => !r.valid).length;
    const warningCount = validationResults.filter(r => r.warnings.length > 0).length;
    const validCount = validationResults.length - errorCount;

    // Display only first 10 rows for preview
    const previewRows = mappedData.slice(0, 10);
    const visibleColumns = Object.values(columnMapping).filter(Boolean) as string[];

    const handleImport = async () => {
        setIsSubmitting(true);
        setSubmitError(null);
        setJobStatus('processing');

        try {
            const res = await startImport({
                rows: mappedData,
                mapping: columnMapping,
                settings: {
                    duplicate_policy: duplicatePolicy,
                    default_status: 'lead'
                }
            });

            setJobId(res.job_id);
            setResults(res.results || null);
            setJobStatus('completed');
            nextStep();

        } catch (err: any) {
            setSubmitError(err.message || 'שגיאה בלתי צפויה בהפעלת הייבוא.');
            setJobStatus('failed');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">תצוגה מקדימה ואישור</h2>
                <p className="text-muted-foreground mt-2">
                    בדוק את הנתונים לפני הייבוא הסופי למערכת. מוצגות עד 10 שורות.
                </p>
            </div>

            <div className="border rounded-md p-4 bg-muted/50 flex flex-wrap gap-4 items-center justify-between">
                <div>
                    <p className="font-semibold text-lg">סה"כ שורות: {rawRows.length}</p>
                </div>
                <div className="flex gap-4">
                    <span className="flex items-center text-green-600">
                        <CheckCircle2 className="w-5 h-5 mr-1" />
                        תקינות: {validCount}
                    </span>
                    {warningCount > 0 && (
                        <span className="flex items-center text-orange-500">
                            <AlertTriangle className="w-5 h-5 mr-1" />
                            אזהרות: {warningCount}
                        </span>
                    )}
                    {errorCount > 0 && (
                        <span className="flex items-center text-red-600">
                            <AlertCircle className="w-5 h-5 mr-1" />
                            שגיאות: {errorCount}
                        </span>
                    )}
                </div>
            </div>

            <div className="border rounded-md overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-16">#</TableHead>
                            {visibleColumns.map(col => (
                                <TableHead key={col}>{col}</TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {previewRows.map((row, idx) => {
                            const rowValidation = validationResults[idx];
                            const hasError = !rowValidation?.valid;
                            const hasWarning = rowValidation?.warnings.length > 0;

                            return (
                                <TableRow
                                    key={idx}
                                    className={
                                        hasError ? 'bg-red-50/50' :
                                            hasWarning ? 'bg-orange-50/50' : ''
                                    }
                                >
                                    <TableCell className="font-medium">
                                        {idx + 1}
                                    </TableCell>
                                    {visibleColumns.map(col => {
                                        const fieldErr = rowValidation?.errors.find(e => e.field === col);
                                        const fieldWarn = rowValidation?.warnings.find(w => w.field === col);

                                        return (
                                            <TableCell key={`${idx}-${col}`}>
                                                <div className="flex items-center gap-1">
                                                    {row[col] || <span className="text-muted-foreground">-</span>}
                                                    {fieldErr && (
                                                        <span title={fieldErr.message}>
                                                            <AlertCircle className="w-4 h-4 text-red-600" />
                                                        </span>
                                                    )}
                                                    {fieldWarn && !fieldErr && (
                                                        <span title={fieldWarn.message}>
                                                            <AlertTriangle className="w-4 h-4 text-orange-500" />
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            <div className="space-y-4 border rounded-md p-6 bg-card">
                <h3 className="font-medium text-lg border-b pb-2 mb-4">ניהול כפילויות</h3>
                <RadioGroup
                    value={duplicatePolicy}
                    onValueChange={(val: any) => setDuplicatePolicy(val)}
                >
                    <div className="flex items-center space-x-2 space-x-reverse mb-3">
                        <RadioGroupItem value="manual" id="r1" />
                        <Label htmlFor="r1" className="cursor-pointer">
                            <span className="font-medium">הצג לי לבדיקה ידנית </span>
                            <span className="text-muted-foreground text-sm">(מומלץ)</span>
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse mb-3">
                        <RadioGroupItem value="update" id="r2" />
                        <Label htmlFor="r2" className="cursor-pointer">עדכן רשומות קיימות במידע חדש</Label>
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem value="skip" id="r3" />
                        <Label htmlFor="r3" className="cursor-pointer">דלג על רשומות כפולות (אל תייבא)</Label>
                    </div>
                </RadioGroup>
            </div>

            {submitError && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>שגיאת תקשורת</AlertTitle>
                    <AlertDescription>{submitError}</AlertDescription>
                </Alert>
            )}

            <div className="flex justify-between mt-8">
                <Button variant="outline" onClick={prevStep} disabled={isSubmitting}>
                    חזרה לאחור
                </Button>
                <Button onClick={handleImport} disabled={isSubmitting || validCount === 0}>
                    {isSubmitting ? 'מייבא נתונים...' : 'התחל ייבוא'}
                </Button>
            </div>
        </div>
    );
}
