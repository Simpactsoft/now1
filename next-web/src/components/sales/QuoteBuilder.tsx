'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    ChevronRight,
    ChevronDown,
    Package,
    FolderOpen,
    Folder,
    Plus,
    Minus,
    X,
    ShoppingCart,
    Check,
    AlertTriangle,
    Search,
    CloudUpload,
    FileText,
    ChevronsUpDown,
    UserCircle,
    Building2,
    Loader2
} from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { Command } from 'cmdk';
import * as Popover from '@radix-ui/react-popover';
import { getProductsForTenant } from "@/app/actions/quote-actions";
import { getPriceLists, getEffectivePrice } from "@/app/actions/price-list-actions";
import { validateQuoteMargin } from "@/app/actions/profitability-actions";
import { createInvoiceFromQuote } from "@/app/actions/invoice-actions";
import ProductsAgGrid from "./ProductsAgGrid";
import ProductSelector from "./ProductSelector";
import { ViewConfigProvider } from "@/components/universal/ViewConfigContext";
import { ProductConfiguratorModal } from "@/components/cpq/ProductConfiguratorModal";
import { formatCurrency, getCurrencySymbol } from "@/lib/format";
import type { Configuration } from "@/app/actions/cpq/configuration-actions";

// --- Types ---

interface Category {
    id: string;
    parent_id: string | null;
    name: string;
    path: string;
    depth: number;
    children?: Category[];
}

interface Product {
    id: string;
    sku: string;
    name: string;
    cost_price: number;
    list_price: number; // Base price
    price?: number; // Effective price (from BOM/CPQ enrichment)
    currency?: string; // Product currency
    price_source?: 'bom' | 'cpq' | 'manual'; // Where the price came from
    track_inventory: boolean;
    category_id: string;
    // Computed / Joined fields
    current_stock?: number;
    price_list_price?: number; // Price from specific list
    // CPQ fields
    is_configurable?: boolean;
    template_id?: string;
}

interface QuoteItem {
    id: string; // random UUID for key
    product_id: string;
    sku: string;
    name: string;
    quantity: number;
    unit_price: number;
    discount_percent: number;
    line_total: number;
    configuration_id?: string; // Links to CPQ configuration if product is configured
    price_source?: 'bom' | 'cpq' | 'manual' | 'customer_list' | 'general_list' | 'base_price';
    price_list_name?: string; // Name of the price list that sourced this price
}

interface Customer {
    id: string;
    name: string; // display_name
}

interface PriceList {
    id: string;
    name: string;
}

// --- Mock Data / Supabase Client ---

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// --- Component ---

