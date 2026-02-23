"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createProduct } from "@/app/actions/createProduct";
import { updateProduct } from "@/app/actions/updateProduct";
import { Save, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";

interface ProductFormProps {
    tenantId: string;
    initialData?: {
        id: string;
        name: string;
        sku: string;
        list_price?: number;
        cost_price?: number;
        description?: string;
        track_inventory?: boolean;
        is_configurable?: boolean;
        template_id?: string | null;
    };
}

export default function ProductForm({ tenantId, initialData }: ProductFormProps) {
    const router = useRouter();
    const { language } = useLanguage();
    const isHe = language === 'he';
    const [isLoading, setIsLoading] = useState(false);
    const [isConfigurable, setIsConfigurable] = useState(initialData?.is_configurable || false);
    const [templates, setTemplates] = useState<{ id: string, name: string }[]>([]);

    useEffect(() => {
        const fetchTemplates = async () => {
            const { createBrowserClient } = await import('@supabase/ssr');
            const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );
            const { data } = await supabase
                .from('product_templates')
                .select('id, name')
                .eq('tenant_id', tenantId)
                .order('name');

            if (data) setTemplates(data);
        };
        fetchTemplates();
    }, [tenantId]);

    const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);

        const formData = new FormData(e.currentTarget);
        const name = formData.get("name") as string;
        const sku = formData.get("sku") as string;
        const listPrice = parseFloat(formData.get("list_price") as string) || 0;
        const costPrice = parseFloat(formData.get("cost_price") as string) || 0;
        const description = formData.get("description") as string;
        const trackInventory = formData.get("track_inventory") === "on";
        const templateId = formData.get("template_id") as string;

        let result;
        if (initialData?.id) {
            result = await updateProduct({
                id: initialData.id,
                tenantId,
                name,
                sku,
                list_price: listPrice,
                cost_price: costPrice,
                description,
                track_inventory: trackInventory,
                is_configurable: isConfigurable,
                template_id: isConfigurable && templateId ? templateId : undefined,
            });
        } else {
            result = await createProduct({
                tenantId,
                name,
                sku,
                list_price: listPrice,
                cost_price: costPrice,
                description,
                track_inventory: trackInventory,
                is_configurable: isConfigurable,
                template_id: isConfigurable && templateId ? templateId : undefined,
            });
        }

        setIsLoading(false);

        if (result.success && "data" in result && result.data) {
            toast.success(isHe ? (initialData?.id ? 'הפריט עודכן בהצלחה' : 'הפריט נוצר בהצלחה') : (initialData?.id ? 'Product updated successfully' : 'Product created successfully'));
            router.push(`/dashboard/products/${result.data.id}`);
        } else {
            const errorMessage = "error" in result ? result.error : undefined;
            toast.error(errorMessage || (isHe ? 'שגיאה בשמירת הפריט' : 'Failed to save product'));
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6 mt-6 pb-24" dir={isHe ? 'rtl' : 'ltr'}>
            <div className="flex items-center gap-4 mb-6">
                <Link href={initialData?.id ? `/dashboard/products/${initialData.id}` : "/dashboard/products"} className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground">
                    <ArrowLeft size={20} className={isHe ? 'rotate-180' : ''} />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">{isHe ? (initialData?.id ? 'עריכת פריט' : 'יצירת פריט חדש') : (initialData?.id ? 'Edit Product' : 'Create New Product')}</h1>
                    <p className="text-sm text-muted-foreground">{isHe ? 'טופס לעריכת פרטי פריט במערכת' : 'Edit details of the product'}</p>
                </div>
            </div>

            <form onSubmit={onSubmit} className="bg-card border border-border rounded-xl shadow-sm p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label htmlFor="name" className="text-sm font-medium">{isHe ? 'שם הפריט' : 'Product Name'} *</label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            defaultValue={initialData?.name || ""}
                            required
                            className="w-full h-10 px-3 rounded-md border border-input bg-background"
                            placeholder={isHe ? 'הזן שם פריט...' : 'Enter product name...'}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="sku" className="text-sm font-medium">{isHe ? 'מק"ט (SKU)' : 'SKU'} *</label>
                        <input
                            type="text"
                            id="sku"
                            name="sku"
                            defaultValue={initialData?.sku || ""}
                            required
                            className="w-full h-10 px-3 rounded-md border border-input bg-background font-mono"
                            placeholder="e.g. PRD-001"
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="list_price" className="text-sm font-medium">{isHe ? 'מחיר מחירון' : 'List Price'}</label>
                        <input
                            type="number"
                            id="list_price"
                            name="list_price"
                            defaultValue={initialData?.list_price || ""}
                            step="0.01"
                            min="0"
                            className="w-full h-10 px-3 rounded-md border border-input bg-background"
                            placeholder="0.00"
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="cost_price" className="text-sm font-medium">{isHe ? 'מחיר עלות' : 'Cost Price'}</label>
                        <input
                            type="number"
                            id="cost_price"
                            name="cost_price"
                            defaultValue={initialData?.cost_price || ""}
                            step="0.01"
                            min="0"
                            className="w-full h-10 px-3 rounded-md border border-input bg-background"
                            placeholder="0.00"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label htmlFor="description" className="text-sm font-medium">{isHe ? 'תיאור' : 'Description'}</label>
                    <textarea
                        id="description"
                        name="description"
                        defaultValue={initialData?.description || ""}
                        rows={3}
                        className="w-full p-3 rounded-md border border-input bg-background"
                        placeholder={isHe ? 'תיאור הפריט...' : 'Product description...'}
                    />
                </div>

                <div className="flex items-center gap-2 pt-2 pb-4 border-t border-border mt-6">
                    <input
                        type="checkbox"
                        id="track_inventory"
                        name="track_inventory"
                        defaultChecked={initialData?.track_inventory !== undefined ? initialData.track_inventory : true}
                        className="w-4 h-4 rounded border-border"
                    />
                    <label htmlFor="track_inventory" className="text-sm font-medium cursor-pointer">
                        {isHe ? 'נהל מלאי עבור פריט זה' : 'Track inventory for this product'}
                    </label>
                </div>

                <div className="space-y-4 pt-4 border-t border-border">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="is_configurable"
                            name="is_configurable"
                            checked={isConfigurable}
                            onChange={(e) => setIsConfigurable(e.target.checked)}
                            className="w-4 h-4 rounded border-border"
                        />
                        <label htmlFor="is_configurable" className="text-sm font-medium cursor-pointer">
                            {isHe ? 'פריט קונפיגורבילי (CPQ)' : 'Configurable Product (CPQ)'}
                        </label>
                    </div>

                    {isConfigurable && (
                        <div className="space-y-2 max-w-sm">
                            <label htmlFor="template_id" className="text-sm font-medium">
                                {isHe ? 'בחר תבנית CPQ' : 'Select CPQ Template'} *
                            </label>
                            <select
                                id="template_id"
                                name="template_id"
                                defaultValue={initialData?.template_id || ""}
                                required={isConfigurable}
                                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                            >
                                <option value="">{isHe ? '-- בחר תבנית --' : '-- Select Template --'}</option>
                                {templates.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="flex justify-end pt-4 border-t border-border">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                        {isLoading ? (
                            <span className="animate-spin text-lg">⏳</span>
                        ) : (
                            <Save size={18} />
                        )}
                        <span>{isHe ? 'שמור פריט' : 'Save Product'}</span>
                    </button>
                </div>
            </form>
        </div>
    );
}
