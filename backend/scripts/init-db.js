const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: false
});

async function initializeDatabase() {
  const client = await pool.connect();

  try {
    console.log("Checking database schema...");

    const result = await client.query(`
      SELECT COUNT(*) 
      FROM information_schema.tables 
      WHERE table_schema='public'
    `);

    if (parseInt(result.rows[0].count) > 0) {
      console.log("Schema already exists, skipping schema.sql");
      return;
    }

    console.log("Running schema.sql...");

    const schemaPath = path.join(__dirname, "../../database/schema.sql");
    const schemaSQL = fs.readFileSync(schemaPath, "utf8");

    await client.query(schemaSQL);

    console.log("Schema.sql executed successfully");

  } finally {
    client.release();
  }
}

module.exports = initializeDatabase;
