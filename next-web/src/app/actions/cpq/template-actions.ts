"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantId } from "@/lib/auth/tenant";

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
    allowedOptions: string[] | null; // For 'requires' rules: list of valid option IDs from then_group
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

        let query = supabase
            .from("product_templates")
            .select(`
        *,
        product_categories(name)
      `, { count: "exact" })
            .order("name");

        // Only filter by is_active when explicitly provided
        if (params?.isActive !== undefined) {
            query = query.eq("is_active", params.isActive);
        }

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
            allowedOptions: r.allowed_options || null,
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

        // Try to get tenant_id
        const tenantId = await getTenantId(user, supabase);

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

// ==================== Delete Templates ====================

export async function deleteTemplates(
    templateIds: string[]
): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
    try {
        if (!templateIds || templateIds.length === 0) {
            return { success: false, error: "No template IDs provided" };
        }

        // Use admin client to bypass RLS for delete operations
        const admin = createAdminClient();

        // 1. Get all option groups for these templates
        const { data: groups } = await admin
            .from("option_groups")
            .select("id")
            .in("template_id", templateIds);

        const groupIds = (groups || []).map((g) => g.id);

        // 2. Delete options belonging to those groups
        if (groupIds.length > 0) {
            const { error: optionsError } = await admin
                .from("options")
                .delete()
                .in("group_id", groupIds);

            if (optionsError) {
                console.error("Error deleting options:", optionsError);
                return { success: false, error: `Failed to delete options: ${optionsError.message}` };
            }
        }

        // 3. Delete option groups
        if (groupIds.length > 0) {
            const { error: groupsError } = await admin
                .from("option_groups")
                .delete()
                .in("id", groupIds);

            if (groupsError) {
                console.error("Error deleting option groups:", groupsError);
                return { success: false, error: `Failed to delete groups: ${groupsError.message}` };
            }
        }

        // 4. Delete rules for these templates
        await admin
            .from("configuration_rules")
            .delete()
            .in("template_id", templateIds);

        // 5. Delete presets for these templates
        await admin
            .from("template_presets")
            .delete()
            .in("template_id", templateIds);

        // 6. Delete the templates themselves
        const { error: templatesError } = await admin
            .from("product_templates")
            .delete()
            .in("id", templateIds);

        if (templatesError) {
            console.error("Error deleting templates:", templatesError);
            return { success: false, error: `Failed to delete templates: ${templatesError.message}` };
        }

        return { success: true, deletedCount: templateIds.length };
    } catch (error: any) {
        console.error("Error in deleteTemplates:", error);
        return { success: false, error: error.message };
    }
}

// ==================== Duplicate Template ====================

