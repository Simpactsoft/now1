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

async function run() {
  const cardId = '1295b662-fa20-40fd-abbb-3cd913f66af1';
  console.log("Checking activity stream for card...");
  const { data: stream, error: sErr } = await supabase.from('activity_stream').select('*').eq('entity_id', cardId);
  console.log("Activity Stream:", stream, "Err:", sErr);
}
run();
