// ============================================================
// RideZone - Admin Account Creation Script
// ============================================================

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");
const envPath = fs.existsSync(path.join(__dirname, "..", "..", ".env"))
  ? path.join(__dirname, "..", "..", ".env")
  : path.join(__dirname, ".env");
require("dotenv").config({ path: envPath });

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "ridezone",
  port: Number(process.env.DB_PORT) || 3306
};

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : true;
      params[key] = value;
    }
  }
  return params;
}

function promptQuestion(rl, query) {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer.trim());
    });
  });
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function createAdmin() {
  console.log("\n==================================================");
  console.log("       RideZone — Create Administrator Account     ");
  console.log("==================================================\n");

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log(`[MySQL] Connected to database '${dbConfig.database}'.\n`);
  } catch (err) {
    console.error(`[MySQL Error] Unable to connect to MySQL database '${dbConfig.database}':`, err.message);
    console.error("Please verify that MySQL is running and your .env credentials are correct.\n");
    process.exit(1);
  }

  try {
    // Ensure admins table exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    const cliArgs = parseArgs();
    let name = cliArgs.name || process.env.ADMIN_NAME;
    let email = cliArgs.email || process.env.ADMIN_EMAIL;
    let password = cliArgs.password || process.env.ADMIN_PASSWORD;

    if (!name || !email || !password) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      if (!name) {
        name = await promptQuestion(rl, "Enter Admin Name: ");
      }
      while (!name) {
        console.log("⚠️  Admin name cannot be empty.");
        name = await promptQuestion(rl, "Enter Admin Name: ");
      }

      if (!email) {
        email = await promptQuestion(rl, "Enter Admin Email: ");
      }
      while (!validateEmail(email)) {
        console.log("⚠️  Please enter a valid email address (e.g., admin@ridezone.com).");
        email = await promptQuestion(rl, "Enter Admin Email: ");
      }

      if (!password) {
        password = await promptQuestion(rl, "Enter Admin Password (min 6 characters): ");
      }
      while (!password || password.length < 6) {
        console.log("⚠️  Password must be at least 6 characters.");
        password = await promptQuestion(rl, "Enter Admin Password (min 6 characters): ");
      }

      rl.close();
    } else {
      if (!validateEmail(email)) {
        console.error("⚠️  Invalid email address provided via CLI argument.");
        process.exit(1);
      }
      if (password.length < 12) {
        console.error("⚠️  Password must be at least 12 characters.");
        process.exit(1);
      }
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already exists in admins table
    const [existingAdmins] = await connection.query(
      "SELECT id, email FROM admins WHERE email = ?",
      [normalizedEmail]
    );

    if (existingAdmins.length > 0) {
      console.log(`\n❌ Error: An admin account with email '${normalizedEmail}' already exists.`);
      process.exit(1);
    }

    // Hash password with bcryptjs (10 salt rounds)
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert new administrator
    const [result] = await connection.query(
      "INSERT INTO admins (name, email, password_hash) VALUES (?, ?, ?)",
      [name.trim(), normalizedEmail, passwordHash]
    );

    console.log("\n--------------------------------------------------");
    console.log("✅ Administrator Account Successfully Created!");
    console.log("--------------------------------------------------");
    console.log(`• Admin ID:   ${result.insertId}`);
    console.log(`• Name:       ${name.trim()}`);
    console.log(`• Email:      ${normalizedEmail}`);
    console.log("• Security:   Password safely hashed with bcrypt (10 rounds)");
    console.log("--------------------------------------------------\n");
  } catch (error) {
    console.error("\n❌ Failed to create administrator account:", error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

createAdmin();