export default function QuoteBuilder({ initialTenantId }: { initialTenantId?: string }) {
    // Initialize standard browser client to share session
    const supabase = createBrowserClient(supabaseUrl, supabaseKey);
    // context
    const [tenantId, setTenantId] = useState<string | null>(initialTenantId || null);

    // master data
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [priceLists, setPriceLists] = useState<PriceList[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [products, setProducts] = useState<Product[]>([]);

    // selection state
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [selectedPriceListId, setSelectedPriceListId] = useState<string>('');
    const [selectedCategoryPath, setSelectedCategoryPath] = useState<string | null>(null);

    // quote state
    const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
    const [quoteNumber, setQuoteNumber] = useState<string>('');
    const [quoteDate, setQuoteDate] = useState<string>(new Date().toISOString().split('T')[0]);

    // Currency & locale (RULE-03: no hardcoded symbols — driven by tenant settings)
    // TODO: Read from tenant.base_currency / tenant.default_locale after TASK-002 is wired up
    const [quoteCurrency, setQuoteCurrency] = useState<string>('ILS');
    const [quoteLocale, setQuoteLocale] = useState<string>('he-IL');
    const [minMarginPct, setMinMarginPct] = useState<number>(20); // Default, overridden by tenant

    // UI state
    const [loading, setLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [openCustomer, setOpenCustomer] = useState(false);

    // CPQ Configurator state
    const [configuratorOpen, setConfiguratorOpen] = useState(false);
    const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null);
    const [submittingForApproval, setSubmittingForApproval] = useState(false);

    // --- Initialization ---

    useEffect(() => {
        // 1. Get Tenant Context
        const init = async () => {
            setLoading(true);
            try {
                if (initialTenantId) {
                    setTenantId(initialTenantId);
                    // Set Config for RLS - SKIPPED for now as RPC is missing and we use explicit tenant_id
                    // await supabase.rpc('set_config', { name: 'app.current_tenant', value: initialTenantId });

                    // B. Fetch Master Data + Tenant Settings
                    await Promise.all([
                        fetchCustomers(initialTenantId),
                        fetchPriceLists(initialTenantId),
                        fetchMasterData(initialTenantId),
                        fetchTenantSettings(initialTenantId),
                    ]);
                } else {
                    console.warn('QuoteBuilder: No initialTenantId provided');
                }

                // C. Generate Quote Number
                const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                const randomSuffix = Math.floor(Math.random() * 999).toString().padStart(3, '0');
                setQuoteNumber(`QT-${dateStr}-${randomSuffix}`);

            } catch (error) {
                console.error('Initialization Error:', error);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [initialTenantId]);

    // --- Data Fetching ---

    const fetchCustomers = async (tid: string) => {
        const { data } = await supabase
            .from('cards')
            .select('id, display_name, type')
            .eq('tenant_id', tid);
        // .eq('type', 'person'); // REMOVED to include Organizations

        if (data) {
            setCustomers(data.map(d => ({
                id: d.id,
                name: d.display_name,
                type: d.type as 'person' | 'organization'
            })));
        }
    };

    const fetchPriceLists = async (tid: string) => {
        const result = await getPriceLists(tid);
        if (result.success && result.data) {
            setPriceLists(result.data.map(pl => ({ id: pl.id, name: pl.name })));
        } else {
            // Fallback if no price lists exist yet
            setPriceLists([]);
        }
    };

    const fetchTenantSettings = async (tid: string) => {
        const { data } = await supabase
            .from('tenants')
            .select('min_margin_pct')
            .eq('id', tid)
            .single();
        if (data?.min_margin_pct != null) {
            setMinMarginPct(parseFloat(data.min_margin_pct));
        }
    };

    // Moved to Server Action to bypass RLS issues

    const fetchMasterData = async (tid: string) => {
        try {
            console.log('Fetching master data via Server Action for:', tid);
            const result = await getProductsForTenant(tid);

            if (!result.success) {
                console.error('Failed to fetch master data:', result.error);
                return;
            }

            const { products: fetchedProducts, categories: fetchedCategories } = result.data;

            // Set Categories
            if (fetchedCategories) {
                const mappedCats: Category[] = fetchedCategories.map((c: any) => ({
                    id: c.id,
                    parent_id: c.parent_id,
                    name: c.name,
                    path: c.path,
                    depth: c.path.split('.').length
                }));
                setCategories(mappedCats);
            }

            // Set Products
            if (fetchedProducts) {
                const mappedProds: Product[] = fetchedProducts.map((p: any) => ({
                    id: p.id,
                    sku: p.sku,
                    name: p.name,
                    cost_price: p.cost_price,
                    list_price: p.list_price || p.cost_price * 1.3,
                    price: p.list_price || p.cost_price * 1.3, // ProductSelector expects 'price' field
                    currency: p.currency || 'ILS',
                    price_source: p.price_source || 'manual',
                    track_inventory: p.track_inventory,
                    category_id: p.category_id,
                    current_stock: p.current_stock
                }));
                setProducts(mappedProds);
            }
            console.log('Master data loaded:', fetchedProducts?.length ?? 0, 'products');

        } catch (error) {
            console.error('Failed to fetch master data:', error);
        }
    };

    // --- Logic ---

    // 1. Build Tree
    const categoryTree = useMemo(() => {
        const buildTree = (parentId: string | null): Category[] => {
            return categories
                .filter(c => c.parent_id === parentId)
                .map(c => ({ ...c, children: buildTree(c.id) }));
        };
        return buildTree(null);
    }, [categories]);

    // 2. Filter Products
    const filteredProducts = useMemo(() => {
        let result = products;

        // By Category (Recursive match logic: path <@ selected_path)
        // Client-side simulation of ltree <@ for responsiveness
        if (selectedCategoryPath) {
            // Find category that matches text path start
            result = result.filter(p => {
                const cat = categories.find(c => c.id === p.category_id);
                return cat && (cat.path === selectedCategoryPath || cat.path.startsWith(selectedCategoryPath + '.'));
            });
        }

        // By Search
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(p =>
                p.name.toLowerCase().includes(lower) ||
                p.sku.toLowerCase().includes(lower)
            );
        }

        return result;
    }, [products, selectedCategoryPath, categories, searchTerm]);

    // 3. Resolve effective price via RPC
    const resolveEffectivePrice = async (productId: string, quantity: number): Promise<{
        price: number;
        source: QuoteItem['price_source'];
        listName?: string;
    }> => {
        if (!tenantId) return { price: 0, source: 'manual' };
        try {
            const result = await getEffectivePrice(
                tenantId,
                productId,
                selectedCustomerId || undefined,
                quantity
            );
            if (result.success && result.data) {
                return {
                    price: result.data.effectivePrice,
                    source: result.data.priceSource,
                    listName: result.data.priceListName,
                };
            }
        } catch (err) {
            console.warn('getEffectivePrice failed, falling back to base price:', err);
        }
        // Fallback: use product base price
        const product = products.find(p => p.id === productId);
        return { price: product?.list_price ?? 0, source: 'base_price' };
    };

    // 4. Add to Quote
    const addToQuote = async (product: Product) => {
        // NEW: Check if product requires configuration
        if (product.is_configurable && product.template_id) {
            setCurrentTemplateId(product.template_id);
            setConfiguratorOpen(true);
            return;
        }

        // Standard product flow
        if (product.track_inventory && (product.current_stock || 0) <= 0) {
            // Optional: Allow backorder or block? For now warning only
        }

        // Check if product already in quote → increment qty and re-price
        const existing = quoteItems.find(item => item.product_id === product.id);
        if (existing) {
            const newQty = existing.quantity + 1;
            const resolved = await resolveEffectivePrice(product.id, newQty);
            setQuoteItems(prev => prev.map(item => item.product_id === product.id
                ? {
                    ...item,
                    quantity: newQty,
                    unit_price: resolved.price,
                    line_total: calculateLineTotal(newQty, resolved.price, item.discount_percent),
                    price_source: resolved.source,
                    price_list_name: resolved.listName,
                }
                : item
            ));
            return;
        }

        // New Item — resolve effective price
        const resolved = await resolveEffectivePrice(product.id, 1);
        setQuoteItems(prev => [...prev, {
            id: crypto.randomUUID(),
            product_id: product.id,
            sku: product.sku,
            name: product.name,
            quantity: 1,
            unit_price: resolved.price,
            discount_percent: 0,
            line_total: resolved.price,
            price_source: resolved.source,
            price_list_name: resolved.listName,
        }]);
    };

    // Handle configured product addition
    const handleConfiguredProductAdd = (configuration: Configuration) => {
        setQuoteItems(prev => [...prev, {
            id: crypto.randomUUID(),
            product_id: configuration.templateId,
            configuration_id: configuration.id,
            sku: configuration.id.substring(0, 8), // Use config ID as SKU
            name: `Configured Product`, // TODO: Get template name
            quantity: configuration.quantity,
            unit_price: configuration.totalPrice / configuration.quantity,
            discount_percent: 0,
            line_total: configuration.totalPrice
        }]);
        setConfiguratorOpen(false);
    };

    const updateItem = async (id: string, field: keyof QuoteItem, value: number) => {
        const item = quoteItems.find(i => i.id === id);
        if (!item) return;

        // If quantity changes, re-resolve effective price (different min_qty tier may apply)
        if (field === 'quantity') {
            const resolved = await resolveEffectivePrice(item.product_id, value);
            setQuoteItems(prev => prev.map(i => {
                if (i.id !== id) return i;
                return {
                    ...i,
                    quantity: value,
                    unit_price: resolved.price,
                    line_total: calculateLineTotal(value, resolved.price, i.discount_percent),
                    price_source: resolved.source,
                    price_list_name: resolved.listName,
                };
            }));
        } else {
            setQuoteItems(prev => prev.map(i => {
                if (i.id !== id) return i;
                const updated = { ...i, [field]: value };
                updated.line_total = calculateLineTotal(updated.quantity, updated.unit_price, updated.discount_percent);
                return updated;
            }));
        }
    };

    const removeItem = (id: string) => {
        setQuoteItems(prev => prev.filter(i => i.id !== id));
    };

    const calculateLineTotal = (qty: number, price: number, disc: number) => {
        return qty * price * (1 - disc / 100);
    };

    // 4. Totals + Margin Warning (C3)
    const totals = useMemo(() => {
        const subtotal = quoteItems.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
        const totalLineTotals = quoteItems.reduce((acc, item) => acc + item.line_total, 0);
        const discountAmount = subtotal - totalLineTotals;
        const tax = totalLineTotals * 0.17; // 17% VAT
        const grandTotal = totalLineTotals + tax;

        // Margin calculation: (revenue - cost) / revenue * 100
        const totalCost = quoteItems.reduce((acc, item) => {
            const product = products.find(p => p.id === item.product_id);
            return acc + (product?.cost_price ?? 0) * item.quantity;
        }, 0);
        const marginPct = totalLineTotals > 0 ? ((totalLineTotals - totalCost) / totalLineTotals) * 100 : 0;
        const isBelowMinMargin = marginPct < minMarginPct && quoteItems.length > 0;

        return { subtotal, discountAmount, tax, grandTotal, marginPct, isBelowMinMargin };
    }, [quoteItems, products, minMarginPct]);

    // 5. Save Logic
    const handleSave = async (): Promise<string | null> => {
        if (!tenantId || !selectedCustomerId) {
            alert('Missing Tenant or Customer');
            return null;
        }

        try {
            setLoading(true);
            // Create Order
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                    tenant_id: tenantId,
                    customer_id: selectedCustomerId,
                    order_number: quoteNumber,
                    order_type: 'quote',
                    status: 'draft',
                    total_amount: totals.grandTotal,
                })
                .select()
                .single();

            if (orderError) throw orderError;

            // Create Items
            const lines = quoteItems.map((item) => ({
                tenant_id: tenantId,
                order_id: order.id,
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.line_total
            }));

            const { error: linesError } = await supabase.from('order_items').insert(lines);
            if (linesError) throw linesError;

            alert('Quote Saved Successfully!');
            setQuoteItems([]);
            return order.id;

        } catch (e: any) {
            console.error(e);
            alert('Failed to save quote: ' + e.message);
            return null;
        } finally {
            setLoading(false);
        }
    };


    // --- Render Helpers ---

    const renderCategoryNode = (cat: Category) => {
        const isSelected = selectedCategoryPath === cat.path;
        const hasChildren = cat.children && cat.children.length > 0;

        return (
            <div key={cat.id} className="select-none">
                <div
                    onClick={() => setSelectedCategoryPath(cat.path)}
                    className={`
            flex items-center gap-2 px-3 py-2 cursor-pointer rounded-md text-sm transition-colors
            ${isSelected ? 'bg-indigo-50 text-indigo-700 font-medium' : 'hover:bg-slate-100 text-slate-700'}
          `}
                    style={{ paddingLeft: `${cat.depth * 12 + 12}px` }}
                >
                    {/* Icon based on hasChildren logic? Simple for now */}
                    {hasChildren ? <FolderOpen size={16} /> : <Folder size={16} />}
                    <span>{cat.name}</span>
                </div>

                {hasChildren && (
                    <div className="pl-0">
                        {cat.children!.map(child => renderCategoryNode(child))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans">

            {/* --- HEADER --- */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-indigo-600 rounded-lg text-white">
                        <ShoppingCart size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Quote Builder</h1>
                        <div className="text-xs text-slate-500 flex items-center gap-2">
                            <span className="font-mono bg-slate-100 px-1 rounded">{quoteNumber}</span>
                            <span>•</span>
                            <span>{new Date().toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <label className="text-xs font-medium text-slate-500 mb-1">Customer</label>
                        <Popover.Root open={openCustomer} onOpenChange={setOpenCustomer}>
                            <Popover.Trigger asChild>
                                <button
                                    role="combobox"
                                    aria-expanded={openCustomer}
                                    className="flex items-center justify-between border border-slate-300 rounded px-2 py-1 text-sm bg-white min-w-[220px] hover:bg-slate-50 transition-colors"
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        {selectedCustomerId ? (
                                            <>
                                                {customers.find(c => c.id === selectedCustomerId)?.type === 'organization' ? <Building2 size={14} className="text-slate-400" /> : <UserCircle size={14} className="text-slate-400" />}
                                                <span className="truncate max-w-[160px]">{customers.find(c => c.id === selectedCustomerId)?.name}</span>
                                            </>
                                        ) : (
                                            <span className="text-slate-500">Select Customer...</span>
                                        )}
                                    </div>
                                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                </button>
                            </Popover.Trigger>
                            <Popover.Portal>
                                <Popover.Content className="w-[220px] p-0 bg-white border border-slate-200 shadow-xl rounded-lg z-50 animate-in fade-in zoom-in-95" align="start">
                                    <Command className="w-full">
                                        <div className="flex items-center border-b border-slate-100 px-3">
                                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                            <Command.Input
                                                placeholder="Search customers..."
                                                className="flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50 border-none focus:ring-0"
                                            />
                                        </div>
                                        <Command.List className="max-h-[250px] overflow-y-auto overflow-x-hidden p-1">
                                            <Command.Empty className="py-6 text-center text-sm text-slate-500">No customer found.</Command.Empty>
                                            <Command.Group>
                                                {customers.map((customer) => (
                                                    <Command.Item
                                                        key={customer.id}
                                                        value={customer.name}
                                                        onSelect={() => {
                                                            setSelectedCustomerId(customer.id)
                                                            setOpenCustomer(false)
                                                        }}
                                                        className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm outline-none hover:bg-indigo-50 hover:text-indigo-700 aria-selected:bg-indigo-50 aria-selected:text-indigo-700 transition-colors group"
                                                    >
                                                        <div className="mr-2 flex h-4 w-4 items-center justify-center opacity-50 group-hover:opacity-100">
                                                            {customer.type === 'organization' ? <Building2 size={14} /> : <UserCircle size={14} />}
                                                        </div>
                                                        <span className="flex-1 truncate">{customer.name}</span>
                                                        {selectedCustomerId === customer.id && (
                                                            <Check className="ml-auto h-4 w-4 text-indigo-600" />
                                                        )}
                                                    </Command.Item>
                                                ))}
                                            </Command.Group>
                                        </Command.List>
                                    </Command>
                                </Popover.Content>
                            </Popover.Portal>
                        </Popover.Root>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-xs font-medium text-slate-500">Price List</label>
                        <select
                            className="border border-slate-300 rounded px-2 py-1 text-sm bg-white min-w-[150px]"
                            value={selectedPriceListId}
                            onChange={(e) => setSelectedPriceListId(e.target.value)}
                        >
                            <option value="standard">Standard</option>
                            {priceLists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>

                    <div className="h-8 w-px bg-slate-300 mx-2"></div>

                    <button
                        onClick={handleSave}
                        disabled={quoteItems.length === 0 || !selectedCustomerId}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                    >
                        <CloudUpload size={18} />
                        Save Quote
                    </button>
                </div>
            </header>

            {/* --- MAIN CONTENT --- */}
            <div className="flex flex-1 overflow-hidden">

                <main className="flex-1 flex flex-col bg-slate-50/50 min-w-0">
                    <div className="flex-1 overflow-hidden min-h-0">
                        {/* New Unified View */}
                        <ViewConfigProvider>
                            <ProductSelector
                                products={products}
                                categories={categories}
                                loading={loading}
                                onAddToQuote={addToQuote}
                                onAddConfiguration={handleConfiguredProductAdd}
                                onRefresh={() => {
                                    setLoading(true);
                                    loadData();
                                }}
                            />
                        </ViewConfigProvider>
                    </div>
                </main>

                {/* RIGHT PANEL: CART */}
                <aside className="w-96 bg-white border-l border-slate-200 flex flex-col shadow-xl z-10">
                    <div className="p-4 border-b border-slate-200 font-semibold text-slate-700 bg-slate-50/50">
                        Quote Items ({quoteItems.length})
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {quoteItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                                <ShoppingCart size={48} className="opacity-20" />
                                <p>Your quote is empty</p>
                            </div>
                        ) : (
                            quoteItems.map(item => (
                                <div key={item.id} className="bg-white border border-slate-100 rounded-lg p-3 shadow-sm hover:border-slate-300 transition-colors group">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-slate-800 text-sm truncate">{item.name}</h4>
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs text-slate-400 font-mono">{item.sku}</p>
                                                {item.price_source && item.price_source !== 'manual' && (
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${item.price_source === 'bom' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                                        : item.price_source === 'cpq' ? 'bg-violet-50 text-violet-600 border border-violet-200'
                                                            : item.price_source === 'customer_list' ? 'bg-blue-50 text-blue-600 border border-blue-200'
                                                                : item.price_source === 'general_list' ? 'bg-cyan-50 text-cyan-600 border border-cyan-200'
                                                                    : 'bg-slate-50 text-slate-500 border border-slate-200'
                                                        }`}
                                                        title={item.price_list_name || undefined}
                                                    >
                                                        {item.price_source === 'bom' ? 'BOM'
                                                            : item.price_source === 'cpq' ? 'CPQ'
                                                                : item.price_list_name || (item.price_source === 'base_price' ? 'Base Price' : item.price_source)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeItem(item.id)}
                                            className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>

                                    {/* Unit Price (editable) */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">Price</span>
                                        <div className="flex items-center border border-slate-200 rounded-md px-2 py-1 gap-1 flex-1">
                                            <span className="text-xs text-slate-400">{getCurrencySymbol(quoteCurrency, quoteLocale)}</span>
                                            <input
                                                className="w-full text-right text-sm outline-none font-medium"
                                                value={item.unit_price}
                                                onChange={(e) => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {/* Qty Control */}
                                        <div className="flex items-center border border-slate-200 rounded-md">
                                            <button
                                                className="px-2 py-1 text-slate-500 hover:bg-slate-100"
                                                onClick={() => updateItem(item.id, 'quantity', Math.max(1, item.quantity - 1))}
                                            >
                                                <Minus size={14} />
                                            </button>
                                            <input
                                                className="w-10 text-center text-sm font-medium outline-none"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                                            />
                                            <button
                                                className="px-2 py-1 text-slate-500 hover:bg-slate-100"
                                                onClick={() => updateItem(item.id, 'quantity', item.quantity + 1)}
                                            >
                                                <Plus size={14} />
                                            </button>
                                        </div>

                                        {/* Disc Control */}
                                        <div className="flex items-center border border-slate-200 rounded-md px-2 py-1 gap-1 w-20">
                                            <span className="text-xs text-slate-400">%</span>
                                            <input
                                                className="w-full text-right text-sm outline-none"
                                                value={item.discount_percent}
                                                onChange={(e) => updateItem(item.id, 'discount_percent', parseFloat(e.target.value) || 0)}
                                                placeholder="0"
                                            />
                                        </div>

                                        <div className="flex-1 text-right font-medium text-slate-700">
                                            {formatCurrency(item.line_total, quoteCurrency, quoteLocale)}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* SUMMARY FOOTER */}
                    <div className="bg-slate-50 border-t border-slate-200 p-4 space-y-2">
                        <div className="flex justify-between text-sm text-slate-600">
                            <span>Subtotal</span>
                            <span>{formatCurrency(totals.subtotal, quoteCurrency, quoteLocale)}</span>
                        </div>
                        {totals.discountAmount > 0 && (
                            <div className="flex justify-between text-sm text-green-600">
                                <span>Discount</span>
                                <span>-{formatCurrency(totals.discountAmount, quoteCurrency, quoteLocale)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-sm text-slate-600">
                            <span>Tax (17%)</span>
                            <span>{formatCurrency(totals.tax, quoteCurrency, quoteLocale)}</span>
                        </div>

                        {/* C3: Margin Warning Badge */}
                        {quoteItems.length > 0 && (
                            <div className={`flex items-center justify-between text-sm px-2 py-1.5 rounded-lg ${totals.isBelowMinMargin ? 'bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800' : 'bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'}`}>
                                <span className={`flex items-center gap-1.5 font-medium ${totals.isBelowMinMargin ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                                    {totals.isBelowMinMargin && <AlertTriangle className="w-3.5 h-3.5" />}
                                    Margin
                                </span>
                                <span className={`font-mono font-semibold ${totals.isBelowMinMargin ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                                    {totals.marginPct.toFixed(1)}%{totals.isBelowMinMargin ? ` (min ${minMarginPct}%)` : ''}
                                </span>
                            </div>
                        )}

                        {/* Submit for Approval button when margin is below threshold */}
                        {totals.isBelowMinMargin && (
                            <button
                                onClick={async () => {
                                    if (!quoteNumber) return;
                                    setSubmittingForApproval(true);
                                    try {
                                        // 1. Save the quote first to ensure latest data is persisted
                                        const savedQuoteId = await handleSave();

                                        // 2. Call validateQuoteMargin with the saved quote ID
                                        if (savedQuoteId) {
                                            const result = await validateQuoteMargin(savedQuoteId);
                                            if (result.success) {
                                                alert('Quote submitted for margin approval.');
                                            } else {
                                                alert(`Approval submission failed: ${result.error}`);
                                            }
                                        }
                                    } catch (err) {
                                        alert('Failed to submit for approval');
                                    }
                                    setSubmittingForApproval(false);
                                }}
                                disabled={submittingForApproval || !selectedCustomerId}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
                            >
                                {submittingForApproval ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <AlertTriangle className="w-4 h-4" />
                                )}
                                Submit for Approval
                            </button>
                        )}

                        <div className="border-t border-slate-200 my-2 pt-2">
                            <div className="flex justify-between text-lg font-bold text-slate-900">
                                <span>Total</span>
                                <span>{formatCurrency(totals.grandTotal, quoteCurrency, quoteLocale)}</span>
                            </div>
                        </div>

                        {/* Generate Invoice button — visible when quote has been saved */}
                        {quoteNumber && selectedCustomerId && (
                            <button
                                onClick={async () => {
                                    const savedQuoteId = await handleSave();
                                    if (savedQuoteId) {
                                        const result = await createInvoiceFromQuote(tenantId, savedQuoteId);
                                        if (result.success) {
                                            alert('Invoice created successfully. Go to Invoices to issue it.');
                                        } else {
                                            alert(`Failed to create invoice: ${result.error}`);
                                        }
                                    }
                                }}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                            >
                                <FileText className="w-4 h-4" />
                                Generate Invoice
                            </button>
                        )}
                    </div>
                </aside>

            </div>

            {/* CPQ Product Configurator Modal */}
            {currentTemplateId && (
                <ProductConfiguratorModal
                    isOpen={configuratorOpen}
                    templateId={currentTemplateId}
                    onClose={() => setConfiguratorOpen(false)}
                    onAddToQuote={handleConfiguredProductAdd}
                />
            )}
        </div>
    );
}
