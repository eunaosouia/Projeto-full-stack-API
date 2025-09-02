import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'data.sqlite');
const db = new Database(dbPath);

// Create tables from schema.sql
function migrate() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);
}

migrate();

export default db;

// Optional: reset by script
if (process.argv.includes('--reset')) {
    db.exec('DROP TABLE IF EXISTS produtos; DROP TABLE IF EXISTS users');
    migrate();
    console.log('Database created using schema.sql');
}
