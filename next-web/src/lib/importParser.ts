// src/lib/importParser.ts
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface ParsedFileResult {
    fileName: string;
    headers: string[];
    rows: string[][]; // Raw extracted string values, headers excluded
    rowCount: number;
    error?: string;
}

/**
 * Parses a File object (CSV/Excel) and returns standardized headers and rows.
 */
export async function parseImportFile(file: File): Promise<ParsedFileResult> {
    const ext = file.name.split('.').pop()?.toLowerCase();

    // We limit chunk size for UI performance to 5000 max, 
    // but the store will handle chunking. The parser extracts everything.

    if (ext === 'xlsx' || ext === 'xls') {
        return parseExcel(file);
    } else if (ext === 'csv' || ext === 'tsv' || ext === 'txt') {
        return parseCsv(file);
    } else {
        throw new Error('Unsupported file format. Please upload CSV or Excel files.');
    }
}

function parseExcel(file: File): Promise<ParsedFileResult> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });

                // For Phase 2, we just take the first sheet. 
                // Later we can add a sheet selector UI if multiple exist.
                if (workbook.SheetNames.length === 0) {
                    return reject(new Error('Excel file has no sheets'));
                }

                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // header: 1 means returns array of arrays, raw data
                const rows = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, raw: false });

                if (rows.length === 0) {
                    return reject(new Error('Excel file is empty'));
                }
                if (rows.length === 1) {
                    return reject(new Error('אין נתונים לייבוא (נמצאה שורת כותרת בלבד)'));
                }

                const headers = rows[0].map(h => String(h || '').trim());
                const dataRows = rows.slice(1).map(row =>
                    // Pad rows that are shorter than the headers
                    headers.map((_, i) => String(row[i] || '').trim())
                );

                resolve({
                    fileName: file.name,
                    headers,
                    rows: dataRows,
                    rowCount: dataRows.length
                });

            } catch (err) {
                reject(new Error('Failed to parse Excel file'));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

function parseCsv(file: File): Promise<ParsedFileResult> {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: false, // get raw arrays
            dynamicTyping: false, // CRITICAL: keep everything string (phones, IDs)
            skipEmptyLines: true,
            delimitersToGuess: [',', '\t', '|', ';'],
            encoding: 'UTF-8',
            complete: (results) => {
                if (results.errors.length > 0 && results.data.length === 0) {
                    return reject(new Error(results.errors[0].message));
                }

                const data = results.data as string[][];

                if (data.length === 0) {
                    return reject(new Error('הקובץ ריק'));
                }
                if (data.length === 1) {
                    return reject(new Error('אין נתונים לייבוא (נמצאה שורת כותרת בלבד)'));
                }

                const headers = data[0].map(h => String(h || '').trim());
                const dataRows = data.slice(1).map(row =>
                    // Pad rows that are shorter than the headers array
                    headers.map((_, i) => String(row[i] || '').trim())
                );

                // Validate if headers exist
                if (headers.every(h => !h)) {
                    return reject(new Error('לא זוהו כותרות עמודות בקובץ'));
                }

                resolve({
                    fileName: file.name,
                    headers,
                    rows: dataRows,
                    rowCount: dataRows.length
                });
            },
            error: (error) => {
                reject(error);
            }
        });
    });
}