export async function duplicateTemplate(
    templateId: string
): Promise<{ success: boolean; data?: ProductTemplate; error?: string }> {
    try {
        const supabase = await createClient();
        const admin = createAdminClient();

        // 1. Auth check
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Authentication required" };

        // 2. Fetch the complete template
        const result = await getTemplateById(templateId);
        if (!result.success || !result.data) {
            return { success: false, error: result.error || "Template not found" };
        }

        const { template, optionGroups, rules, presets } = result.data;

        // 3. Create new template
        const { data: newTemplate, error: templateError } = await admin
            .from("product_templates")
            .insert({
                tenant_id: template.tenantId,
                name: `${template.name} (עותק)`,
                description: template.description,
                base_price: template.basePrice,
                base_product_id: template.baseProductId,
                category_id: template.categoryId,
                image_url: template.imageUrl,
                display_mode: template.displayMode,
                is_active: false, // Always start as draft
            })
            .select("id")
            .single();

        if (templateError || !newTemplate) {
            return { success: false, error: templateError?.message || "Failed to create template copy" };
        }

        const newTemplateId = newTemplate.id;
        const groupIdMap: Record<string, string> = {}; // old ID → new ID
        const optionIdMap: Record<string, string> = {}; // old ID → new ID

        // 4. Copy option groups and options
        for (const group of optionGroups) {
            const { data: newGroup, error: groupError } = await admin
                .from("option_groups")
                .insert({
                    tenant_id: template.tenantId,
                    template_id: newTemplateId,
                    name: group.name,
                    description: group.description,
                    display_order: group.displayOrder,
                    icon_url: group.iconUrl,
                    selection_type: group.selectionType,
                    is_required: group.isRequired,
                    min_selections: group.minSelections,
                    max_selections: group.maxSelections,
                    source_type: group.sourceType,
                    source_category_id: group.sourceCategoryId,
                    source_category_path: group.sourceCategoryPath,
                    category_price_mode: group.categoryPriceMode,
                })
                .select("id")
                .single();

            if (groupError || !newGroup) continue;
            groupIdMap[group.id] = newGroup.id;

            // Copy options for this group
            for (const option of group.options) {
                const { data: newOption } = await admin
                    .from("options")
                    .insert({
                        tenant_id: template.tenantId,
                        group_id: newGroup.id,
                        name: option.name,
                        description: option.description,
                        sku: option.sku,
                        product_id: option.productId,
                        price_modifier_type: option.priceModifierType,
                        price_modifier_amount: option.priceModifierAmount,
                        is_default: option.isDefault,
                        is_available: option.isAvailable,
                        availability_note: option.availabilityNote,
                        display_order: option.displayOrder,
                        image_url: option.imageUrl,
                        source: option.source,
                    })
                    .select("id")
                    .single();

                if (newOption) {
                    optionIdMap[option.id] = newOption.id;
                }
            }
        }

        // 5. Copy rules (remap group/option IDs)
        for (const rule of rules) {
            await admin.from("configuration_rules").insert({
                tenant_id: template.tenantId,
                template_id: newTemplateId,
                rule_type: rule.ruleType,
                name: rule.name,
                description: rule.description,
                error_message: rule.errorMessage,
                if_option_id: rule.ifOptionId ? optionIdMap[rule.ifOptionId] || null : null,
                if_group_id: rule.ifGroupId ? groupIdMap[rule.ifGroupId] || null : null,
                if_product_id: rule.ifProductId,
                then_option_id: rule.thenOptionId ? optionIdMap[rule.thenOptionId] || null : null,
                then_group_id: rule.thenGroupId ? groupIdMap[rule.thenGroupId] || null : null,
                then_product_id: rule.thenProductId,
                allowed_options: rule.allowedOptions
                    ? rule.allowedOptions.map(id => optionIdMap[id] || id)
                    : null,
                quantity_min: rule.quantityMin,
                quantity_max: rule.quantityMax,
                discount_type: rule.discountType,
                discount_value: rule.discountValue,
                priority: rule.priority,
                is_active: rule.isActive,
            });
        }

        // 6. Copy presets (remap option IDs in selectedOptions)
        for (const preset of presets) {
            const newSelectedOptions: Record<string, string> = {};
            for (const [groupId, optionId] of Object.entries(preset.selectedOptions)) {
                const newGroupId = groupIdMap[groupId] || groupId;
                const newOptionId = optionIdMap[optionId] || optionId;
                newSelectedOptions[newGroupId] = newOptionId;
            }

            await admin.from("template_presets").insert({
                tenant_id: template.tenantId,
                template_id: newTemplateId,
                name: preset.name,
                description: preset.description,
                selected_options: newSelectedOptions,
                display_order: preset.displayOrder,
                image_url: preset.imageUrl,
                badge_text: preset.badgeText,
                cached_total_price: preset.cachedTotalPrice,
                is_active: preset.isActive,
            });
        }

        // 7. Return the new template
        const newResult = await getTemplateById(newTemplateId);
        if (newResult.success && newResult.data) {
            return { success: true, data: newResult.data.template };
        }

        return { success: true, data: { id: newTemplateId } as ProductTemplate };
    } catch (error: any) {
        console.error("Error in duplicateTemplate:", error);
        return { success: false, error: error.message };
    }
}

// ==================== Export Template as JSON ====================

export async function exportTemplateAsJson(
    templateId: string
): Promise<{ success: boolean; data?: string; error?: string }> {
    try {
        const result = await getTemplateById(templateId);
        if (!result.success || !result.data) {
            return { success: false, error: result.error || "Template not found" };
        }

        const exportData = {
            version: "1.0",
            exportedAt: new Date().toISOString(),
            template: result.data.template,
            optionGroups: result.data.optionGroups,
            rules: result.data.rules,
            presets: result.data.presets,
        };

        return { success: true, data: JSON.stringify(exportData, null, 2) };
    } catch (error: any) {
        console.error("Error in exportTemplateAsJson:", error);
        return { success: false, error: error.message };
    }
}

// ==================== Import Template from JSON ====================

