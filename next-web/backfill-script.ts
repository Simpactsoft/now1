import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function backfill() {
    console.log("Starting backfill for Quotes...");

    const { data: quotes, error: qErr } = await supabase.from('quotes').select('*').not('customer_id', 'is', null);
    if (qErr) { console.error("Error fetching quotes:", qErr); }

    let qCount = 0;
    for (const q of quotes || []) {
        const { error } = await supabase.from('activity_stream').insert({
            organization_id: q.tenant_id,
            entity_id: q.customer_id,
            entity_type: 'card',
            event_type: 'quote_created',
            occurred_at: q.created_at || new Date().toISOString(),
            actor_id: q.created_by,
            payload: {
                quote_number: q.quote_number,
                amount: q.grand_total,
                status: q.status,
                currency: q.currency
            },
            source_id: q.id,
            source_table: 'quotes'
        });
        if (!error) qCount++;
    }
    console.log(`Backfilled ${qCount} quotes.`);

    console.log("Starting backfill for Activities...");
    const { data: acts, error: aErr } = await supabase.from('activities').select('*, activity_links(*)');
    if (aErr) { console.error("Error fetching activities:", aErr); }

    let aCount = 0;
    for (const a of acts || []) {
        // Find the entity it belongs to
        let entityId = null;
        let entityType = null;
        if (a.activity_links && a.activity_links.length > 0) {
            const ln = a.activity_links[0];
            if (ln.card_id) { entityId = ln.card_id; entityType = 'card'; }
            else if (ln.opportunity_id) { entityId = ln.opportunity_id; entityType = 'opportunity'; }
            else if (ln.lead_id) { entityId = ln.lead_id; entityType = 'lead'; }
        }

        if (!entityId) continue;

        const { error } = await supabase.from('activity_stream').insert({
            organization_id: a.tenant_id,
            entity_id: entityId,
            entity_type: entityType,
            event_type: 'activity_created',
            occurred_at: a.created_at || new Date().toISOString(),
            actor_id: a.created_by,
            payload: {
                title: a.subject,
                type: a.activity_type,
                priority: a.priority
            },
            source_id: a.id,
            source_table: 'activities'
        });
        if (!error) aCount++;
    }
    console.log(`Backfilled ${aCount} activities.`);
}
backfill();
