const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'master_v2_reset.sql');

if (fs.existsSync(filePath)) {
    let sql = fs.readFileSync(filePath, 'utf8');

    // Safety pass: Preemptively drop policies before creating them to avoid existing policy conflicts
    sql = sql.replace(/CREATE POLICY\s+([a-zA-Z0-9_]+)\s+ON\s+([a-zA-Z0-9_]+)/g, "DROP POLICY IF EXISTS $1 ON $2;\nCREATE POLICY $1 ON $2");

    fs.writeFileSync(filePath, sql);
    console.log("✅ Rewrote all CREATE POLICY statements to include DROP POLICY IF EXISTS safeties.");
} else {
    console.error("❌ master_v2_reset.sql not found!");
}
