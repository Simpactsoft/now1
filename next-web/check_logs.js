const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLogs() {
    // Get the latest job ID
    const { data: jobs } = await supabase
        .from('import_jobs')
        .select('id, tenant_id, error_count')
        .order('created_at', { ascending: false })
        .limit(1);

    if (!jobs || jobs.length === 0) {
        console.log("No jobs found");
        return;
    }

    const latestJob = jobs[0];
    console.log("Latest Job:", latestJob);

    // Check logs for this job
    const { data: logs, error } = await supabase
        .from('import_logs')
        .select('id, job_id, tenant_id, status, error_type')
        .eq('job_id', latestJob.id);

    if (error) {
        console.error('Error fetching logs:', error);
    } else {
        console.log(`Found ${logs.length} logs for this job. First few:`);
        console.table(logs.slice(0, 5));
    }
}

checkLogs();
