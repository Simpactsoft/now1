"use client";

import AttributeManager from '@/components/settings/AttributeManager';

export default function DataModelPage() {
    return (
        <div className="flex flex-col gap-6">
            <header className="pb-6 border-b border-border">
                <h1 className="text-3xl font-bold tracking-tight">Data Model Configuration</h1>
                <p className="text-muted-foreground">
                    Define custom fields and attributes for People and Organizations.
                    These fields are automatically available in the API and Indexing engine.
                </p>
            </header>

            <AttributeManager />
        </div>
    );
}