export async function importTemplateFromJson(
    jsonString: string
): Promise<{ success: boolean; data?: ProductTemplate; error?: string }> {
    try {
        const supabase = await createClient();
        const admin = createAdminClient();

        // 1. Auth check
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Authentication required" };

        // 2. Get tenant ID
        const tenantId = await getTenantId(user, supabase);
        if (!tenantId) return { success: false, error: "Tenant not found" };

        // 3. Parse JSON
        let importData: any;
        try {
            importData = JSON.parse(jsonString);
        } catch {
            return { success: false, error: "Invalid JSON format" };
        }

        if (!importData.template || !importData.optionGroups) {
            return { success: false, error: "Invalid template format — missing template or optionGroups" };
        }

        const { template, optionGroups, rules, presets } = importData;

        // 4. Create template
        const { data: newTemplate, error: templateError } = await admin
            .from("product_templates")
            .insert({
                tenant_id: tenantId,
                name: `${template.name} (ייבוא)`,
                description: template.description,
                base_price: template.basePrice || 0,
                display_mode: template.displayMode || "single_page",
                image_url: template.imageUrl,
                is_active: false,
            })
            .select("id")
            .single();

        if (templateError || !newTemplate) {
            return { success: false, error: templateError?.message || "Failed to import template" };
        }

        const newTemplateId = newTemplate.id;
        const groupIdMap: Record<string, string> = {};
        const optionIdMap: Record<string, string> = {};

        // 5. Import groups and options
        for (const group of optionGroups || []) {
            const { data: newGroup } = await admin
                .from("option_groups")
                .insert({
                    tenant_id: tenantId,
                    template_id: newTemplateId,
                    name: group.name,
                    description: group.description,
                    display_order: group.displayOrder || 0,
                    icon_url: group.iconUrl,
                    selection_type: group.selectionType || "single",
                    is_required: group.isRequired ?? true,
                    min_selections: group.minSelections ?? 1,
                    max_selections: group.maxSelections,
                    source_type: group.sourceType || "manual",
                })
                .select("id")
                .single();

            if (!newGroup) continue;
            groupIdMap[group.id] = newGroup.id;

            for (const option of group.options || []) {
                const { data: newOption } = await admin
                    .from("options")
                    .insert({
                        tenant_id: tenantId,
                        group_id: newGroup.id,
                        name: option.name,
                        description: option.description,
                        sku: option.sku,
                        price_modifier_type: option.priceModifierType || "add",
                        price_modifier_amount: option.priceModifierAmount || 0,
                        is_default: option.isDefault ?? false,
                        is_available: option.isAvailable ?? true,
                        display_order: option.displayOrder || 0,
                        image_url: option.imageUrl,
                    })
                    .select("id")
                    .single();

                if (newOption) optionIdMap[option.id] = newOption.id;
            }
        }

        // 6. Import rules
        for (const rule of rules || []) {
            await admin.from("configuration_rules").insert({
                tenant_id: tenantId,
                template_id: newTemplateId,
                rule_type: rule.ruleType,
                name: rule.name,
                description: rule.description,
                error_message: rule.errorMessage,
                if_option_id: rule.ifOptionId ? optionIdMap[rule.ifOptionId] || null : null,
                if_group_id: rule.ifGroupId ? groupIdMap[rule.ifGroupId] || null : null,
                then_option_id: rule.thenOptionId ? optionIdMap[rule.thenOptionId] || null : null,
                then_group_id: rule.thenGroupId ? groupIdMap[rule.thenGroupId] || null : null,
                allowed_options: rule.allowedOptions
                    ? rule.allowedOptions.map((id: string) => optionIdMap[id] || id)
                    : null,
                priority: rule.priority || 0,
                is_active: rule.isActive ?? true,
            });
        }

        // 7. Import presets
        for (const preset of presets || []) {
            const newSelectedOptions: Record<string, string> = {};
            for (const [gId, oId] of Object.entries(preset.selectedOptions || {})) {
                newSelectedOptions[groupIdMap[gId] || gId] = optionIdMap[oId as string] || (oId as string);
            }

            await admin.from("template_presets").insert({
                tenant_id: tenantId,
                template_id: newTemplateId,
                name: preset.name,
                description: preset.description,
                selected_options: newSelectedOptions,
                display_order: preset.displayOrder || 0,
                image_url: preset.imageUrl,
                badge_text: preset.badgeText,
                is_active: preset.isActive ?? true,
            });
        }

        // 8. Return the new template
        const newResult = await getTemplateById(newTemplateId);
        if (newResult.success && newResult.data) {
            return { success: true, data: newResult.data.template };
        }
        return { success: true, data: { id: newTemplateId } as ProductTemplate };
    } catch (error: any) {
        console.error("Error in importTemplateFromJson:", error);
        return { success: false, error: error.message };
    }
}

// ==================== Enhanced Publish Validation ====================

export async function validateTemplateForPublish(
    templateId: string
): Promise<{ valid: boolean; errors: string[] }> {
    try {
        const result = await getTemplateById(templateId);
        if (!result.success || !result.data) {
            return { valid: false, errors: ["Template not found"] };
        }

        const { template, optionGroups } = result.data;
        const errors: string[] = [];

        // Check template has a name
        if (!template.name || template.name.trim().length === 0) {
            errors.push("לתבנית חסר שם");
        }

        // Check base price is valid
        if (template.basePrice < 0) {
            errors.push("מחיר הבסיס לא יכול להיות שלילי");
        }

        // Check at least one option group exists
        if (optionGroups.length === 0) {
            errors.push("חייבת להיות לפחות קבוצת אופציות אחת");
        }

        // Check required groups have options
        for (const group of optionGroups) {
            if (group.isRequired && group.options.length === 0) {
                errors.push(`קבוצת חובה "${group.name}" חייבת לכלול לפחות אופציה אחת`);
            } else if (group.options.length === 0) {
                errors.push(`לקבוצה "${group.name}" אין אופציות`);
            }

            // Check required groups have at least one default
            if (group.isRequired && group.selectionType === "single") {
                const hasDefault = group.options.some(o => o.isDefault);
                if (!hasDefault && group.options.length > 0) {
                    errors.push(`לקבוצה "${group.name}" חסרה אופציית ברירת מחדל`);
                }
            }
        }

        return { valid: errors.length === 0, errors };
    } catch (error: any) {
        return { valid: false, errors: [error.message] };
    }
}
