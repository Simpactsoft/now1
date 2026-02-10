
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

const TARGET_TENANT_ID = '00000000-0000-0000-0000-000000000003';

async function diagnose() {
    console.log(`Diagnosing for Tenant: ${TARGET_TENANT_ID}`);

    // 1. Check Data (using Service Role - bypass RLS)
    const { data: products, error: prodError } = await supabase
        .from('products')
        .select('id, name, tenant_id')
        .eq('tenant_id', TARGET_TENANT_ID);

    if (prodError) console.error('DB Error:', prodError);
    console.log(`Products in DB (bypass RLS): ${products?.length}`);
    if (products?.length) console.log(products);

    // 2. Check Data (using Anon/Auth context simulation if possible, but JS client is static here)
    // We can't easily simulate the browser client's exact state here without a user token.
    // But we can check policies definition via SQL if we had access, or just infer from behavior.

    // Let's try to list policies via a system query if allowed, or just assume.
    // "SELECT * FROM pg_policies WHERE tablename = 'products'"

    // 3. Check Tenant Members
    console.log('\n--- Checking Tenant Members ---');
    const { data: members, error: memberError } = await supabase
        .from('tenant_members')
        .select('*')
        .eq('tenant_id', TARGET_TENANT_ID);

    if (memberError) console.log('Error fetching members:', memberError.message);
    else console.log('Members:', members);

    // Check unrelated table name if tenant_members doesn't exist (e.g. tenant_users)
    const { data: users, error: userError } = await supabase
        .from('tenant_users')
        .select('*')
        .eq('tenant_id', TARGET_TENANT_ID);

    if (!memberError && !userError) console.log('Tenant Users:', users);
    else if (userError) console.log('Error fetching tenant_users:', userError.message);

    // 4. Find User ID
    console.log('\n--- Resolving User ID for sales@impactsoft.co.il ---');
    // Try 'profiles' or 'users' (public)
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name') // adjusting fields blindly based on typical setups
        .eq('email', 'sales@impactsoft.co.il')
        .maybeSingle();

    if (profile) {
        console.log('User Found:', profile);
        // Check if this user is in the members list
        const isMember = members?.some(m => m.user_id === profile.id);
        console.log(`Is Member of Galactic Stress Test? ${isMember}`);
    } else {
        console.log('Profile not found in "profiles" table. Error:', profileError?.message);
    }
}

diagnose();
