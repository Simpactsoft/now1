"use client";

import React from 'react';
import { AttributeDefinition } from '@/app/actions/attributes';
import { Calendar, CheckCircle2, XCircle, Type, Hash, List } from 'lucide-react';

interface CustomFieldsCardProps {
    attributes: AttributeDefinition[];
    customFields: Record<string, any>;
}

export default function CustomFieldsCard({ attributes, customFields = {} }: CustomFieldsCardProps) {
    if (!attributes || attributes.length === 0) return null;

    // Filter out attributes that have no value set (optional: or show them as empty)
    // For now, let's show all so the user knows they exist, or maybe only those with values?
    // Let's show all to indicate what IS available.

    // Helper to format value
    const formatValue = (attr: AttributeDefinition, value: any) => {
        if (value === null || value === undefined || value === '') return <span className="text-zinc-600 italic">Empty</span>;

        switch (attr.attribute_type) {
            case 'boolean':
                return value ?
                    <div className="flex items-center gap-1.5 text-emerald-400"><CheckCircle2 className="w-4 h-4" /> Yes</div> :
                    <div className="flex items-center gap-1.5 text-zinc-500"><XCircle className="w-4 h-4" /> No</div>;
            case 'date':
                return (
                    <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-zinc-500" />
                        <span>{new Date(value).toLocaleDateString()}</span>
                    </div>
                );
            case 'select':
                // Find label if options exist
                const option = attr.options_config?.find(o => o.value === value);
                return option ? (option.label['en'] || value) : value;
            case 'multi_select':
                if (!Array.isArray(value)) return value;
                return (
                    <div className="flex flex-wrap gap-1">
                        {value.map((v: string) => {
                            const opt = attr.options_config?.find(o => o.value === v);
                            return (
                                <span key={v} className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-xs">
                                    {opt ? (opt.label['en'] || v) : v}
                                </span>
                            );
                        })}
                    </div>
                );
            case 'number':
                return <span className="font-mono text-blue-300">{value}</span>;
            default:
                return <span>{value}</span>;
        }
    };

    // Helper for Icon
    const getIcon = (type: string) => {
        switch (type) {
            case 'number': return <Hash className="w-4 h-4" />;
            case 'date': return <Calendar className="w-4 h-4" />;
            case 'boolean': return <CheckCircle2 className="w-4 h-4" />;
            case 'select': return <List className="w-4 h-4" />;
            default: return <Type className="w-4 h-4" />;
        }
    };

    return (
        <div className="glass p-6 rounded-2xl border border-white/10">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                Additional Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                {attributes.map(attr => (
                    <div key={attr.id} className="flex flex-col gap-1">
                        <span className="text-xs text-slate-500 uppercase flex items-center gap-1.5">
                            {getIcon(attr.attribute_type)}
                            {attr.label_i18n['en'] || attr.attribute_key}
                        </span>
                        <div className="text-sm font-medium text-slate-200 pl-5.5">
                            {formatValue(attr, customFields[attr.attribute_key])}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
