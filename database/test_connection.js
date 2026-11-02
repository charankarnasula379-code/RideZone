const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

async function testConnection() {
  const config = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,
    ...(process.env.DB_SSL === "true" ? { ssl: { rejectUnauthorized: true } } : {})
  };

  if (!config.host || !config.user || !config.database) {
    throw new Error("Set DB_HOST, DB_USER, and DB_NAME in your private .env file first.");
  }

  let connection;
  try {
    connection = await mysql.createConnection(config);
    await connection.query("SELECT 1");
    const [tables] = await connection.query("SHOW TABLES");
    const tableNames = tables.map((row) => Object.values(row)[0]);

    console.log("[MySQL] Connection successful.");
    console.log(`Host: ${config.host}:${config.port}`);
    console.log(`Database: ${config.database}`);
    console.log(`Tables found: ${tableNames.length}`);
    if (tableNames.length) console.log(tableNames.join(", "));
  } finally {
    if (connection) await connection.end();
  }
}

testConnection().catch((error) => {
  console.error("[MySQL] Connection test failed:", error.message);
  process.exitCode = 1;
});
