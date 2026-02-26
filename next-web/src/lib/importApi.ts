// src/lib/importApi.ts
import { toast } from "sonner";

export interface ImportStartRequest {
    rows: Array<Record<string, string>>;
    mapping: Record<string, string | null>;
    settings: {
        duplicate_policy: 'skip' | 'update' | 'manual';
        default_status: string;
    };
}

export interface ImportStartResponse {
    job_id: string;
    status: 'completed' | 'processing' | 'failed';
    results?: {
        created: number;
        updated: number;
        skipped: number;
        errors: number;
    };
    error?: string;
}

export interface ImportStatusResponse {
    job_id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    total_rows: number;
    processed_rows: number;
    created_count: number;
    updated_count: number;
    skipped_count: number;
    error_count: number;
    error?: string;
}

/**
 * Starts a new import job.
 */
export async function startImport(data: ImportStartRequest): Promise<ImportStartResponse> {
    const response = await fetch('/api/v1/import/start', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        let errorMessage = 'Failed to start import';
        try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
        } catch (e) {
            errorMessage = await response.text() || errorMessage;
        }

        if (response.status === 409) {
            throw new Error('ישנו ייבוא פעיל אחר כרגע במערכת. אנא המתן לסיומו.');
        } else if (response.status === 429) {
            throw new Error('עברת את מגבלת הייבואים לשעה. אנא נסה שנית מאוחר יותר.');
        }

        throw new Error(errorMessage);
    }

    return response.json();
}

/**
 * Gets the status of an ongoing import job.
 */
export async function getImportStatus(jobId: string): Promise<ImportStatusResponse> {
    const response = await fetch(`/api/v1/import/${jobId}/status`);

    if (!response.ok) {
        let errorMessage = 'Failed to fetch import status';
        try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
        } catch (e) { /* empty */ }
        throw new Error(errorMessage);
    }

    return response.json();
}

/**
 * Initiates a download of the error report CSV for a specific job.
 * Since it returns a file, we construct a URL and trigger a programmatic click.
 */
export async function downloadErrorReport(jobId: string) {
    try {
        const response = await fetch(`/api/v1/import/${jobId}/errors`);
        if (!response.ok) {
            const errorText = await response.text();
            toast.error(`Download failed: ${errorText}`);
            return;
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.setAttribute('download', `import-errors-${jobId}.csv`);
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (e) {
        console.error('Download exception:', e);
        toast.error('Network error downloading the report');
    }
}

/**
 * Initiates a download of the Import Template Excel file.
 */
export function downloadImportTemplate() {
    const url = `/api/v1/import/templates`;
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', `now-system-import-template.xlsx`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
