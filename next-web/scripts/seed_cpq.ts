import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
});

async function main() {
    console.log("Fetching tenant for sales@impactsoft.co.il...");
    const { data: users, error } = await supabase.auth.admin.listUsers();
    if (error) {
        console.error("Auth error:", error);
        return;
    }

    const targetUser = users.users.find(u => u.email === 'sales@impactsoft.co.il');
    if (!targetUser) {
        console.error("User sales@impactsoft.co.il not found!");
        return;
    }

    const { data: tenantMembers, error: tenantErr } = await supabase
        .from('tenant_members')
        .select('tenant_id')
        .eq('user_id', targetUser.id)
        .limit(1);

    if (tenantErr || !tenantMembers || tenantMembers.length === 0) {
        console.error("Could not find tenant for user in tenant_members:", tenantErr);
        return;
    }

    const tenantId = tenantMembers[0].tenant_id;
    console.log("✅ Using Tenant ID:", tenantId);

    // --- 1. MacBook Pro 16" ---
    let res: any = await supabase.from('product_templates').insert({
        tenant_id: tenantId,
        name: 'MacBook Pro 16-inch',
        description: 'M3 Max chip with 14‑core CPU, 30‑core GPU, 36GB Unified Memory, 1TB SSD',
        base_price: 3499.00,
        display_mode: 'single_page',
        image_url: 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mbp16-spaceblack-select-202310?wid=904&hei=840&fmt=jpeg&qlt=90&.v=1697311054290',
        is_active: true
    }).select('id').single();
    if (res.error) throw res.error;
    const macbookId = res.data.id;

    // MBP Groups
    res = await supabase.from('option_groups').insert([
        { tenant_id: tenantId, template_id: macbookId, name: 'Processor', selection_type: 'single', is_required: true, display_order: 1 },
        { tenant_id: tenantId, template_id: macbookId, name: 'Memory', selection_type: 'single', is_required: true, display_order: 2 },
        { tenant_id: tenantId, template_id: macbookId, name: 'Storage', selection_type: 'single', is_required: true, display_order: 3 },
        { tenant_id: tenantId, template_id: macbookId, name: 'Color', selection_type: 'single', is_required: true, display_order: 4 },
        { tenant_id: tenantId, template_id: macbookId, name: 'Software', selection_type: 'multiple', is_required: false, display_order: 5 }
    ]).select('id, name');
    if (res.error) throw res.error;
    const mbpGroups = Object.fromEntries(res.data.map((g: any) => [g.name, g.id]));

    // MBP Options
    res = await supabase.from('options').insert([
        // Processor
        { tenant_id: tenantId, group_id: mbpGroups['Processor'], name: 'M3 Max with 14-core CPU, 30-core GPU', price_modifier_type: 'add', price_modifier_amount: 0, is_default: true, display_order: 1 },
        { tenant_id: tenantId, group_id: mbpGroups['Processor'], name: 'M3 Max with 16-core CPU, 40-core GPU', price_modifier_type: 'add', price_modifier_amount: 300, is_default: false, display_order: 2 },

        // Memory
        { tenant_id: tenantId, group_id: mbpGroups['Memory'], name: '36GB Unified Memory', price_modifier_type: 'add', price_modifier_amount: 0, is_default: true, display_order: 1 },
        { tenant_id: tenantId, group_id: mbpGroups['Memory'], name: '48GB Unified Memory', price_modifier_type: 'add', price_modifier_amount: 200, is_default: false, display_order: 2 },
        { tenant_id: tenantId, group_id: mbpGroups['Memory'], name: '64GB Unified Memory', price_modifier_type: 'add', price_modifier_amount: 400, is_default: false, display_order: 3 },
        { tenant_id: tenantId, group_id: mbpGroups['Memory'], name: '128GB Unified Memory', price_modifier_type: 'add', price_modifier_amount: 1000, is_default: false, display_order: 4 },

        // Storage
        { tenant_id: tenantId, group_id: mbpGroups['Storage'], name: '1TB SSD Storage', price_modifier_type: 'add', price_modifier_amount: 0, is_default: true, display_order: 1 },
        { tenant_id: tenantId, group_id: mbpGroups['Storage'], name: '2TB SSD Storage', price_modifier_type: 'add', price_modifier_amount: 400, is_default: false, display_order: 2 },
        { tenant_id: tenantId, group_id: mbpGroups['Storage'], name: '4TB SSD Storage', price_modifier_type: 'add', price_modifier_amount: 1000, is_default: false, display_order: 3 },
        { tenant_id: tenantId, group_id: mbpGroups['Storage'], name: '8TB SSD Storage', price_modifier_type: 'add', price_modifier_amount: 2200, is_default: false, display_order: 4 },

        // Color
        { tenant_id: tenantId, group_id: mbpGroups['Color'], name: 'Space Black', price_modifier_type: 'add', price_modifier_amount: 0, is_default: true, display_order: 1, image_url: 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mbp16-spaceblack-select-202310_SW_COLOR?wid=64&hei=64&fmt=jpeg&qlt=90&.v=1697311054290' },
        { tenant_id: tenantId, group_id: mbpGroups['Color'], name: 'Silver', price_modifier_type: 'add', price_modifier_amount: 0, is_default: false, display_order: 2, image_url: 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mbp16-silver-select-202310_SW_COLOR?wid=64&hei=64&fmt=jpeg&qlt=90&.v=1697311054290' },

        // Software
        { tenant_id: tenantId, group_id: mbpGroups['Software'], name: 'Final Cut Pro', price_modifier_type: 'add', price_modifier_amount: 299.99, is_default: false, display_order: 1 },
        { tenant_id: tenantId, group_id: mbpGroups['Software'], name: 'Logic Pro', price_modifier_type: 'add', price_modifier_amount: 199.99, is_default: false, display_order: 2 }
    ]).select('*');
    if (res.error) throw res.error;
    const mbpOptions = res.data;

    const optId = (name: string) => mbpOptions.find((o: any) => o.name === name)?.id;

    // MBP Rules
    await supabase.from('configuration_rules').insert([
        {
            tenant_id: tenantId, template_id: macbookId,
            rule_type: 'requires', name: '48GB Requires 16-Core CPU',
            description: '48GB memory is only available with the 16-core CPU M3 Max chip.',
            error_message: 'Please upgrade to the 16-core M3 Max chip to select 48GB memory.',
            if_option_id: optId('48GB Unified Memory'), then_option_id: optId('M3 Max with 16-core CPU, 40-core GPU'),
            priority: 10
        },
        {
            tenant_id: tenantId, template_id: macbookId,
            rule_type: 'requires', name: '64GB Requires 16-Core CPU',
            description: '64GB memory is only available with the 16-core CPU M3 Max chip.',
            error_message: 'Please upgrade to the 16-core M3 Max chip to select 64GB memory.',
            if_option_id: optId('64GB Unified Memory'), then_option_id: optId('M3 Max with 16-core CPU, 40-core GPU'),
            priority: 11
        },
        {
            tenant_id: tenantId, template_id: macbookId,
            rule_type: 'requires', name: '128GB Requires 16-Core CPU',
            description: '128GB memory is only available with the 16-core CPU M3 Max chip.',
            error_message: 'Please upgrade to the 16-core M3 Max chip to select 128GB memory.',
            if_option_id: optId('128GB Unified Memory'), then_option_id: optId('M3 Max with 16-core CPU, 40-core GPU'),
            priority: 12
        },
        {
            tenant_id: tenantId, template_id: macbookId,
            rule_type: 'price_tier', name: 'Bulk Fleet Discount',
            description: '10% off for 10+ machines.',
            quantity_min: 10, discount_type: 'percentage', discount_value: 10,
            priority: 50
        }
    ]);


    // --- 2. Light Aircraft (מטוס קל) ---
    res = await supabase.from('product_templates').insert({
        tenant_id: tenantId,
        name: 'SkyHawk Light Aircraft (מטוס קל)',
        description: 'Single-engine, four-seat, high-wing light aircraft. Perfect for training and personal use.',
        base_price: 430000.00,
        display_mode: 'wizard',
        image_url: 'https://images.unsplash.com/photo-1579737194883-7c85a1dd56fa?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        is_active: true
    }).select('id').single();
    if (res.error) throw res.error;
    const aircraftId = res.data.id;

    res = await supabase.from('option_groups').insert([
        { tenant_id: tenantId, template_id: aircraftId, name: 'Engine Type', selection_type: 'single', is_required: true, display_order: 1 },
        { tenant_id: tenantId, template_id: aircraftId, name: 'Avionics Suite', selection_type: 'single', is_required: true, display_order: 2 },
        { tenant_id: tenantId, template_id: aircraftId, name: 'Interior Trim', selection_type: 'single', is_required: true, display_order: 3 },
        { tenant_id: tenantId, template_id: aircraftId, name: 'Paint Scheme', selection_type: 'single', is_required: true, display_order: 4 },
        { tenant_id: tenantId, template_id: aircraftId, name: 'Optional Upgrades', selection_type: 'multiple', is_required: false, display_order: 5 }
    ]).select('id, name');
    if (res.error) throw res.error;
    const airGroups = Object.fromEntries(res.data.map((g: any) => [g.name, g.id]));

    res = await supabase.from('options').insert([
        // Engine
        { tenant_id: tenantId, group_id: airGroups['Engine Type'], name: 'Lycoming IO-360-L2A (160 HP)', price_modifier_type: 'add', price_modifier_amount: 0, is_default: true, display_order: 1 },
        { tenant_id: tenantId, group_id: airGroups['Engine Type'], name: 'Lycoming IO-390 (210 HP)', price_modifier_type: 'add', price_modifier_amount: 45000, is_default: false, display_order: 2 },

        // Avionics
        { tenant_id: tenantId, group_id: airGroups['Avionics Suite'], name: 'Garmin G1000 NXi Base', price_modifier_type: 'add', price_modifier_amount: 0, is_default: true, display_order: 1 },
        { tenant_id: tenantId, group_id: airGroups['Avionics Suite'], name: 'Garmin G1000 NXi Advanced + Autopilot', price_modifier_type: 'add', price_modifier_amount: 32000, is_default: false, display_order: 2 },

        // Interior
        { tenant_id: tenantId, group_id: airGroups['Interior Trim'], name: 'Standard Fabric', price_modifier_type: 'add', price_modifier_amount: 0, is_default: true, display_order: 1 },
        { tenant_id: tenantId, group_id: airGroups['Interior Trim'], name: 'Premium Leather Luxe', price_modifier_type: 'add', price_modifier_amount: 15000, is_default: false, display_order: 2 },

        // Paint
        { tenant_id: tenantId, group_id: airGroups['Paint Scheme'], name: 'Matterhorn White Base', price_modifier_type: 'add', price_modifier_amount: 0, is_default: true, display_order: 1 },
        { tenant_id: tenantId, group_id: airGroups['Paint Scheme'], name: 'Custom Tri-Color Metallic', price_modifier_type: 'add', price_modifier_amount: 18000, is_default: false, display_order: 2 },

        // Upgrades
        { tenant_id: tenantId, group_id: airGroups['Optional Upgrades'], name: 'Air Conditioning System', price_modifier_type: 'add', price_modifier_amount: 28000, is_default: false, display_order: 1 },
        { tenant_id: tenantId, group_id: airGroups['Optional Upgrades'], name: 'Oversized Tires (Backcountry Kit)', price_modifier_type: 'add', price_modifier_amount: 8500, is_default: false, display_order: 2 },
        { tenant_id: tenantId, group_id: airGroups['Optional Upgrades'], name: 'Extended Range Fuel Tanks', price_modifier_type: 'add', price_modifier_amount: 12000, is_default: false, display_order: 3 }
    ]).select('*');
    if (res.error) throw res.error;
    const airOptions = res.data;
    const airOpt = (name: string) => airOptions.find((o: any) => o.name === name)?.id;

    await supabase.from('configuration_rules').insert([
        {
            tenant_id: tenantId, template_id: aircraftId,
            rule_type: 'conflicts', name: 'AC incompatible with Backcountry Kit',
            description: 'Air conditioning compressor occupies space needed by the heavy-duty strut mounts.',
            error_message: 'Cannot select both AC and Oversized Tires together.',
            if_option_id: airOpt('Air Conditioning System'), then_option_id: airOpt('Oversized Tires (Backcountry Kit)'),
            priority: 10
        },
        {
            tenant_id: tenantId, template_id: aircraftId,
            rule_type: 'conflicts', name: 'Base Engine Cannot Carry Extended Tanks',
            description: 'Weight and balance limits exceeded for 160HP engine with full extended tanks.',
            error_message: 'Extended range tanks require the 210 HP upgraded engine.',
            if_option_id: airOpt('Lycoming IO-360-L2A (160 HP)'), then_option_id: airOpt('Extended Range Fuel Tanks'),
            priority: 20
        }
    ]);


    // --- 3. Simple Item: Enterprise SaaS License ---
    res = await supabase.from('product_templates').insert({
        tenant_id: tenantId,
        name: 'NOW ERP Enterprise License',
        description: 'Monthly subscription model for the NOW ERP platform.',
        base_price: 499.00,
        display_mode: 'single_page',
        image_url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=800',
        is_active: true
    }).select('id').single();
    if (res.error) throw res.error;
    const saasId = res.data.id;

    res = await supabase.from('option_groups').insert([
        { tenant_id: tenantId, template_id: saasId, name: 'Support Tier', selection_type: 'single', is_required: true, display_order: 1 },
        { tenant_id: tenantId, template_id: saasId, name: 'Data Residency', selection_type: 'single', is_required: true, display_order: 2 },
        { tenant_id: tenantId, template_id: saasId, name: 'Add-on Modules', selection_type: 'multiple', is_required: false, display_order: 3 }
    ]).select('id, name');
    if (res.error) throw res.error;
    const saasGroups = Object.fromEntries(res.data.map((g: any) => [g.name, g.id]));

    await supabase.from('options').insert([
        // Support
        { tenant_id: tenantId, group_id: saasGroups['Support Tier'], name: 'Standard (Business Hours)', price_modifier_type: 'add', price_modifier_amount: 0, is_default: true, display_order: 1 },
        { tenant_id: tenantId, group_id: saasGroups['Support Tier'], name: 'Premium (24/7 + SLA)', price_modifier_type: 'multiply', price_modifier_amount: 1.5, is_default: false, display_order: 2 },
        // Residency
        { tenant_id: tenantId, group_id: saasGroups['Data Residency'], name: 'Global Cloud (US/EU Blend)', price_modifier_type: 'add', price_modifier_amount: 0, is_default: true, display_order: 1 },
        { tenant_id: tenantId, group_id: saasGroups['Data Residency'], name: 'IL Dedicated (Israel Only)', price_modifier_type: 'add', price_modifier_amount: 250, is_default: false, display_order: 2 },
        // Addons
        { tenant_id: tenantId, group_id: saasGroups['Add-on Modules'], name: 'Advanced CRM', price_modifier_type: 'add', price_modifier_amount: 100, is_default: false, display_order: 1 },
        { tenant_id: tenantId, group_id: saasGroups['Add-on Modules'], name: 'AI Forecasting Module', price_modifier_type: 'add', price_modifier_amount: 200, is_default: false, display_order: 2 }
    ]);

    // Tiered pricing
    await supabase.from('configuration_rules').insert([
        {
            tenant_id: tenantId, template_id: saasId,
            rule_type: 'price_tier', name: 'Volume License Discount',
            description: '20% discount applied for 50+ seats.',
            quantity_min: 50, discount_type: 'percentage', discount_value: 20,
            priority: 10
        }
    ]);


    console.log("✅ Seed completed successfully.");
}

main().catch(console.error);
