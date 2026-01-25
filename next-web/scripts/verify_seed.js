
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load Env
const envPath = path.resolve(__dirname, '../.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envConfig.SUPABASE_SERVICE_ROLE_KEY; // Use service role to bypass RLS

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Env Vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Checking PERSON_STATUS set...");

    // 1. Check Set
    let { data: sets, error: setError } = await supabase
        .from('option_sets')
        .select('*')
        .eq('code', 'PERSON_STATUS');

    if (setError) {
        console.error("Error fetching set:", setError);
        return;
    }

    if (!sets || sets.length === 0) {
        console.log("Set 'PERSON_STATUS' NOT found. Creating...");
        const { data: newSet, error: createError } = await supabase
            .from('option_sets')
            .insert({ code: 'PERSON_STATUS', description: 'Lifecycle status', is_locked: true })
            .select()
            .single();

        if (createError) {
            console.error("Failed to create set:", createError);
            return;
        }
        sets = [newSet];
        console.log("Created Set:", newSet.id);
    } else {
        console.log("Set found:", sets[0].id);
    }

    const setId = sets[0].id;

    // 2. Check Values
    const { data: values, error: valError } = await supabase
        .from('option_values')
        .select('*')
        .eq('option_set_id', setId);

    if (valError) {
        console.error("Error fetching values:", valError);
        return;
    }

    console.log(`Found ${values.length} existing values.`);

    if (values.length === 0) {
        console.log("Seeding values...");
        const seedValues = [
            { option_set_id: setId, internal_code: 'NEW', label_i18n: { en: "New", he: "חדש" }, sort_order: 10, color: '#3b82f6' },
            { option_set_id: setId, internal_code: 'CONTACTED', label_i18n: { en: "Contacted", he: "נוצר קשר" }, sort_order: 20, color: '#eab308' },
            { option_set_id: setId, internal_code: 'QUALIFIED', label_i18n: { en: "Qualified", he: "מוסמך" }, sort_order: 30, color: '#22c55e' },
            { option_set_id: setId, internal_code: 'LOST', label_i18n: { en: "Lost", he: "אבוד" }, sort_order: 90, color: '#ef4444' }
        ];

        const { error: insertError } = await supabase.from('option_values').insert(seedValues);
        if (insertError) console.error("Insert failed:", insertError);
        else console.log("Seeding complete!");
    } else {
        console.log("Values already exist:", values.map(v => v.internal_code));
    }
}

run();
