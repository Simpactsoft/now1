const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'master_v2_reset.sql');

if (fs.existsSync(filePath)) {
    let sql = fs.readFileSync(filePath, 'utf8');

    // Safety pass: update all indexes to use IF NOT EXISTS
    sql = sql.replace(/CREATE INDEX (?!IF NOT EXISTS)/g, 'CREATE INDEX IF NOT EXISTS ');
    sql = sql.replace(/CREATE UNIQUE INDEX (?!IF NOT EXISTS)/g, 'CREATE UNIQUE INDEX IF NOT EXISTS ');

    fs.writeFileSync(filePath, sql);
    console.log("✅ Rewrote all CREATE INDEX statements to include IF NOT EXISTS");
} else {
    console.error("❌ master_v2_reset.sql not found!");
}
