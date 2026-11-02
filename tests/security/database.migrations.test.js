/**
 * RideZone Security Test Suite: Database Migrations & Fresh-Schema Verification
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runDatabaseMigrationsTests() {
  console.log("==================================================");
  console.log("TEST SUITE 8: DATABASE MIGRATIONS & SCHEMA AUDIT ");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(name, condition, extra = '') {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} ${extra ? '-> ' + extra : ''}`);
      failed++;
    }
  }

  let pool = null;

  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'ridezone'
    });

    // 1. Check schema_migrations table
    console.log("--- 1. Migration Tracker Table Verification ---");
    const [migTableRows] = await pool.query("SHOW TABLES LIKE 'schema_migrations'");
    assert("schema_migrations table exists in MySQL", migTableRows.length > 0);

    const [appliedMigrations] = await pool.query("SELECT version, applied_at FROM schema_migrations ORDER BY version ASC");
    assert("Applied migrations tracked in schema_migrations", appliedMigrations.length > 0);
    appliedMigrations.forEach(m => console.log(`  - Applied: ${m.version} (${m.applied_at})`));

    // 2. Verify all migration files in migrations/ are tracked
    console.log("\n--- 2. File-to-Database Migration Parity ---");
    const migrationsDir = fs.existsSync(path.join(__dirname, "..", "..", "database", "migrations"))
      ? path.join(__dirname, "..", "..", "database", "migrations")
      : (fs.existsSync(path.join(__dirname, "..", "migrations"))
        ? path.join(__dirname, "..", "migrations")
        : path.join(__dirname, "..", "..", "migrations"));
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql"));
      for (const file of files) {
        const isApplied = appliedMigrations.some(m => m.version === file);
        assert(`Migration file ${file} recorded as applied`, isApplied);
      }
    }

    // 3. Verify Required Tables Exist
    console.log("\n--- 3. Core Tables Existence ---");
    const requiredTables = ["users", "admins", "vehicles", "bookings", "password_resets", "schema_migrations"];
    for (const table of requiredTables) {
      const [tRows] = await pool.query(`SHOW TABLES LIKE '${table}'`);
      assert(`Table '${table}' exists`, tRows.length > 0);
    }

    // 4. Verify Critical Security Columns
    console.log("\n--- 4. Security & Concurrency Column Verification ---");
    const requiredColumns = [
      { table: "users", col: "token_version" },
      { table: "users", col: "password_changed_at" },
      { table: "users", col: "profile_photo" },
      { table: "admins", col: "token_version" },
      { table: "admins", col: "password_changed_at" },
      { table: "admins", col: "profile_photo" },
      { table: "bookings", col: "customer_email" },
      { table: "bookings", col: "vehicle_id" },
      { table: "bookings", col: "deposit_amount" },
      { table: "bookings", col: "rental_price" },
      { table: "bookings", col: "refund_amount" },
      { table: "bookings", col: "cancelled_at" },
      { table: "bookings", col: "cancellation_reason" },
      { table: "bookings", col: "cancellation_details" },
      { table: "bookings", col: "actual_return" }
    ];

    for (const item of requiredColumns) {
      const [colRows] = await pool.query(`SHOW COLUMNS FROM ${item.table} LIKE '${item.col}'`);
      assert(`Column '${item.table}.${item.col}' exists in MySQL`, colRows.length > 0);
    }

    console.log("\n==================================================");
    console.log(`DATABASE & MIGRATIONS RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================");

  } catch (err) {
    console.error("Database migrations test unhandled error:", err);
  } finally {
    if (pool) await pool.end();
  }
}

runDatabaseMigrationsTests();
