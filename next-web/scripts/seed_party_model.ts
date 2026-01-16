import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

console.log('URL:', SUPABASE_URL);
console.log('Key Length:', SUPABASE_ANON_KEY?.length);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const HEBREW_FIRST_NAMES = ["איתי", "נועה", "דוד", "מאיה", "יוסי", "רוני", "אריאל", "עדי", "עומר", "שירה", "דניאל", "יעל", "מתן", "תמר", "גל", "אור", "מיכל", "יונתן", "רועי", "טל"];
const HEBREW_LAST_NAMES = ["כהן", "לוי", "מזרחי", "פרץ", "ביטון", "דהן", "אברהם", "פרידמן", "מלכה", "אזולאי", "חזן", "קדוש", "גבאי", "סעדה", "אוחנה", "חיון", "ואקנין", "סויסה", "מלול", "מור"];
const ENGLISH_FIRST_NAMES = ["James", "Emma", "Liam", "Olivia", "Noah", "Ava", "Lucas", "Isabella", "Ethan", "Sophia", "Mason", "Mia", "Logan", "Charlotte", "Caleb", "Amelia", "Jack", "Harper", "Owen", "Evelyn"];
const ENGLISH_LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"];

const TENANT_ID = "00000000-0000-0000-0000-000000000003"; // Galactic Stress Test
const ORG_ID = "00000000-0000-0000-0000-000000000000"; // Legacy/Default Org

async function seedRealisticParties(count: number) {
    console.log(`🚀 Starting realistic seeding of ${count} parties...`);

    // Ensure Org exists (Part 1 migration might have created it, but let's be safe)
    try {
        await supabase.from('parties').insert({
            id: ORG_ID,
            tenant_id: TENANT_ID,
            type: 'organization',
            display_name: 'Galactic Enterprise HQ'
        });
    } catch (e) {
        // Ignore if exists
    }

    const batchSize = 2500; // Increased for 'Small' instance
    for (let i = 0; i < count; i += batchSize) {
        const parties = [];
        const people = [];
        const memberships = [];

        for (let j = 0; j < batchSize; j++) {
            const isHebrew = Math.random() > 0.5;
            const firstName = isHebrew ? HEBREW_FIRST_NAMES[Math.floor(Math.random() * HEBREW_FIRST_NAMES.length)] : ENGLISH_FIRST_NAMES[Math.floor(Math.random() * ENGLISH_FIRST_NAMES.length)];
            const lastName = isHebrew ? HEBREW_LAST_NAMES[Math.floor(Math.random() * HEBREW_LAST_NAMES.length)] : ENGLISH_LAST_NAMES[Math.floor(Math.random() * ENGLISH_LAST_NAMES.length)];
            const fullName = `${firstName} ${lastName}`;
            const id = crypto.randomUUID();

            parties.push({
                id,
                tenant_id: TENANT_ID,
                type: 'person',
                display_name: fullName,
                created_at: new Date(Date.now() - Math.random() * 10000000000).toISOString()
            });

            people.push({
                party_id: id,
                first_name: firstName,
                last_name: lastName
            });

            memberships.push({
                tenant_id: TENANT_ID,
                person_id: id,
                organization_id: ORG_ID,
                role_name: 'Employee',
                salary: Math.floor(Math.random() * 150000) + 30000,
                org_path: `1.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 100)}`
            });
        }

        // Batch Inserts
        const { error: pError } = await supabase.from('parties').insert(parties);
        if (pError) console.error('Parties Error:', pError.message);

        const { error: ppError } = await supabase.from('people').insert(people);
        if (ppError) console.error('People Error:', ppError.message);

        const { error: mError } = await supabase.from('party_memberships').insert(memberships);
        if (mError) console.error('Memberships Error:', mError.message);

        console.log(`✅ Processed ${i + batchSize} records...`);
    }

    console.log('🎉 Realistic Seeding Complete!');
}

seedRealisticParties(100000).catch(console.error);
