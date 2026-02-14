"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

// ============================================================================
// TYPES
// ============================================================================

export interface ProductTemplate {
    id: string;
    tenantId: string;
    name: string;
    description: string | null;
    basePrice: number;
    baseProductId: string | null;
    categoryId: string | null;
    categoryName: string | null;
    imageUrl: string | null;
    displayMode: "single_page" | "wizard";
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface OptionGroup {
    id: string;
    templateId: string;
    name: string;
    description: string | null;
    displayOrder: number;
    iconUrl: string | null;
    selectionType: "single" | "multiple";
    isRequired: boolean;
    minSelections: number;
    maxSelections: number | null;
    sourceType: "manual" | "category";
    sourceCategoryId: string | null;
    sourceCategoryPath: string | null;
    categoryPriceMode: "list_price" | "cost_plus" | "explicit" | null;
    options: Option[];
}

export interface Option {
    id: string;
    name: string;
    description: string | null;
    sku: string | null;
    productId: string | null;
    priceModifierType: "add" | "multiply" | "replace";
    priceModifierAmount: number;
    isDefault: boolean;
    isAvailable: boolean;
    availabilityNote: string | null;
    displayOrder: number;
    imageUrl: string | null;
    source: "manual" | "category";
}

export interface ConfigurationRule {
    id: string;
    templateId: string;
    ruleType: "requires" | "conflicts" | "hides" | "price_tier" | "auto_select";
    name: string;
    description: string | null;
    errorMessage: string | null;
    ifOptionId: string | null;
    ifGroupId: string | null;
    ifProductId: string | null;
    thenOptionId: string | null;
    thenGroupId: string | null;
    thenProductId: string | null;
    quantityMin: number | null;
    quantityMax: number | null;
    discountType: "percentage" | "fixed_amount" | null;
    discountValue: number | null;
    priority: number;
    isActive: boolean;
}

export interface TemplatePreset {
    id: string;
    templateId: string;
    name: string;
    description: string | null;
    selectedOptions: Record<string, string>;
    displayOrder: number;
    imageUrl: string | null;
    badgeText: string | null;
    cachedTotalPrice: number | null;
    isActive: boolean;
}

export interface GetTemplateResponse {
    template: ProductTemplate;
    optionGroups: OptionGroup[];
    rules: ConfigurationRule[];
    presets: TemplatePreset[];
}

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Get all active product templates for the current tenant.
 * Used for template selection/catalog page.
 */
export async function getTemplates(params?: {
    page?: number;
    pageSize?: number;
    categoryId?: string;
    search?: string;
    isActive?: boolean;
}): Promise<{
    success: boolean;
    data?: ProductTemplate[];
    meta?: { page: number; pageSize: number; total: number };
    error?: string;
}> {
    try {

        const supabase = await createClient();

        const page = params?.page || 1;
        const pageSize = Math.min(params?.pageSize || 20, 100);
        const isActive = params?.isActive !== undefined ? params.isActive : true;

        let query = supabase
            .from("product_templates")
            .select(`
        *,
        product_categories(name)
      `, { count: "exact" })
            .eq("is_active", isActive)
            .order("name");

        if (params?.categoryId) {
            query = query.eq("category_id", params.categoryId);
        }

        if (params?.search) {
            query = query.or(
                `name.ilike.%${params.search}%,description.ilike.%${params.search}%`
            );
        }

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;

        if (error) {
            console.error("Error fetching templates:", error);
            return { success: false, error: error.message };
        }

        const templates: ProductTemplate[] = (data || []).map((t: any) => ({
            id: t.id,
            tenantId: t.tenant_id,
            name: t.name,
            description: t.description,
            basePrice: parseFloat(t.base_price || "0"),
            baseProductId: t.base_product_id,
            categoryId: t.category_id,
            categoryName: t.product_categories?.name || null,
            imageUrl: t.image_url,
            displayMode: t.display_mode,
            isActive: t.is_active,
            createdAt: t.created_at,
            updatedAt: t.updated_at,
        }));

        return {
            success: true,
            data: templates,
            meta: { page, pageSize, total: count || 0 },
        };
    } catch (error: any) {
        console.error("Error in getTemplates:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Get a single template with ALL option groups, options, rules, and presets.
 * This is the primary endpoint for the configurator frontend.
 * 
 * Performance: Should be cached (5min TTL, invalidate on admin changes).
 */
export async function getTemplateById(
    templateId: string
): Promise<{
    success: boolean;
    data?: GetTemplateResponse;
    error?: string;
}> {
    try {

        const supabase = await createClient();

        // 1. Get template
        const { data: templateData, error: templateError } = await supabase
            .from("product_templates")
            .select(`
        *,
        product_categories(name)
      `)
            .eq("id", templateId)
            .eq("is_active", true)
            .single();

        if (templateError || !templateData) {
            return { success: false, error: "Template not found or inactive" };
        }

        const template: ProductTemplate = {
            id: templateData.id,
            tenantId: templateData.tenant_id,
            name: templateData.name,
            description: templateData.description,
            basePrice: parseFloat(templateData.base_price || "0"),
            baseProductId: templateData.base_product_id,
            categoryId: templateData.category_id,
            categoryName: templateData.product_categories?.name || null,
            imageUrl: templateData.image_url,
            displayMode: templateData.display_mode,
            isActive: templateData.is_active,
            createdAt: templateData.created_at,
            updatedAt: templateData.updated_at,
        };

        // 2. Get option groups
        const { data: groupsData, error: groupsError } = await supabase
            .from("option_groups")
            .select(`
        *,
        product_categories(path)
      `)
            .eq("template_id", templateId)
            .order("display_order");

        if (groupsError) {
            return { success: false, error: groupsError.message };
        }

        // 3. For each group, get options (using get_group_options function)
        const optionGroups: OptionGroup[] = [];

        for (const group of groupsData || []) {
            const { data: optionsData, error: optionsError } = await supabase.rpc(
                "get_group_options",
                {
                    p_group_id: group.id,
                    p_tenant_id: templateData.tenant_id,
                }
            );

            if (optionsError) {
                console.error(`Error fetching options for group ${group.id}:`, optionsError);
                continue;
            }

            const options: Option[] = (optionsData || []).map((o: any) => ({
                id: o.option_id,
                name: o.option_name,
                description: o.option_description,
                sku: o.option_sku,
                productId: o.linked_product_id,
                priceModifierType: o.price_modifier_type,
                priceModifierAmount: parseFloat(o.price_modifier_amount || "0"),
                isDefault: o.is_default,
                isAvailable: o.is_available,
                availabilityNote: null,
                displayOrder: o.display_order,
                imageUrl: null,
                source: o.source,
            }));

            optionGroups.push({
                id: group.id,
                templateId: group.template_id,
                name: group.name,
                description: group.description,
                displayOrder: group.display_order,
                iconUrl: group.icon_url,
                selectionType: group.selection_type,
                isRequired: group.is_required,
                minSelections: group.min_selections,
                maxSelections: group.max_selections,
                sourceType: group.source_type,
                sourceCategoryId: group.source_category_id,
                sourceCategoryPath: group.product_categories?.path || null,
                categoryPriceMode: group.category_price_mode,
                options,
            });
        }

        // 4. Get rules
        const { data: rulesData, error: rulesError } = await supabase
            .from("configuration_rules")
            .select("*")
            .eq("template_id", templateId)
            .eq("is_active", true)
            .order("priority");

        const rules: ConfigurationRule[] = (rulesData || []).map((r: any) => ({
            id: r.id,
            templateId: r.template_id,
            ruleType: r.rule_type,
            name: r.name,
            description: r.description,
            errorMessage: r.error_message,
            ifOptionId: r.if_option_id,
            ifGroupId: r.if_group_id,
            ifProductId: r.if_product_id,
            thenOptionId: r.then_option_id,
            thenGroupId: r.then_group_id,
            thenProductId: r.then_product_id,
            quantityMin: r.quantity_min,
            quantityMax: r.quantity_max,
            discountType: r.discount_type,
            discountValue: r.discount_value ? parseFloat(r.discount_value) : null,
            priority: r.priority,
            isActive: r.is_active,
        }));

        // 5. Get presets
        const { data: presetsData, error: presetsError } = await supabase
            .from("template_presets")
            .select("*")
            .eq("template_id", templateId)
            .eq("is_active", true)
            .order("display_order");

        const presets: TemplatePreset[] = (presetsData || []).map((p: any) => ({
            id: p.id,
            templateId: p.template_id,
            name: p.name,
            description: p.description,
            selectedOptions: p.selected_options as Record<string, string>,
            displayOrder: p.display_order,
            imageUrl: p.image_url,
            badgeText: p.badge_text,
            cachedTotalPrice: p.cached_total_price ? parseFloat(p.cached_total_price) : null,
            isActive: p.is_active,
        }));

        return {
            success: true,
            data: {
                template,
                optionGroups,
                rules,
                presets,
            },
        };
    } catch (error: any) {
        console.error("Error in getTemplateById:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Create a new product template.
 */
export async function createTemplate(params: {
    name: string;
    description?: string;
    basePrice: number;
    categoryId?: string;
    displayMode?: "single_page" | "wizard";
}): Promise<{
    success: boolean;
    data?: ProductTemplate;
    error?: string;
}> {
    try {
        const supabase = await createClient();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: "Authentication required" };
        }

        // Try to get tenant_id from app_metadata first
        let tenantId = user.app_metadata?.tenant_id || user.user_metadata?.tenant_id;

        // If not found, try to get it from profiles table
        if (!tenantId) {
            const { data: profile, error: profileError } = await supabase
                .from("profiles")
                .select("tenant_id")
                .eq("id", user.id)
                .single();

            if (!profileError && profile) {
                tenantId = profile.tenant_id;
            }
        }

        if (!tenantId) {
            return { success: false, error: "Tenant ID required. Please make sure you are assigned to a tenant." };
        }

        const { data, error } = await supabase
            .from("product_templates")
            .insert({
                tenant_id: tenantId,
                name: params.name,
                description: params.description || null,
                base_price: params.basePrice,
                category_id: params.categoryId || null,
                display_mode: params.displayMode || "single_page",
                is_active: true,
            })
            .select(`
                *,
                product_categories(name)
            `)
            .single();

        if (error) {
            console.error("Error creating template:", error);
            return { success: false, error: error.message };
        }

        const template: ProductTemplate = {
            id: data.id,
            tenantId: data.tenant_id,
            name: data.name,
            description: data.description,
            basePrice: parseFloat(data.base_price || "0"),
            baseProductId: data.base_product_id,
            categoryId: data.category_id,
            categoryName: data.product_categories?.name || null,
            imageUrl: data.image_url,
            displayMode: data.display_mode,
            isActive: data.is_active,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
        };

        return { success: true, data: template };
    } catch (error: any) {
        console.error("Error in createTemplate:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Update an existing template's settings.
 * Used by the Template Editor Settings form.
 */
export async function updateTemplate(
    templateId: string,
    params: {
        name?: string;
        description?: string;
        basePrice?: number;
        displayMode?: "single_page" | "wizard";
        imageUrl?: string;
        categoryId?: string | null;
        baseProductId?: string | null;
        isActive?: boolean;
    }
): Promise<{ success: boolean; data?: ProductTemplate; error?: string }> {
    try {
        const supabase = await createClient();

        // 1. Auth check
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: "Authentication required" };
        }

        // 2. Build update object (only include provided fields)
        const updateData: any = {
            updated_at: new Date().toISOString(),
        };

        if (params.name !== undefined) updateData.name = params.name;
        if (params.description !== undefined)
            updateData.description = params.description || null;
        if (params.basePrice !== undefined) updateData.base_price = params.basePrice;
        if (params.displayMode !== undefined)
            updateData.display_mode = params.displayMode;
        if (params.imageUrl !== undefined)
            updateData.image_url = params.imageUrl || null;
        if (params.categoryId !== undefined)
            updateData.category_id = params.categoryId || null;
        if (params.baseProductId !== undefined)
            updateData.base_product_id = params.baseProductId || null;
        if (params.isActive !== undefined) updateData.is_active = params.isActive;

        // 3. Update in DB - RLS will handle tenant isolation
        const { data, error } = await supabase
            .from("product_templates")
            .update(updateData)
            .eq("id", templateId)
            .select(
                `
        *,
        product_categories(name)
      `
            )
            .single();

        if (error) {
            console.error("Error updating template:", error);
            if (error.code === "23505") {
                return { success: false, error: "A template with this name already exists" };
            }
            return { success: false, error: error.message };
        }

        const template: ProductTemplate = {
            id: data.id,
            tenantId: data.tenant_id,
            name: data.name,
            description: data.description,
            basePrice: parseFloat(data.base_price || "0"),
            baseProductId: data.base_product_id,
            categoryId: data.category_id,
            categoryName: data.product_categories?.name || null,
            imageUrl: data.image_url,
            displayMode: data.display_mode,
            isActive: data.is_active,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
        };

        return { success: true, data: template };
    } catch (error: any) {
        console.error("Error in updateTemplate:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Toggle template active status (publish/unpublish).
 * Only allow publishing if template has at least one option group.
 */
export async function toggleTemplateActive(
    templateId: string
): Promise<{ success: boolean; data?: { isActive: boolean }; error?: string }> {
    try {
        const supabase = await createClient();

        // 1. Auth check
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: "Authentication required" };
        }

        // 2. Get current template status
        const { data: template, error: fetchError } = await supabase
            .from("product_templates")
            .select("is_active")
            .eq("id", templateId)
            .single();

        if (fetchError || !template) {
            return { success: false, error: "Template not found" };
        }

        const newStatus = !template.is_active;

        // 3. If publishing, verify template has option groups
        if (newStatus) {
            const { count, error: countError } = await supabase
                .from("option_groups")
                .select("id", { count: "exact", head: true })
                .eq("template_id", templateId);

            if (countError) {
                return { success: false, error: "Failed to verify template" };
            }

            if (!count || count === 0) {
                return {
                    success: false,
                    error: "Cannot publish template without option groups",
                };
            }
        }

        // 4. Toggle status
        const { error: updateError } = await supabase
            .from("product_templates")
            .update({ is_active: newStatus, updated_at: new Date().toISOString() })
            .eq("id", templateId);

        if (updateError) {
            return { success: false, error: updateError.message };
        }

        return { success: true, data: { isActive: newStatus } };
    } catch (error: any) {
        console.error("Error in toggleTemplateActive:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Get all products in a category (for category-sourced option groups)
 */
export async function getCategoryProducts(categoryId: string): Promise<{
    success: boolean;
    data?: Array<{
        id: string;
        name: string;
        sku: string | null;
        listPrice: number;
        imageUrl: string | null;
    }>;
    error?: string;
}> {
    try {
        const supabase = await createClient();

        // 1. Auth check
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: "Authentication required" };
        }

        // 2. Fetch products
        const { data, error } = await supabase
            .from("products")
            .select("id, name, sku, list_price, image_url")
            .eq("category_id", categoryId)
            .eq("is_active", true)
            .order("name");

        if (error) {
            console.error("Error fetching category products:", error);
            return { success: false, error: error.message };
        }

        // 3. Transform to camelCase
        const products = (data || []).map((p) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            listPrice: parseFloat(p.list_price || "0"),
            imageUrl: p.image_url,
        }));

        return { success: true, data: products };
    } catch (error: any) {
        console.error("Error in getCategoryProducts:", error);
        return { success: false, error: error.message };
    }
}
