const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'master_v2_reset.sql');

if (fs.existsSync(filePath)) {
    let sql = fs.readFileSync(filePath, 'utf8');

    // Safety pass: Preemptively drop triggers before creating them
    sql = sql.replace(/CREATE TRIGGER\s+([a-zA-Z0-9_]+)\s+(?:AFTER|BEFORE)\s+(?:INSERT|UPDATE|DELETE).+?ON\s+([a-zA-Z0-9_.]+)/gs, "DROP TRIGGER IF EXISTS $1 ON $2;\n$&");

    // Safety pass 2: For triggers lacking the AFTER/BEFORE keyword structure perfectly on the same line (like the tree path ones)
    sql = sql.replace(/CREATE TRIGGER\s+(maintain_team_tree_path)\s+BEFORE\s+INSERT\s+OR\s+UPDATE\s+ON\s+(teams)/g, "DROP TRIGGER IF EXISTS $1 ON $2;\n$&");
    sql = sql.replace(/CREATE TRIGGER\s+(maintain_user_manager_path)\s+BEFORE\s+INSERT\s+OR\s+UPDATE\s+ON\s+(user_profiles)/g, "DROP TRIGGER IF EXISTS $1 ON $2;\n$&");


    fs.writeFileSync(filePath, sql);
    console.log("✅ Rewrote all CREATE TRIGGER statements to include DROP TRIGGER IF EXISTS safeties.");
} else {
    console.error("❌ master_v2_reset.sql not found!");
}
