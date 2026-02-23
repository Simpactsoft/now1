const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkQuotes() {
    const tenantId = '00000000-0000-0000-0000-000000000003';
    const customerId = '1295b662-fa20-40fd-abbb-3cd913f66af1';

    console.log(`Checking quotes for tenant ${tenantId}, customer ${customerId}`);

    const { data, error } = await supabase
        .from('quotes')
        .select('id, quote_number, customer_id, tenant_id')
        .eq('customer_id', customerId);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log(`Found ${data.length} quotes:`);
        console.log(data);
    }
}

checkQuotes();
