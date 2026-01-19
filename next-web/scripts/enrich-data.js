require('dotenv').config({ path: ['.env.local', '.env'] });
const { createClient } = require('@supabase/supabase-js');
// Faker removed, using internal generators
// Since I can't easily install new packages, I'll use hardcoded arrays/generators.

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TENANT_ID = '00000000-0000-0000-0000-000000000003';
const BATCH_SIZE = 50;

// Data Pools
const NAMES = {
    Hebrew: ['אברהם כהן', 'שרה לוי', 'דוד המלך', 'רחל אמנו', 'משה רבנו', 'יוסי מזרחי', 'דניאל ביטון', 'נועה קירל', 'גל גדות', 'בר רפאלי', 'אייל שני', 'רותי ברודו', 'חיים כהן', 'מירי בוהדנה', 'יהודה לוי'],
    English: ['John Smith', 'Jane Doe', 'Michael Jordan', 'Elon Musk', 'Bill Gates', 'Taylor Swift', 'Gordon Ramsay', 'Harry Potter', 'Sherlock Holmes', 'James Bond'],
    French: ['Pierre Dupont', 'Marie Curie', 'Napoleon Bonaparte', 'Coco Chanel', 'Zinedine Zidane', 'Celine Dion', 'Victor Hugo', 'Claude Monet'],
    German: ['Hans Muller', 'Angela Merkel', 'Albert Einstein', 'Ludwig van Beethoven', 'Heidi Klum', 'Michael Schumacher', 'Karl Lagerfeld'],
    Spanish: ['Pablo Picasso', 'Lionel Messi', 'Penelope Cruz', 'Salvador Dali', 'Frida Kahlo', 'Rafael Nadal', 'Antonio Banderas'],
    Dutch: ['Vincent van Gogh', 'Johan Cruyff', 'Anne Frank', 'Rembrandt', 'Max Verstappen', 'Tiesto', 'Armin van Buuren']
};

const ROLES = ['CEO', 'CTO', 'VP Sales', 'Developer', 'Designer', 'Product Manager', 'HR Manager', 'Accountant', 'Sales Rep', 'Customer Success'];
const STATUSES = ['lead', 'customer', 'churned'];
const PHONE_PREFIXES = ['050', '052', '054', '055', '058'];

function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generatePhone() {
    return `${getRandomItem(PHONE_PREFIXES)}-${Math.floor(1000000 + Math.random() * 9000000)}`;
}

function generateEmail(name) {
    const slug = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 10);
    return `${slug}${Math.floor(Math.random() * 100)}@example.com`;
}

async function enrichData() {
    console.log(`Starting enrichment for Tenant: ${TENANT_ID}`);

    // 1. Fetch total count to know how much work we have (optional, just fetch all IDs)
    // Actually, let's just paginate through all people in this tenant.

    let hasMore = true;
    let page = 0;
    const limit = 100;

    while (hasMore) {
        const { data: people, error } = await supabase
            .from('parties')
            .select('id')
            .eq('tenant_id', TENANT_ID)
            .eq('type', 'person')
            .range(page * limit, (page + 1) * limit - 1);

        if (error) {
            console.error("Error fetching people:", error);
            break;
        }

        if (!people || people.length === 0) {
            hasMore = false;
            break;
        }

        console.log(`Processing batch ${page + 1} (${people.length} records)...`);

        const updates = people.map(p => {
            const lang = getRandomItem(Object.keys(NAMES));
            const name = getRandomItem(NAMES[lang]);
            const status = Math.random() > 0.8 ? 'churned' : (Math.random() > 0.5 ? 'customer' : 'lead');
            const createdAt = getRandomDate(new Date(2023, 0, 1), new Date());
            const futureDate = getRandomDate(new Date(), new Date(2027, 0, 1));

            // Custom Fields for Future Date & Language
            const customFields = {
                future_return_date: futureDate.toISOString().split('T')[0],
                language_preference: lang
            };

            const contactMethods = [
                { type: 'email', value: generateEmail(name), is_primary: true },
                { type: 'phone', value: generatePhone(), is_primary: true }
            ];

            return {
                id: p.id,
                tenant_id: TENANT_ID,
                type: 'person',
                display_name: name,
                status: status,
                created_at: createdAt.toISOString(),
                contact_methods: contactMethods,
                custom_fields: customFields
            };
        });

        // Bulk Update Parties
        const { error: updateError } = await supabase
            .from('parties')
            .upsert(updates); // Upsert calculates by ID

        if (updateError) {
            console.error("Error updating parties:", updateError);
        }

        // Update Roles (Party Memberships)
        // We need to fetch memberships for these people first or just upsert blind if we knew the IDs?
        // Easier to just update related memberships.
        // For simplicity/speed, let's pick 50% to update roles.

        for (const p of people) {
            const role = getRandomItem(ROLES);
            // Verify if membership exists or just insert? 
            // We'll try to update any existing membership for this person in this tenant.
            // Finding organization... assumes they belong to one.

            // Simplification: Just update `role_name` where `person_id` matches.
            // Note: RLS might require checking tenant_id on join, but we have service key.
            await supabase
                .from('party_memberships')
                .update({ role_name: role })
                .eq('person_id', p.id);
        }


        page++;
        if (page >= 40) { // Limit to 2000 records for now
            console.log("Reached limit of 2000 records. Stopping.");
            break;
        }

        console.log("Enrichment Complete!");
    }

    console.log("Enrichment Complete!");
}

enrichData();
