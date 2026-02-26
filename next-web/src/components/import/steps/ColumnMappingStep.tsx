// src/components/import/steps/ColumnMappingStep.tsx
import { useEffect, useMemo, useState } from 'react';
import { useImportStore } from '@/stores/importStore';
import { autoMapColumns, getFieldsForType } from '@/lib/importAliases';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function ColumnMappingStep() {
    const { importType, fileHeaders, columnMapping, setMapping, nextStep, prevStep } = useImportStore();
    const [initialMappingDone, setInitialMappingDone] = useState(false);

    const { fields: importFields, aliases: fieldAliases } = useMemo(
        () => getFieldsForType(importType),
        [importType]
    );

    // Auto-map on first load
    useEffect(() => {
        if (!initialMappingDone && fileHeaders.length > 0 && Object.keys(columnMapping).length === 0) {
            const autoMapped = autoMapColumns(fileHeaders, fieldAliases);
            setMapping(autoMapped);
            setInitialMappingDone(true);
        }
    }, [fileHeaders, columnMapping, setMapping, initialMappingDone, fieldAliases]);

    const handleMapChange = (header: string, field: string | null) => {
        setMapping({
            ...columnMapping,
            [header]: field === 'null' ? null : field,
        });
    };

    // Validations for next button
    const { missingRequired, hasDuplicates, noEmailInfo } = useMemo(() => {
        const mappedFields = Object.values(columnMapping).filter(Boolean) as string[];

        const requiredFields = importFields.filter(f => f.required).map(f => f.value).filter(Boolean) as string[];
        const missing = requiredFields.filter(req => !mappedFields.includes(req));

        const duplicates = mappedFields.filter((item, index) => mappedFields.indexOf(item) !== index);

        const noEmailInfo = importType === 'people' && !mappedFields.includes('email');

        return {
            missingRequired: missing,
            hasDuplicates: duplicates.length > 0,
            noEmailInfo
        };
    }, [columnMapping, importFields, importType]);

    const isValid = missingRequired.length === 0 && !hasDuplicates;

    const entityLabel = importType === 'organizations' ? 'ארגונים' : importType === 'relationships' ? 'קשרים' : 'אנשי קשר';

    return (
        <div className="flex flex-col space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">מיפוי עמודות — {entityLabel}</h2>
                <p className="text-muted-foreground mt-2">
                    התאם את העמודות מקובץ ה-Excel לשדות במערכת.
                </p>
            </div>

            {missingRequired.length > 0 && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>שדות חובה חסרים</AlertTitle>
                    <AlertDescription>
                        חובה למפות את השדות הבאים כדי להמשיך:{' '}
                        {missingRequired.map(f => importFields.find(pf => pf.value === f)?.label).join(', ')}
                    </AlertDescription>
                </Alert>
            )}

            {hasDuplicates && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>מיפוי כפול</AlertTitle>
                    <AlertDescription>
                        לא ניתן למפות שתי עמודות שונות לאותו שדה במערכת.
                    </AlertDescription>
                </Alert>
            )}

            {noEmailInfo && isValid && (
                <Alert className="bg-blue-50 text-blue-900 border-blue-200">
                    <AlertTriangle className="h-4 w-4 text-blue-500" />
                    <AlertTitle>מומלץ למפות אימייל</AlertTitle>
                    <AlertDescription>
                        לא מיפית את שדה האימייל. אימייל הוא השדה המרכזי שדרכו אנו מזהים כפילויות במערכת.
                    </AlertDescription>
                </Alert>
            )}

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-1/3">עמודה בקובץ</TableHead>
                            <TableHead className="w-1/3">שדה במערכת</TableHead>
                            <TableHead className="w-1/3">סטטוס</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {fileHeaders.map((header, idx) => {
                            const currentValue = columnMapping[header] || 'null';
                            return (
                                <TableRow key={`${header}-${idx}`}>
                                    <TableCell className="font-medium">{header}</TableCell>
                                    <TableCell>
                                        <Select
                                            value={currentValue}
                                            onValueChange={(val) => handleMapChange(header, val)}
                                        >
                                            <SelectTrigger className="w-[200px]">
                                                <SelectValue placeholder="בחר שדה..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {importFields.map((field) => (
                                                    <SelectItem
                                                        key={field.value || 'null'}
                                                        value={field.value || 'null'}
                                                    >
                                                        {field.label}
                                                        {field.required && ' *'}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell>
                                        {currentValue !== 'null' ? (
                                            <div className="flex items-center text-green-600 text-sm">
                                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                                ממופה
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">ידלג על העמודה</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            <div className="flex justify-between mt-8">
                <Button variant="outline" onClick={prevStep}>
                    חזרה לאחור
                </Button>
                <Button onClick={nextStep} disabled={!isValid}>
                    המשך לתצוגה מקדימה
                </Button>
            </div>
        </div>
    );
}
