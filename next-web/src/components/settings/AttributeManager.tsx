"use client";

import React, { useState, useEffect } from 'react';
import { getTenantAttributes, upsertAttribute, deleteAttribute, AttributeDefinition } from '@/app/actions/attributes';
import { Plus, Trash2, Edit2, Loader2, Save, X } from 'lucide-react';
import { toast } from 'sonner';

export default function AttributeManager() {
    const [attributes, setAttributes] = useState<AttributeDefinition[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [editingAttr, setEditingAttr] = useState<AttributeDefinition | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<AttributeDefinition>>({
        entity_type: 'person',
        attribute_type: 'text',
        label_i18n: { en: '' },
        is_required: false
    });

    const fetchAttrs = async () => {
        setLoading(true);
        // We want to fetch ALL attributes, so we don't pass an entity type filter
        const res = await getTenantAttributes();
        if (res.data) {
            setAttributes(res.data);
            console.log("Attributes loaded:", res.data);
        } else {
            console.error("Attributes load error:", res.error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchAttrs();
        fetchOptions();
    }, []);

    const [optionSets, setOptionSets] = useState<any[]>([]); // TODO: Type this properly

    // ... (fetchAttrs remains)

    const fetchOptions = async () => {
        const { fetchOptionSets } = await import('@/app/actions/attributes');
        const res = await fetchOptionSets();
        if (res.data) setOptionSets(res.data);
    };



    // ... (handleSave logic needs update to store the selected set code)


    // ... (Inside the form render, after Type select):
    /*
        {formData.attribute_type === 'select' && (
            <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium text-muted-foreground">List Source</label>
                <select
                    value={(formData.options_config as any)?.[0]?.value || ''} // Temporary hack to store code
                    onChange={(e) => {
                       // Store as specific format for now or just a value to be parsed
                       // Actually, let's just use a simple mock for now until we have the full "Create List" UI
                       // For this step, I'll just allow typing a Code or picking existing.
                    }}
                    className="..."
                >
                    <option value="">-- Choose a List --</option>
                    {optionSets.map(os => (
                        <option key={os.code} value={os.code}>{os.code} {os.description && `(${os.description})`}</option>
                    ))}
                </select>
            </div>
        )}
    */

    // Refined implementation below:

    const handleSave = async () => {
        if (!formData.attribute_key || !formData.label_i18n?.en) {
            toast.error("Key and English Label are required");
            return;
        }

        // Special validation for Select
        let finalOptionsConfig = formData.options_config;
        if (formData.attribute_type === 'select') {
            // For now, valid config is required. 
            // We will interpret `options_config` as an array where the first item holds the metadata if it's a dynamic set.
            // Or, we simplifiy: options_config = [{ "value": "linked_set_code", "label": { "en": "CODE" } }]
            // Ideally we should add `option_set_code` column to `attribute_definitions`, but we are using JSONB.
            // Let's store it like: options_config: { "source": "option_set", "set_code": "..." } -> BUT the type is Array.
            // We'll abuse the JSON for now: [ { "is_dynamic": true, "set_code": "..." } ]
        }

        const payload = {
            ...formData,
            attribute_key: formData.attribute_key.toLowerCase().replace(/[^a-z0-9_]/g, '_')
        } as AttributeDefinition;

        const res = await upsertAttribute(payload);
        // ... rest of error handling ...
    };

    // Render part update:
    /*
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm font-medium text-muted-foreground">Type</label>
                                <select ... > ... </select>
                            </div>

                            {formData.attribute_type === 'select' && (
                                <div className="grid grid-cols-4 items-center gap-4 bg-muted/30 p-2 rounded border border-dashed border-border">
                                    <label className="text-right text-sm font-medium text-foreground">Pick List</label>
                                    <div className="col-span-3 space-y-2">
                                        <select
                                            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
                                            value={(formData.options_config as any)?.[0]?.set_code || ""}
                                            onChange={(e) => {
                                                const code = e.target.value;
                                                setFormData({
                                                    ...formData,
                                                    options_config: code ? [{ set_code: code } as any] : []
                                                });
                                            }}
                                        >
                                            <option value="">Select an existing list...</option>
                                            {optionSets.map((os) => (
                                                <option key={os.id} value={os.code}>
                                                    {os.code}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="text-xs text-muted-foreground flex gap-2">
                                            <span>Or</span>
                                            <button className="text-primary hover:underline">Create new list</button>
                                        </div>
                                    </div>
                                </div>
                            )}
    */

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure? This will hide the data, but not delete existing values in JSON.")) return;
        const res = await deleteAttribute(id);
        if (res.error) toast.error(res.error);
        else {
            toast.success("Deleted");
            fetchAttrs();
        }
    };

    const openEdit = (attr: AttributeDefinition) => {
        setEditingAttr(attr);
        setFormData(attr);
        setIsOpen(true);
    };

    // ... existing Create Attribute implementation ...

    // New State for Create List Dialog
    const [isCreatingList, setIsCreatingList] = useState(false);
    const [newListData, setNewListData] = useState({ name: '', description: '', values: '' });

    const handleCreateList = async () => {
        if (!newListData.name) {
            toast.error("List code/name is required");
            return;
        }

        const code = newListData.name.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
        const values = newListData.values.split('\n').filter(v => v.trim()).map(v => {
            const trimmed = v.trim();
            // Simple split by PIPE if they want value|label, else label=value
            const [val, label] = trimmed.includes('|') ? trimmed.split('|') : [trimmed.toUpperCase().replace(/[^A-Z0-9_]/g, '_'), trimmed];
            return { value: val, label: label || val };
        });

        const { createOptionSet } = await import('@/app/actions/attributes');
        const res = await createOptionSet({
            code,
            description: newListData.description,
            values
        });

        if (res.error) {
            toast.error(res.error);
        } else {
            toast.success("List created");
            await fetchOptions(); // Refresh list
            // Auto Select
            setFormData({
                ...formData,
                options_config: [{ set_code: code } as any]
            });
            setIsCreatingList(false);
            setNewListData({ name: '', description: '', values: '' });
        }
    };

    return (
        <div className="space-y-6">
            {/* ... Existing UI ... */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">Data Model</h2>
                    <p className="text-muted-foreground">Manage custom fields and metadata schemas.</p>
                </div>
                <button
                    onClick={() => { setEditingAttr(null); setIsOpen(true); }}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90 transition-colors font-medium text-sm"
                >
                    <Plus className="h-4 w-4" /> Add Field
                </button>
            </div>

            <div className="border border-border rounded-lg overflow-hidden bg-card text-card-foreground shadow-sm">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted text-muted-foreground">
                        <tr>
                            <th className="px-4 py-3 font-medium">Label (EN)</th>
                            <th className="px-4 py-3 font-medium">Key</th>
                            <th className="px-4 py-3 font-medium">Type</th>
                            <th className="px-4 py-3 font-medium">Entity</th>
                            <th className="px-4 py-3 w-[100px]"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="h-24 text-center">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                </td>
                            </tr>
                        ) : attributes.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="h-24 text-center text-muted-foreground">
                                    No custom fields defined.
                                </td>
                            </tr>
                        ) : (
                            attributes.map((attr) => (
                                <tr key={attr.id} className="hover:bg-muted/50 transition-colors">
                                    <td className="px-4 py-3 font-medium text-foreground">{attr.label_i18n?.en || 'N/A'}</td>
                                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{attr.attribute_key}</td>
                                    <td className="px-4 py-3 text-foreground capitalize">{attr.attribute_type}</td>
                                    <td className="px-4 py-3 text-foreground capitalize">{attr.entity_type}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-2 justify-end">
                                            <button onClick={() => openEdit(attr)} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors">
                                                <Edit2 className="h-4 w-4" />
                                            </button>
                                            {!attr.is_system && (
                                                <button onClick={() => handleDelete(attr.id!)} className="p-1.5 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-colors">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Main Attribute Modal */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-popover text-popover-foreground border border-border w-full max-w-lg rounded-xl shadow-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-semibold">{editingAttr ? 'Edit Field' : 'New Field'}</h3>
                            <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* ... Entity ... */}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm font-medium text-muted-foreground">Entity</label>
                                <select
                                    value={formData.entity_type}
                                    onChange={(e) => setFormData({ ...formData, entity_type: e.target.value as any })}
                                    disabled={!!editingAttr}
                                    className="col-span-3 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                                >
                                    <option value="person" className="bg-popover text-popover-foreground">Person (Only)</option>
                                    <option value="organization" className="bg-popover text-popover-foreground">Organization (Only)</option>
                                    <option value="party" className="bg-popover text-popover-foreground">Global (Party - All Types)</option>
                                </select>
                            </div>

                            {/* ... Type ... */}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm font-medium text-muted-foreground">Type</label>
                                <select
                                    value={formData.attribute_type}
                                    onChange={(e) => setFormData({ ...formData, attribute_type: e.target.value as any })}
                                    disabled={!!editingAttr}
                                    className="col-span-3 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                                >
                                    <option value="text" className="bg-popover text-popover-foreground">Text</option>
                                    <option value="number" className="bg-popover text-popover-foreground">Number</option>
                                    <option value="date" className="bg-popover text-popover-foreground">Date (Flexible/Exact)</option>
                                    <option value="json" className="bg-popover text-popover-foreground">Flexible Date (JSON)</option>
                                    <option value="boolean" className="bg-popover text-popover-foreground">Yes/No</option>
                                    <option value="select" className="bg-popover text-popover-foreground">Dropdown</option>
                                </select>
                            </div>

                            {formData.attribute_type === 'select' && (
                                <div className="grid grid-cols-4 items-center gap-4 bg-muted/30 p-2 rounded border border-dashed border-border">
                                    <label className="text-right text-sm font-medium text-foreground">Pick List</label>
                                    <div className="col-span-3 space-y-2">
                                        <select
                                            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
                                            value={(formData.options_config as any)?.[0]?.set_code || ""}
                                            onChange={(e) => {
                                                const code = e.target.value;
                                                setFormData({
                                                    ...formData,
                                                    options_config: code ? [{ set_code: code } as any] : []
                                                });
                                            }}
                                        >
                                            <option value="">-- Select an existing list --</option>
                                            {optionSets.map((os) => (
                                                <option key={os.id} value={os.code}>
                                                    {os.code} {os.description ? `(${os.description})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="text-xs text-muted-foreground flex gap-2">
                                            <span>Or</span>
                                            <button type="button" className="text-primary hover:underline font-medium" onClick={() => setIsCreatingList(true)}>+ Create new list</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ... Key ... */}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm font-medium text-muted-foreground">Key (SQL)</label>
                                <input
                                    value={formData.attribute_key || ''}
                                    onChange={(e) => setFormData({ ...formData, attribute_key: e.target.value })}
                                    placeholder="shoe_size"
                                    disabled={!!editingAttr}
                                    className="col-span-3 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground/50 disabled:opacity-50"
                                />
                            </div>

                            {/* ... Label ... */}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm font-medium text-muted-foreground">Label (En)</label>
                                <input
                                    value={formData.label_i18n?.en || ''}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        label_i18n: { ...formData.label_i18n, en: e.target.value }
                                    })}
                                    placeholder="Shoe Size"
                                    className="col-span-3 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground/50"
                                />
                            </div>

                            {/* ... Required ... */}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm font-medium text-muted-foreground">Required</label>
                                <div className="col-span-3 flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_required}
                                        onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                                        className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-ring"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setIsOpen(false)} className="px-4 py-2 rounded-md text-sm hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                                Cancel
                            </button>
                            <button onClick={handleSave} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90 transition-colors font-medium text-sm">
                                <Save className="h-4 w-4" /> Save Definition
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create List Side Dialog (Overlay) */}
            {isCreatingList && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-popover text-popover-foreground border border-border w-full max-w-md rounded-xl shadow-2xl p-6 space-y-4">
                        <div className="flex justify-between items-center border-b border-border pb-4">
                            <h3 className="text-lg font-semibold">Create New Option List</h3>
                            <button onClick={() => setIsCreatingList(false)} className="text-muted-foreground hover:text-foreground">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-sm font-medium">List Code (e.g., LEAD_STATUS)</label>
                                <input
                                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm uppercase"
                                    value={newListData.name}
                                    onChange={(e) => setNewListData({ ...newListData, name: e.target.value })}
                                    placeholder="STATUS_TYPE"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Description</label>
                                <input
                                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
                                    value={newListData.description}
                                    onChange={(e) => setNewListData({ ...newListData, description: e.target.value })}
                                    placeholder="Optional description"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Values (One per line)</label>
                                <textarea
                                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm min-h-[150px]"
                                    value={newListData.values}
                                    onChange={(e) => setNewListData({ ...newListData, values: e.target.value })}
                                    placeholder="Open&#10;In Progress&#10;Closed&#10;Won|Deal Won (Optional Label)"
                                />
                                <p className="text-[10px] text-muted-foreground">Format: VALUE or VALUE|Label</p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setIsCreatingList(false)} className="px-4 py-2 rounded-md text-sm hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                                Cancel
                            </button>
                            <button onClick={handleCreateList} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md transition-colors font-medium text-sm">
                                <Save className="h-4 w-4" /> Create List
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
