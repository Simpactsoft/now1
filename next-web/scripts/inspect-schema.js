require('dotenv').config({ path: ['.env.local', '.env'] });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectSchema() {
    console.log("Fetching PERSON_STATUS option set...");
    const { data: sets } = await supabase
        .from('option_sets')
        .select('id')
        .eq('code', 'PERSON_STATUS')
        .limit(1);

    if (sets && sets.length > 0) {
        const setId = sets[0].id;
        console.log("Fetching values for set:", setId);
        const { data: values } = await supabase
            .from('option_values')
            .select('*')
            .eq('option_set_id', setId);

        console.log(JSON.stringify(values, null, 2));
    } else {
        console.log("No PERSON_STATUS set found.");
    }

}


inspectSchema();
