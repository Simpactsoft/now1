
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const TARGET_EMAIL = 'yb@impactsoft.co.il';
const NEW_PASSWORD = '123456';

async function resetPassword() {
    console.log(`Resetting password for ${TARGET_EMAIL}...`);

    // First get the user ID
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
        console.error('Error listing users:', listError);
        return;
    }

    const user = users.find(u => u.email === TARGET_EMAIL);
    if (!user) {
        console.error(`User ${TARGET_EMAIL} not found found.`);
        return;
    }

    // Update password
    const { data, error } = await supabase.auth.admin.updateUserById(
        user.id,
        { password: NEW_PASSWORD }
    );

    if (error) {
        console.error('Error resetting password:', error);
    } else {
        console.log('Password reset successfully!');
        console.log(`Email: ${TARGET_EMAIL}`);
        console.log(`New Password: ${NEW_PASSWORD}`);
    }
}

resetPassword();
