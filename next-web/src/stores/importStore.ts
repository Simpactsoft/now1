// src/stores/importStore.ts
import { create } from 'zustand';

export interface ValidationResult {
    row: number;
    valid: boolean;
    errors: { field: string; message: string }[];
    warnings: { field: string; message: string }[];
}

interface ImportResults {
    created: number;
    updated: number;
    skipped: number;
    errors: number;
}

export type ImportType = 'people' | 'organizations' | 'relationships';

interface ImportState {
    // Entity type
    importType: ImportType;

    // Step 1: File
    file: File | null;
    fileName: string;
    fileHeaders: string[];
    rawRows: string[][];  // raw parsed data (without headers)
    rowCount: number;

    // Step 2: Mapping
    columnMapping: Record<string, string | null>; // fileHeader → systemField

    // Step 3: Preview
    validationResults: ValidationResult[];
    duplicatePolicy: 'skip' | 'update' | 'manual';

    // Step 4: Results
    jobId: string | null;
    jobStatus: 'idle' | 'processing' | 'completed' | 'failed';
    results: ImportResults | null;

    // Navigation
    currentStep: 1 | 2 | 3 | 4;

    // Actions
    setImportType: (type: ImportType) => void;
    setFile: (file: File, headers: string[], rows: string[][], rowCount: number) => void;
    setMapping: (mapping: Record<string, string | null>) => void;
    setValidationResults: (results: ValidationResult[]) => void;
    setDuplicatePolicy: (policy: 'skip' | 'update' | 'manual') => void;
    setJobId: (id: string) => void;
    setJobStatus: (status: ImportState['jobStatus']) => void;
    setResults: (results: ImportResults | null) => void;
    nextStep: () => void;
    prevStep: () => void;
    setStep: (step: 1 | 2 | 3 | 4) => void;
    reset: () => void;
}

const initialState = {
    importType: 'people' as ImportType,
    file: null,
    fileName: '',
    fileHeaders: [],
    rawRows: [],
    rowCount: 0,
    columnMapping: {},
    validationResults: [],
    duplicatePolicy: 'manual' as const, // default policy
    jobId: null,
    jobStatus: 'idle' as const,
    results: null,
    currentStep: 1 as const,
};

export const useImportStore = create<ImportState>((set) => ({
    ...initialState,

    setImportType: (importType) => set({ importType }),

    setFile: (file, fileHeaders, rawRows, rowCount) =>
        set({ file, fileName: file.name, fileHeaders, rawRows, rowCount }),

    setMapping: (columnMapping) => set({ columnMapping }),

    setValidationResults: (validationResults) => set({ validationResults }),

    setDuplicatePolicy: (duplicatePolicy) => set({ duplicatePolicy }),

    setJobId: (jobId) => set({ jobId }),

    setJobStatus: (jobStatus) => set({ jobStatus }),

    setResults: (results) => set({ results }),

    nextStep: () => set((state) => ({
        currentStep: Math.min(state.currentStep + 1, 4) as 1 | 2 | 3 | 4
    })),

    prevStep: () => set((state) => ({
        currentStep: Math.max(state.currentStep - 1, 1) as 1 | 2 | 3 | 4
    })),

    setStep: (currentStep) => set({ currentStep }),

    reset: () => set(initialState),
}));
