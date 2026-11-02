// ============================================================
// RideZone - Production Hardened Server & Transactional APIs
// ============================================================

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config({ path: path.join(__dirname, ".env") });

// ------------------------------------------------------------
// 1. FAIL-FAST ENVIRONMENT VALIDATION
// ------------------------------------------------------------
const requiredEnvVars = ["DB_HOST", "DB_USER", "DB_NAME", "JWT_SECRET"];
const missingEnvs = requiredEnvVars.filter((key) => !process.env[key]);

if (missingEnvs.length > 0) {
  console.error("==================================================");
  console.error("[CRITICAL FATAL ERROR]: Missing mandatory environment variables:");
  missingEnvs.forEach((env) => console.error(`  - ${env}`));
  console.error("Application refuses to start with insecure or missing configurations.");
  console.error("==================================================");
  process.exit(1);
}

const PORT = parseInt(process.env.PORT || "3001", 10);
const JWT_SECRET = process.env.JWT_SECRET;
const DB_HOST = process.env.DB_HOST;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME;
const DB_PORT = parseInt(process.env.DB_PORT || "3306", 10);
const DB_SSL = process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined;
const DB_CONNECTION_LIMIT = Math.max(1, parseInt(process.env.DB_CONNECTION_LIMIT || "10", 10));
const ADMIN_NAME = (process.env.ADMIN_NAME || "").trim();
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

const app = express();

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ------------------------------------------------------------
// 2. PRODUCTION SECURITY HEADERS & RATE LIMITING MIDDLEWARES
// ------------------------------------------------------------
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https: http:; img-src 'self' data: blob: https: http: /uploads/;"
  );
  next();
});

// In-Memory Rate Limiter Utility
class RateLimiter {
  constructor(windowMs, maxHits, message) {
    this.windowMs = windowMs;
    this.maxHits = maxHits;
    this.message = message || "Too many requests. Please try again later.";
    this.hits = new Map();
    // Cleanup expired records every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.hits.entries()) {
        if (now - record.resetTime > this.windowMs) {
          this.hits.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }

  middleware() {
    return (req, res, next) => {
      const clientIp = req.ip || req.connection.remoteAddress || "global";
      const now = Date.now();
      let record = this.hits.get(clientIp);

      if (!record || now > record.resetTime) {
        record = { count: 1, resetTime: now + this.windowMs };
        this.hits.set(clientIp, record);
      } else {
        record.count++;
      }

      res.setHeader("X-RateLimit-Limit", this.maxHits);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, this.maxHits - record.count));
      res.setHeader("X-RateLimit-Reset", Math.ceil(record.resetTime / 1000));

      if (record.count > this.maxHits) {
        return res.status(429).json({ error: this.message });
      }
      next();
    };
  }
}

const authRateLimiter = new RateLimiter(15 * 60 * 1000, 100, "Too many authentication attempts. Please wait 15 minutes.");
const uploadRateLimiter = new RateLimiter(60 * 60 * 1000, 100, "Upload quota exceeded. Maximum 100 uploads per hour.");
const generalApiLimiter = new RateLimiter(15 * 60 * 1000, 1000, "API rate limit exceeded. Please throttle requests.");

const publicDir = path.join(__dirname, "public");

// Static & Multi-Page View Handlers
app.get(["/admin", "/admin/", "/admin/index.html", "/admin.html"], (req, res) => {
  res.sendFile(path.join(publicDir, "admin", "admin.html"));
});
app.get(["/admin.js", "/admin/admin.js"], (req, res) => {
  res.sendFile(path.join(publicDir, "admin", "admin.js"));
});
app.get(["/admin.css", "/admin/admin.css"], (req, res) => {
  res.sendFile(path.join(publicDir, "admin", "admin.css"));
});
app.get(["/terms", "/terms.html"], (req, res) => {
  res.sendFile(path.join(publicDir, "terms.html"));
});
app.get(["/vehicles", "/vehicles.html"], (req, res) => {
  res.sendFile(path.join(publicDir, "vehicles.html"));
});
app.get(["/vehicle-details", "/vehicle-details.html", "/vehicles/:slug"], (req, res) => {
  res.sendFile(path.join(publicDir, "vehicle-details.html"));
});
app.get(["/how-it-works", "/how-it-works.html"], (req, res) => {
  res.sendFile(path.join(publicDir, "how-it-works.html"));
});
app.get(["/about", "/about.html"], (req, res) => {
  res.sendFile(path.join(publicDir, "about.html"));
});
app.get(["/contact", "/contact.html"], (req, res) => {
  res.sendFile(path.join(publicDir, "contact.html"));
});
app.get(["/", "/index.html"], (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// Backward-compatible direct asset aliases
app.get("/style.css", (req, res) => {
  res.sendFile(path.join(publicDir, "css", "style.css"));
});
app.get("/script.js", (req, res) => {
  res.sendFile(path.join(publicDir, "js", "script.js"));
});
app.get("/360-viewer.js", (req, res) => {
  res.sendFile(path.join(publicDir, "js", "360-viewer.js"));
});

// Middleware for payload processing
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));
app.use("/uploads", express.static(uploadsDir, { maxAge: "7d" }));
app.use("/css", express.static(path.join(publicDir, "css")));
app.use("/js", express.static(path.join(publicDir, "js")));
app.use("/assets", express.static(path.join(publicDir, "assets")));
app.use("/admin", express.static(path.join(publicDir, "admin")));
app.use(express.static(publicDir));

// Apply general API rate limiter to all API endpoints
app.use("/api/", generalApiLimiter.middleware());

// ------------------------------------------------------------
// 3. DATABASE INITIALIZATION & VERSIONED MIGRATION ENGINE
// ------------------------------------------------------------
let pool = null;
let isDbConnected = false;

// Lightweight readiness check for hosting platforms and uptime monitors.
app.get("/api/health", async (req, res) => {
  try {
    if (!pool || !isDbConnected) {
      return res.status(503).json({ status: "unavailable", database: "disconnected" });
    }
    await pool.query("SELECT 1");
    return res.status(200).json({ status: "ok", database: "connected" });
  } catch (error) {
    return res.status(503).json({ status: "unavailable", database: "disconnected" });
  }
});

const DEFAULT_FLEET_DATA = [
  {
    id: 1,
    name: "Ather 450X",
    brand: "Ather",
    model: "450X Gen 3",
    category: "Electric",
    year: 2024,
    fuel_type: "Electric",
    transmission: "Automatic (Belt Drive)",
    price: 220,
    deposit_amount: 1500,
    rating: 4.8,
    image: "/assets/ather.png",
    vehicle_reg_no: "TS 09 RZ 1001",
    status: "Active",
    description: "India's premier high-performance smart electric scooter featuring instant Warp mode acceleration, 7-inch touchscreen dashboard, and an intelligent IP67-rated battery system.",
    features_json: JSON.stringify(["Warp Mode", "7-inch Touchscreen", "Google Maps Navigation", "AutoHold Hill Assist", "Reverse Assist", "IP67 Battery"]),
    specs_json: JSON.stringify({
      motor_engine: "Permanent Magnet Synchronous (PMSM)",
      power: "6.4 kW (8.58 bhp)",
      torque: "26 Nm (Instant)",
      top_speed: "90 km/h",
      range_efficiency: "111 km TrueRange",
      battery_capacity: "3.7 kWh Lithium-ion",
      kerb_weight: "111.6 kg",
      seat_height: "765 mm",
      brakes: "Front & Rear Disc + CBS"
    }),
    gallery_json: JSON.stringify(["/assets/ather.png", "/assets/ather-2.png", "/assets/ather-3.png"])
  },
  {
    id: 2,
    name: "Honda Activa 6G",
    brand: "Honda",
    model: "Activa 6G Deluxe",
    category: "Scooter",
    year: 2024,
    fuel_type: "Petrol",
    transmission: "Automatic (V-Matic CVT)",
    price: 180,
    deposit_amount: 1000,
    rating: 4.7,
    image: "/assets/honda.png",
    vehicle_reg_no: "TS 09 RZ 1002",
    status: "Active",
    description: "India's most trusted commuter scooter with refined 110cc PGM-FI engine, enhanced smart power (eSP), telescopic suspension, and hassle-free external fuel filling.",
    features_json: JSON.stringify(["eSP Technology", "Telescopic Front Suspension", "External Fuel Fill", "Silent Start with ACG", "Engine Start/Stop Switch", "LED Headlamp"]),
    specs_json: JSON.stringify({
      motor_engine: "109.51 cc 4-Stroke SI Engine",
      power: "7.79 bhp @ 8,000 rpm",
      torque: "8.84 Nm @ 5,500 rpm",
      top_speed: "85 km/h",
      range_efficiency: "50 km/l Fuel Mileage",
      fuel_capacity: "5.3 Litres",
      kerb_weight: "106 kg",
      seat_height: "765 mm",
      brakes: "Front & Rear 130mm Drum with CBS"
    }),
    gallery_json: JSON.stringify(["/assets/honda.png", "/assets/honda-2.png", "/assets/honda-3.png"])
  },
  {
    id: 3,
    name: "Yamaha MT-15 V2",
    brand: "Yamaha",
    model: "MT-15 Version 2.0",
    category: "Superbike",
    year: 2024,
    fuel_type: "Petrol",
    transmission: "6-Speed Constant Mesh",
    price: 350,
    deposit_amount: 2000,
    rating: 4.9,
    image: "/assets/yamaha.png",
    vehicle_reg_no: "TS 09 RZ 1003",
    status: "Active",
    description: "Aggressive hyper-naked streetfighter powered by a liquid-cooled 155cc engine with Variable Valve Actuation (VVA), inverted USD forks, and dual-channel ABS.",
    features_json: JSON.stringify(["Variable Valve Actuation (VVA)", "Inverted USD Front Forks", "Assist & Slipper Clutch", "Dual Channel ABS", "Traction Control System", "Y-Connect Bluetooth"]),
    specs_json: JSON.stringify({
      motor_engine: "155 cc Liquid-cooled 4-valve SOHC",
      power: "18.4 bhp @ 10,000 rpm",
      torque: "14.1 Nm @ 7,500 rpm",
      top_speed: "130 km/h",
      range_efficiency: "45 km/l Fuel Mileage",
      fuel_capacity: "10 Litres",
      kerb_weight: "141 kg",
      seat_height: "810 mm",
      brakes: "Front 282mm Disc, Rear 220mm Disc (Dual ABS)"
    }),
    gallery_json: JSON.stringify(["/assets/yamaha.png", "/assets/yamaha-2.png", "/assets/yamaha-3.png"])
  },
  {
    id: 4,
    name: "KTM RC 390",
    brand: "KTM",
    model: "RC 390 GP Edition",
    category: "Superbike",
    year: 2024,
    fuel_type: "Petrol",
    transmission: "6-Speed with Quickshifter+",
    price: 450,
    deposit_amount: 3000,
    rating: 4.9,
    image: "/assets/ktm.png",
    vehicle_reg_no: "TS 09 RZ 1004",
    status: "Active",
    description: "Pure track-bred supersport machine featuring race-derived chassis, WP APEX adjustable suspension, cornering ABS with Supermoto mode, and lean-angle sensitive traction control.",
    features_json: JSON.stringify(["Quickshifter+ (Bi-directional)", "Cornering ABS & Supermoto Mode", "Motorcycle Traction Control (MTC)", "TFT Display with Turn-by-Turn", "WP APEX Upside Down Forks", "Clip-on Handlebars"]),
    specs_json: JSON.stringify({
      motor_engine: "373.27 cc Liquid-cooled Single Cylinder DOHC",
      power: "43.5 bhp @ 9,000 rpm",
      torque: "37 Nm @ 7,000 rpm",
      top_speed: "170 km/h",
      range_efficiency: "28 km/l Mileage",
      fuel_capacity: "13.7 Litres",
      kerb_weight: "172 kg",
      seat_height: "824 mm",
      brakes: "Front 320mm ByBre Radial, Rear 230mm Disc"
    }),
    gallery_json: JSON.stringify(["/assets/ktm.png", "/assets/ktm-2.png", "/assets/ktm-3.png"])
  },
  {
    id: 5,
    name: "Bajaj Pulsar NS200",
    brand: "Bajaj",
    model: "Pulsar NS200 Dual ABS",
    category: "Bike",
    year: 2024,
    fuel_type: "Petrol",
    transmission: "6-Speed Manual",
    price: 250,
    deposit_amount: 2000,
    rating: 4.7,
    image: "/assets/bajaj.png",
    vehicle_reg_no: "TS 09 RZ 1005",
    status: "Active",
    description: "The street predator with triple-spark 4-valve DTS-i engine, perimeter frame, inverted USD front forks, and dual-channel ABS for supreme high-speed stability.",
    features_json: JSON.stringify(["Triple Spark DTS-i FI Engine", "USD Front Forks", "Perimeter Frame Chassis", "Dual-Channel ABS", "Gear Position Indicator", "Nitrox Mono Shock Absorber"]),
    specs_json: JSON.stringify({
      motor_engine: "199.5 cc Liquid-cooled Triple Spark 4-Valve",
      power: "24.5 bhp @ 9,750 rpm",
      torque: "18.74 Nm @ 8,000 rpm",
      top_speed: "136 km/h",
      range_efficiency: "36 km/l Mileage",
      fuel_capacity: "12 Litres",
      kerb_weight: "158 kg",
      seat_height: "805 mm",
      brakes: "Front 300mm Disc, Rear 230mm Disc (Dual ABS)"
    }),
    gallery_json: JSON.stringify(["/assets/bajaj.png", "/assets/bajaj-2.png", "/assets/bajaj-3.png"])
  },
  {
    id: 6,
    name: "Royal Enfield Hunter 350",
    brand: "Royal Enfield",
    model: "Hunter 350 Rebel",
    category: "Bike",
    year: 2024,
    fuel_type: "Petrol",
    transmission: "5-Speed Constant Mesh",
    price: 320,
    deposit_amount: 2000,
    rating: 4.8,
    image: "/assets/hunter.png",
    vehicle_reg_no: "TS 09 RZ 1006",
    status: "Active",
    description: "The modern street-roadster with iconic J-Series 349cc single-cylinder engine, short wheelbase, dual-channel ABS, and distinct low-end torque for city and highway cruising.",
    features_json: JSON.stringify(["J-Series 349cc Engine", "Dual-Channel ABS", "Digi-Analog Instrument Cluster", "Tripper Navigation Ready", "17-inch Alloy Wheels", "Dual Down-tube Spine Frame"]),
    specs_json: JSON.stringify({
      motor_engine: "349.34 cc Single Cylinder 4-Stroke Air-Oil Cooled",
      power: "20.2 bhp @ 6,100 rpm",
      torque: "27 Nm @ 4,000 rpm",
      top_speed: "114 km/h",
      range_efficiency: "36.2 km/l Mileage",
      fuel_capacity: "13 Litres",
      kerb_weight: "181 kg",
      seat_height: "790 mm",
      brakes: "Front 300mm Disc, Rear 270mm Disc with ABS"
    }),
    gallery_json: JSON.stringify(["/assets/hunter.png", "/assets/hunter-2.png", "/assets/hunter-3.png"])
  },
  {
    id: 7,
    name: "TVS Apache RTR 160 4V",
    brand: "TVS",
    model: "Apache RTR 160 4V Special Edition",
    category: "Bike",
    year: 2024,
    fuel_type: "Petrol",
    transmission: "5-Speed Manual",
    price: 240,
    deposit_amount: 1500,
    rating: 4.8,
    image: "/assets/tvs.png",
    vehicle_reg_no: "TS 09 RZ 1007",
    status: "Active",
    description: "Track-inspired racing motorcycle with 4-valve oil-cooled engine, 3 dynamic ride modes (Sport, Urban, Rain), SmartXonnect telemetry, and bullpup race exhaust.",
    features_json: JSON.stringify(["3 Ride Modes (Urban/Rain/Sport)", "SmartXonnect Bluetooth Telemetry", "Glide Through Technology (GTT)", "Showa Race-Tuned Suspension", "Wave Bite Key", "Radial Rear Tyre"]),
    specs_json: JSON.stringify({
      motor_engine: "159.7 cc Single-Cylinder 4-Valve Oil-Cooled",
      power: "17.55 bhp @ 9,250 rpm (Sport Mode)",
      torque: "14.73 Nm @ 7,250 rpm",
      top_speed: "114 km/h",
      range_efficiency: "45 km/l Mileage",
      fuel_capacity: "12 Litres",
      kerb_weight: "146 kg",
      seat_height: "800 mm",
      brakes: "Front 270mm Petal Disc, Rear 200mm Petal Disc (Single ABS)"
    }),
    gallery_json: JSON.stringify(["/assets/tvs.png", "/assets/tvs-2.png", "/assets/tvs-3.png"])
  },
  {
    id: 8,
    name: "Suzuki Access 125",
    brand: "Suzuki",
    model: "Access 125 Ride Connect",
    category: "Scooter",
    year: 2024,
    fuel_type: "Petrol",
    transmission: "Automatic (CVT)",
    price: 190,
    deposit_amount: 1000,
    rating: 4.7,
    image: "/assets/suzuki.png",
    vehicle_reg_no: "TS 09 RZ 1008",
    status: "Active",
    description: "Premium retro executive scooter with SEP engine technology, Bluetooth-enabled digital console, chrome headlamp garnish, and expansive 21.8L underseat storage.",
    features_json: JSON.stringify(["Suzuki Eco Performance (SEP)", "Bluetooth Ride Connect", "LED Multi-Reflector Headlamp", "External Fuel Fill with Cap", "Front Pocket with USB Socket", "Combined Brake System (CBS)"]),
    specs_json: JSON.stringify({
      motor_engine: "124 cc 4-Stroke 1-Cylinder Air-Cooled SOHC",
      power: "8.7 bhp @ 6,750 rpm",
      torque: "10.0 Nm @ 5,500 rpm",
      top_speed: "92 km/h",
      range_efficiency: "48 km/l Mileage",
      fuel_capacity: "5 Litres",
      kerb_weight: "103 kg",
      seat_height: "773 mm",
      brakes: "Front Disc, Rear Drum with CBS"
    }),
    gallery_json: JSON.stringify(["/assets/suzuki.png", "/assets/suzuki-2.png", "/assets/suzuki-3.png"])
  },
  {
    id: 9,
    name: "Kawasaki Ninja 300",
    brand: "Kawasaki",
    model: "Ninja 300 ABS",
    category: "Superbike",
    year: 2024,
    fuel_type: "Petrol",
    transmission: "6-Speed Return with Assist & Slipper Clutch",
    price: 550,
    deposit_amount: 3500,
    rating: 4.9,
    image: "/assets/kawasaki.png",
    vehicle_reg_no: "TS 09 RZ 1009",
    status: "Active",
    description: "Legendary twin-cylinder supersport motorcycle delivering silky-smooth parallel-twin power, dual throttle valves, supersport race ergonomics, and unmistakable Ninja styling.",
    features_json: JSON.stringify(["Parallel Twin DOHC Engine", "Dual Throttle Valves", "Assist & Slipper Clutch", "Dual-Channel ABS", "High-Tensile Steel Diamond Frame", "Supersport Aerodynamics"]),
    specs_json: JSON.stringify({
      motor_engine: "296 cc Liquid-cooled 4-Stroke Parallel Twin DOHC",
      power: "39 bhp @ 11,000 rpm",
      torque: "26.1 Nm @ 10,000 rpm",
      top_speed: "180 km/h",
      range_efficiency: "26 km/l Mileage",
      fuel_capacity: "17 Litres",
      kerb_weight: "179 kg",
      seat_height: "785 mm",
      brakes: "Front 290mm Petal Disc, Rear 220mm Petal Disc (Dual ABS)"
    }),
    gallery_json: JSON.stringify(["/assets/kawasaki.png", "/assets/kawasaki-2.png", "/assets/kawasaki-3.png"])
  }
];

async function initializeDatabase() {
  try {
    // Connect directly to an already-provisioned database.
    // Hosted database users commonly do not have CREATE DATABASE privileges.
    pool = mysql.createPool({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      port: DB_PORT,
      waitForConnections: true,
      connectionLimit: DB_CONNECTION_LIMIT,
      queueLimit: 0,
      ...(DB_SSL ? { ssl: DB_SSL } : {})
    });

    const connection = await pool.getConnection();

    // 1. Ensure schema_migrations table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(50) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Read and apply pending migrations from database/migrations/ or migrations/ directory
    const migrationsDir = fs.existsSync(path.join(__dirname, "database", "migrations"))
      ? path.join(__dirname, "database", "migrations")
      : path.join(__dirname, "migrations");
    if (fs.existsSync(migrationsDir)) {
      const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort();
      for (const file of migrationFiles) {
        const [rows] = await connection.query("SELECT version FROM schema_migrations WHERE version = ?", [file]);
        if (rows.length === 0) {
          const sqlContent = fs.readFileSync(path.join(migrationsDir, file), "utf8");
          const statements = sqlContent.split(";").map(s => s.trim()).filter(s => s.length > 0);
          for (const statement of statements) {
            await connection.query(statement);
          }
          await connection.query("INSERT INTO schema_migrations (version) VALUES (?)", [file]);
          console.log(`[Database Migration] Successfully applied: ${file}`);
        }
      }
    }

    // 3. Ensure essential columns exist (in case running without fresh DB)
    const requiredColumns = [
      { table: "users", col: "status", type: "VARCHAR(20) DEFAULT 'Active'" },
      { table: "users", col: "profile_photo", type: "LONGTEXT" },
      { table: "users", col: "password_changed_at", type: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP" },
      { table: "users", col: "token_version", type: "INT DEFAULT 1" },
      { table: "admins", col: "profile_photo", type: "LONGTEXT" },
      { table: "admins", col: "password_changed_at", type: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP" },
      { table: "admins", col: "token_version", type: "INT DEFAULT 1" },
      { table: "bookings", col: "customer_email", type: "VARCHAR(255)" },
      { table: "bookings", col: "vehicle_id", type: "INT" },
      { table: "bookings", col: "deposit_amount", type: "INT NOT NULL DEFAULT 1000" },
      { table: "bookings", col: "rental_price", type: "INT NOT NULL DEFAULT 0" },
      { table: "bookings", col: "late_hours", type: "INT NOT NULL DEFAULT 0" },
      { table: "bookings", col: "late_charge", type: "INT NOT NULL DEFAULT 0" },
      { table: "bookings", col: "cancellation_fee", type: "INT NOT NULL DEFAULT 0" },
      { table: "bookings", col: "refund_amount", type: "INT NOT NULL DEFAULT 0" },
      { table: "bookings", col: "cancelled_at", type: "TIMESTAMP NULL" },
      { table: "bookings", col: "cancelled_by", type: "VARCHAR(50) DEFAULT NULL" },
      { table: "bookings", col: "cancellation_reason", type: "VARCHAR(100) DEFAULT NULL" },
      { table: "bookings", col: "cancellation_details", type: "TEXT DEFAULT NULL" },
      { table: "bookings", col: "expected_return", type: "TIMESTAMP NULL" },
      { table: "bookings", col: "actual_return", type: "TIMESTAMP NULL" }
    ];

    for (const item of requiredColumns) {
      try {
        await connection.query(`ALTER TABLE ${item.table} ADD COLUMN ${item.col} ${item.type}`);
      } catch (err) {
        // Column exists
      }
    }

    // 4. Populate / Synchronize Fleet Data
    for (const defVeh of DEFAULT_FLEET_DATA) {
      const [existing] = await connection.query("SELECT id FROM vehicles WHERE id = ? OR name = ?", [defVeh.id, defVeh.name]);
      if (existing.length > 0) {
        await connection.query(
          `UPDATE vehicles 
           SET name = ?, brand = ?, model = ?, category = ?, year = ?, fuel_type = ?, 
               transmission = ?, price = ?, deposit_amount = ?, rating = ?, image = ?, 
               vehicle_reg_no = ?, status = ?, description = ?, features_json = ?, 
               specs_json = ?, gallery_json = ?
           WHERE id = ?`,
          [
            defVeh.name, defVeh.brand, defVeh.model, defVeh.category, defVeh.year, defVeh.fuel_type,
            defVeh.transmission, defVeh.price, defVeh.deposit_amount, defVeh.rating, defVeh.image,
            defVeh.vehicle_reg_no, defVeh.status, defVeh.description, defVeh.features_json,
            defVeh.specs_json, defVeh.gallery_json, existing[0].id
          ]
        );
      } else {
        await connection.query(
          `INSERT INTO vehicles 
           (id, name, brand, model, category, year, fuel_type, transmission, price, deposit_amount, rating, image, vehicle_reg_no, status, description, features_json, specs_json, gallery_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            defVeh.id, defVeh.name, defVeh.brand, defVeh.model, defVeh.category, defVeh.year,
            defVeh.fuel_type, defVeh.transmission, defVeh.price, defVeh.deposit_amount, defVeh.rating,
            defVeh.image, defVeh.vehicle_reg_no, defVeh.status, defVeh.description,
            defVeh.features_json, defVeh.specs_json, defVeh.gallery_json
          ]
        );
      }
    }

    // 5. Optionally provision the first administrator from private environment variables.
    // Never create a public default admin/password on a fresh deployment.
    if (ADMIN_NAME && ADMIN_EMAIL && ADMIN_PASSWORD) {
      if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(ADMIN_EMAIL)) {
        throw new Error("ADMIN_EMAIL is not a valid email address.");
      }
      if (ADMIN_PASSWORD.length < 12) {
        throw new Error("ADMIN_PASSWORD must contain at least 12 characters.");
      }
      const [adminCheck] = await connection.query(
        "SELECT id FROM admins WHERE email = ?",
        [ADMIN_EMAIL]
      );
      if (adminCheck.length === 0) {
        const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
        await connection.query(
          `INSERT INTO admins (name, email, password_hash, phone, location, role_title, token_version)
           VALUES (?, ?, ?, '+91 98765 43210', 'Yanam, Puducherry, India', 'Super Admin', 1)`,
          [ADMIN_NAME, ADMIN_EMAIL, adminHash]
        );
        console.log("[Database Initialization] Created initial administrator from environment configuration.");
      }
    } else {
      console.log("[Admin Setup] No administrator bootstrap configured. Use 'npm run create-admin' to create one.");
    }

    // 6. Backfill booking email / vehicle_id linkage
    await connection.query(`
      UPDATE bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN admins a ON b.user_id = a.id
      SET b.customer_email = COALESCE(b.customer_email, u.email, a.email, 'customer@ridezone.com'),
          b.user_name = COALESCE(b.user_name, u.name, a.name, 'Valued Customer')
      WHERE b.customer_email IS NULL OR b.customer_email = '' OR b.user_name IS NULL OR b.user_name = ''
    `);

    await connection.query(`
      UPDATE bookings b
      JOIN vehicles v ON b.vehicle_name = v.name
      SET b.vehicle_id = v.id
      WHERE b.vehicle_id IS NULL
    `);

    isDbConnected = true;
    connection.release();
    console.log("--------------------------------------------------");
    console.log(`[MySQL] Successfully connected to database '${DB_NAME}' on ${DB_HOST}:${DB_PORT}`);
    console.log("--------------------------------------------------");
  } catch (error) {
    isDbConnected = false;
    console.error("==================================================");
    console.error(`[CRITICAL DATABASE CONNECTION FAILURE]: ${error.message || error.code || error}`);
    if (error.code === "ECONNREFUSED") {
      console.error("-> Reason: Cannot connect to MySQL server on " + DB_HOST + ":" + DB_PORT);
      console.error("-> Verify DB_HOST, DB_PORT, network access, and whether the hosted MySQL service is running.");
    } else if (error.code === "ER_ACCESS_DENIED_ERROR") {
      console.error("-> Reason: Invalid username or password for MySQL.");
      console.error("-> Fix: Check DB_USER and DB_PASSWORD in .env.");
    } else {
      console.error(error);
    }
    console.error("==================================================");
    process.exit(1);
  }
}

// ------------------------------------------------------------
// 4. AUTHENTICATION & TOKEN REVOCATION MIDDLEWARES
// ------------------------------------------------------------
function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }
  return null;
}

// Customer Middleware with Token-Version & Account Status Invalidation
async function requireCustomer(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: "Authentication required. Missing Bearer token." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });

    if (decoded.role === "admin") {
      const [admins] = await pool.query(
        "SELECT id, name, email, phone, location, role_title, profile_photo, token_version FROM admins WHERE id = ?",
        [decoded.id]
      );
      if (!admins || admins.length === 0) {
        return res.status(401).json({ error: "Administrator account no longer exists." });
      }
      const admin = admins[0];
      if (decoded.token_version !== undefined && admin.token_version !== undefined && decoded.token_version !== admin.token_version) {
        return res.status(401).json({ error: "Administrator session expired due to password update. Please log in again." });
      }
      req.user = { id: admin.id, name: admin.name, email: admin.email, role: "admin", status: "Active", profile_photo: admin.profile_photo };
      return next();
    }

    const [users] = await pool.query(
      "SELECT id, name, email, phone, status, profile_photo, token_version FROM users WHERE id = ?",
      [decoded.id]
    );

    if (!users || users.length === 0) {
      return res.status(401).json({ error: "Customer account not found." });
    }

    const user = users[0];
    if (user.status === "Suspended" || user.status === "Inactive") {
      return res.status(403).json({ error: "Account suspended. Please contact RideZone support." });
    }

    if (decoded.token_version !== undefined && user.token_version !== undefined && decoded.token_version !== user.token_version) {
      return res.status(401).json({ error: "Session expired due to password change. Please log in again." });
    }

    req.user = { id: user.id, name: user.name, email: user.email, phone: user.phone, status: user.status || "Active", role: "customer", profile_photo: user.profile_photo };
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Authentication token has expired. Please sign in again." });
    }
    return res.status(401).json({ error: "Invalid authentication token signature." });
  }
}

// Strict Admin Authorization Middleware
async function requireAdmin(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: "Administrator authentication required. Missing token." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });

    if (decoded.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Administrator privileges required." });
    }

    const [admins] = await pool.query(
      "SELECT id, name, email, phone, location, role_title, profile_photo, token_version FROM admins WHERE id = ?",
      [decoded.id]
    );

    if (!admins || admins.length === 0) {
      return res.status(401).json({ error: "Administrator account no longer exists." });
    }

    const admin = admins[0];
    if (decoded.token_version !== undefined && admin.token_version !== undefined && decoded.token_version !== admin.token_version) {
      return res.status(401).json({ error: "Administrator session expired due to password update. Please log in again." });
    }

    req.admin = { id: admin.id, name: admin.name, email: admin.email, phone: admin.phone, location: admin.location, role_title: admin.role_title, profile_photo: admin.profile_photo };
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Administrator token has expired. Please log in again." });
    }
    return res.status(401).json({ error: "Invalid administrator token signature." });
  }
}

// ------------------------------------------------------------
// 5. HARDENED BINARY MAGIC-BYTE UPLOAD PROCESSOR & ENDPOINTS
// ------------------------------------------------------------

function processAndValidateImageUpload(dataUrl, filename) {
  if (!dataUrl || typeof dataUrl !== "string") {
    return { error: "Image data URL is required.", status: 400 };
  }

  let base64Data = dataUrl;
  let declaredMime = "";
  const mimeMatch = dataUrl.match(/^data:([^;]+);base64,/);
  if (mimeMatch) {
    declaredMime = mimeMatch[1].toLowerCase().trim();
    base64Data = dataUrl.replace(/^data:[^;]+;base64,/, "");
  }

  const allowedMimes = ["image/png", "image/jpeg", "image/jpg", "image/pjpeg", "image/webp"];
  if (declaredMime && !allowedMimes.includes(declaredMime)) {
    return { error: "Unsupported MIME type. Only PNG, JPG, and WebP images are allowed.", status: 400 };
  }

  let buffer;
  try {
    buffer = Buffer.from(base64Data, "base64");
  } catch (err) {
    return { error: "Invalid base64 payload.", status: 400 };
  }

  // 5MB Size limit check (5 * 1024 * 1024 bytes)
  if (buffer.length > 5 * 1024 * 1024) {
    return { error: "Image file exceeds maximum allowable size of 5MB.", status: 413 };
  }

  if (buffer.length < 8) {
    return { error: "Invalid or empty image payload.", status: 400 };
  }

  // Inspect Binary Magic Bytes
  let validatedExt = null;
  let detectedMime = null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    validatedExt = "png";
    detectedMime = "image/png";
  }
  // JPEG/JPG: FF D8 FF
  else if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    validatedExt = "jpg";
    detectedMime = "image/jpeg";
  }
  // WEBP: RIFF ... WEBP (52 49 46 46 .... 57 45 42 50)
  else if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    validatedExt = "webp";
    detectedMime = "image/webp";
  }

  if (!validatedExt) {
    return {
      error: "Unacceptable file format. Upload must be a valid PNG, JPG/JPEG, or WEBP image. Scripts, SVGs, and executables are strictly rejected.",
      status: 400
    };
  }

  // Verify declared MIME matches detected magic byte format
  if (declaredMime) {
    const normDeclared = declaredMime === "image/jpg" || declaredMime === "image/pjpeg" ? "image/jpeg" : declaredMime;
    if (normDeclared !== detectedMime) {
      return { error: "MIME type does not match binary image format.", status: 400 };
    }
  }

  // Verify filename extension if provided
  if (filename && typeof filename === "string") {
    const ext = path.extname(filename).toLowerCase().replace(".", "");
    const dangerousExts = ["exe", "bat", "sh", "php", "js", "html", "htm", "svg", "vbs", "ps1", "jsp", "asp"];
    if (dangerousExts.includes(ext)) {
      return { error: "Dangerous or invalid file extension detected.", status: 400 };
    }
  }

  // Generate cryptographically secure randomized filename matching verified format
  const safeRandomName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${validatedExt}`;
  const targetFilePath = path.join(uploadsDir, safeRandomName);

  fs.writeFileSync(targetFilePath, buffer);

  const publicUrl = `/uploads/${safeRandomName}`;
  return {
    url: publicUrl,
    filename: safeRandomName,
    mimeType: detectedMime,
    status: 200
  };
}

// POST /api/upload - Customer Profile Photo Upload
app.post("/api/upload", uploadRateLimiter.middleware(), requireCustomer, async (req, res) => {
  try {
    const { dataUrl, filename } = req.body;
    const result = processAndValidateImageUpload(dataUrl, filename);
    if (result.error) {
      return res.status(result.status || 400).json({ error: result.error });
    }
    return res.status(200).json({
      message: "Customer photo uploaded and verified successfully.",
      url: result.url,
      filename: result.filename
    });
  } catch (error) {
    console.error("[Customer Upload Error]:", error);
    return res.status(500).json({ error: "Failed to process and store image upload." });
  }
});

// POST /api/admin/upload - Strict Administrator Asset & Vehicle Image Upload
app.post("/api/admin/upload", uploadRateLimiter.middleware(), requireAdmin, async (req, res) => {
  try {
    const { dataUrl, filename } = req.body;
    const result = processAndValidateImageUpload(dataUrl, filename);
    if (result.error) {
      return res.status(result.status || 400).json({ error: result.error });
    }
    return res.status(200).json({
      message: "Administrator vehicle asset uploaded and verified successfully.",
      url: result.url,
      filename: result.filename
    });
  } catch (error) {
    console.error("[Admin Upload Error]:", error);
    return res.status(500).json({ error: "Failed to process and store admin asset upload." });
  }
});

// ------------------------------------------------------------
// 6. CUSTOMER AUTHENTICATION & PASSWORD LIFECYCLE
// ------------------------------------------------------------

// POST /api/auth/register
app.post("/api/auth/register", authRateLimiter.middleware(), async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }

    const trimmedName = String(name).trim();
    const normalizedEmail = String(email).trim().toLowerCase();
    const cleanPhone = phone ? String(phone).trim() : null;

    if (trimmedName.length < 2 || trimmedName.length > 100) {
      return res.status(400).json({ error: "Name must be between 2 and 100 characters." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ error: "Please provide a valid email address." });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    const [existing] = await pool.query("SELECT id FROM users WHERE email = ?", [normalizedEmail]);
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: "An account with this email address already exists." });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const [insertResult] = await pool.query(
      "INSERT INTO users (name, email, password_hash, phone, password_changed_at) VALUES (?, ?, ?, ?, NOW())",
      [trimmedName, normalizedEmail, passwordHash, cleanPhone]
    );

    const userId = insertResult.insertId;
    const token = jwt.sign(
      { id: userId, name: trimmedName, email: normalizedEmail, role: "customer", token_version: 1, iat: Math.floor(Date.now() / 1000) },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Customer account created successfully.",
      token,
      user: { id: userId, name: trimmedName, email: normalizedEmail, phone: cleanPhone, profile_photo: null }
    });
  } catch (error) {
    console.error("[Customer Registration Error]:", error);
    res.status(500).json({ error: "Internal server error during registration." });
  }
});

// POST /api/auth/login
app.post("/api/auth/login", authRateLimiter.middleware(), async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Check users table first
    const [userRows] = await pool.query(
      "SELECT id, name, email, password_hash, phone, profile_photo, token_version FROM users WHERE email = ?",
      [normalizedEmail]
    );

    if (userRows && userRows.length > 0) {
      const user = userRows[0];
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ error: "Invalid email or password." });
      }

      const token = jwt.sign(
        { id: user.id, name: user.name, email: user.email, role: "customer", token_version: user.token_version || 1, iat: Math.floor(Date.now() / 1000) },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.status(200).json({
        message: "Login successful.",
        token,
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone, profile_photo: user.profile_photo }
      });
    }

    // Check admins table
    const [adminRows] = await pool.query(
      "SELECT id, name, email, password_hash, phone, location, role_title, profile_photo, token_version FROM admins WHERE email = ?",
      [normalizedEmail]
    );

    if (adminRows && adminRows.length > 0) {
      const admin = adminRows[0];
      const isMatch = await bcrypt.compare(password, admin.password_hash);
      if (!isMatch) {
        return res.status(401).json({ error: "Invalid email or password." });
      }

      const token = jwt.sign(
        { id: admin.id, name: admin.name, email: admin.email, role: "admin", token_version: admin.token_version || 1, iat: Math.floor(Date.now() / 1000) },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      return res.status(200).json({
        message: "Administrator login successful.",
        token,
        user: { id: admin.id, name: admin.name, email: admin.email, phone: admin.phone, role: "admin", profile_photo: admin.profile_photo }
      });
    }

    return res.status(401).json({ error: "Invalid email or password." });
  } catch (error) {
    console.error("[Login Error]:", error);
    res.status(500).json({ error: "Internal server error during authentication." });
  }
});

// GET /api/auth/me
app.get("/api/auth/me", requireCustomer, async (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/change-password
app.post("/api/auth/change-password", requireCustomer, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required." });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters long." });
    }

    const table = req.user.role === "admin" ? "admins" : "users";
    const [rows] = await pool.query(`SELECT id, password_hash, token_version FROM ${table} WHERE id = ?`, [req.user.id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "Account not found." });
    }

    const isMatch = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: "Current password does not match." });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);
    const nextVersion = (rows[0].token_version || 1) + 1;

    await pool.query(
      `UPDATE ${table} SET password_hash = ?, token_version = ?, password_changed_at = NOW() WHERE id = ?`,
      [newHash, nextVersion, req.user.id]
    );

    // Issue new JWT token with incremented token_version
    const newToken = jwt.sign(
      { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role, token_version: nextVersion, iat: Math.floor(Date.now() / 1000) },
      JWT_SECRET,
      { expiresIn: req.user.role === "admin" ? "24h" : "7d" }
    );

    res.json({ message: "Password updated successfully. All other active sessions have been invalidated.", token: newToken });
  } catch (error) {
    console.error("[Change Password Error]:", error);
    res.status(500).json({ error: "Failed to update password." });
  }
});

// POST /api/auth/forgot-password
app.post("/api/auth/forgot-password", authRateLimiter.middleware(), async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email address is required." });

    const normalizedEmail = String(email).trim().toLowerCase();
    const [users] = await pool.query("SELECT id, name FROM users WHERE email = ?", [normalizedEmail]);

    // Constant-time response to prevent email enumeration
    if (!users || users.length === 0) {
      return res.json({ message: "If this email address exists in our system, a password reset link has been generated." });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes validity

    await pool.query(
      "INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)",
      [normalizedEmail, resetToken, expiresAt]
    );

    return res.json({
      message: "If this email address exists in our system, a password reset link has been generated.",
      resetToken, // Returned in dev/API mode for seamless recovery
      expiresInMinutes: 15
    });
  } catch (error) {
    console.error("[Forgot Password Error]:", error);
    res.status(500).json({ error: "Failed to process password reset request." });
  }
});

// POST /api/auth/reset-password
app.post("/api/auth/reset-password", authRateLimiter.middleware(), async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: "Reset token and new password are required." });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters long." });
    }

    const [records] = await pool.query(
      "SELECT id, email, expires_at, used FROM password_resets WHERE token = ?",
      [token]
    );

    if (!records || records.length === 0) {
      return res.status(400).json({ error: "Invalid or expired password reset token." });
    }

    const record = records[0];
    if (record.used || new Date() > new Date(record.expires_at)) {
      return res.status(400).json({ error: "This password reset token has expired or has already been used." });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await pool.query("UPDATE users SET password_hash = ?, token_version = token_version + 1, password_changed_at = NOW() WHERE email = ?", [newHash, record.email]);
    await pool.query("UPDATE password_resets SET used = 1 WHERE id = ?", [record.id]);

    res.json({ message: "Password has been reset successfully. You may now sign in with your new credentials." });
  } catch (error) {
    console.error("[Reset Password Error]:", error);
    res.status(500).json({ error: "Failed to reset password." });
  }
});

// ------------------------------------------------------------
// 7. ADMINISTRATOR AUTHENTICATION & PROFILE
// ------------------------------------------------------------

// POST /api/admin/login
app.post("/api/admin/login", authRateLimiter.middleware(), async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Admin email and password are required." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const [rows] = await pool.query(
      "SELECT id, name, email, password_hash, phone, location, role_title, profile_photo, token_version FROM admins WHERE email = ?",
      [normalizedEmail]
    );

    if (!rows || rows.length === 0) {
      return res.status(401).json({ error: "Invalid administrator credentials." });
    }

    const admin = rows[0];
    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid administrator credentials." });
    }

    const token = jwt.sign(
      { id: admin.id, name: admin.name, email: admin.email, role: "admin", token_version: admin.token_version || 1, iat: Math.floor(Date.now() / 1000) },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.status(200).json({
      message: `Administrator login successful. Welcome, ${admin.name}!`,
      token,
      admin: { id: admin.id, name: admin.name, email: admin.email, phone: admin.phone, location: admin.location, role_title: admin.role_title, profile_photo: admin.profile_photo }
    });
  } catch (error) {
    console.error("[Admin Login Error]:", error);
    return res.status(500).json({ error: "Server error during admin authentication." });
  }
});

// GET /api/admin/me
app.get("/api/admin/me", requireAdmin, async (req, res) => {
  const [rows] = await pool.query(
    "SELECT id, name, email, phone, location, role_title, profile_photo, created_at FROM admins WHERE id = ?",
    [req.admin.id]
  );
  if (rows && rows.length > 0) {
    return res.json({ admin: rows[0] });
  }
  res.json({ admin: req.admin });
});

// PUT /api/admin/profile - Synchronized Admin Profile
app.put("/api/admin/profile", requireAdmin, async (req, res) => {
  try {
    const { name, email, phone, location, profile_photo } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required." });
    }

    const trimmedName = String(name).trim();
    const normalizedEmail = String(email).trim().toLowerCase();
    const cleanPhone = phone ? String(phone).trim() : "+91 98765 43210";
    const cleanLocation = location ? String(location).trim() : "Hyderabad, Telangana, India";
    const cleanPhoto = profile_photo !== undefined ? profile_photo : null;

    const [existing] = await pool.query(
      "SELECT id FROM admins WHERE email = ? AND id != ?",
      [normalizedEmail, req.admin.id]
    );
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: "An administrator account with this email already exists." });
    }

    // Update authoritative administrator record in admins table
    let photoSql = "profile_photo = profile_photo";
    const updateParams = [trimmedName, normalizedEmail, cleanPhone, cleanLocation];
    let finalPhoto = req.admin.profile_photo || null;

    if (profile_photo !== undefined) {
      photoSql = "profile_photo = ?";
      finalPhoto = profile_photo ? String(profile_photo).trim() : null;
      updateParams.push(finalPhoto);
    }
    updateParams.push(req.admin.id);

    await pool.query(
      `UPDATE admins SET name = ?, email = ?, phone = ?, location = ?, ${photoSql} WHERE id = ?`,
      updateParams
    );

    const updatedAdmin = {
      id: req.admin.id,
      name: trimmedName,
      email: normalizedEmail,
      phone: cleanPhone,
      location: cleanLocation,
      profile_photo: finalPhoto,
      role: "admin"
    };

    const token = jwt.sign(
      { id: updatedAdmin.id, name: updatedAdmin.name, email: updatedAdmin.email, role: "admin", token_version: req.admin.token_version || 1, iat: Math.floor(Date.now() / 1000) },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.json({
      message: "Admin profile updated successfully.",
      admin: updatedAdmin,
      token
    });
  } catch (error) {
    console.error("[Admin Update Profile Error]:", error);
    res.status(500).json({ error: "Failed to update admin profile." });
  }
});

// POST /api/admin/change-password
app.post("/api/admin/change-password", requireAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required." });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters long." });
    }

    const [rows] = await pool.query("SELECT id, password_hash, token_version FROM admins WHERE id = ?", [req.admin.id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "Administrator account not found." });
    }

    const isMatch = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: "Current password does not match." });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);
    const nextVersion = (rows[0].token_version || 1) + 1;

    await pool.query(
      "UPDATE admins SET password_hash = ?, token_version = ?, password_changed_at = NOW() WHERE id = ?",
      [newHash, nextVersion, req.admin.id]
    );

    return res.json({ message: "Administrator password updated successfully." });
  } catch (error) {
    console.error("[Admin Change Password Error]:", error);
    res.status(500).json({ error: "Failed to change password." });
  }
});

// POST /api/admin/logout
app.post("/api/admin/logout", (req, res) => {
  res.json({ message: "Administrator session logged out." });
});

// ------------------------------------------------------------
// 8. VEHICLES CATALOG & AVAILABILITY ENDPOINTS
// ------------------------------------------------------------

// GET /api/vehicles
app.get("/api/vehicles", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM vehicles ORDER BY id ASC");
    const formatted = rows.map((v) => {
      let features = [];
      let specs = {};
      let gallery = [];
      try { features = v.features_json ? (typeof v.features_json === "string" ? JSON.parse(v.features_json) : v.features_json) : []; } catch (e) {}
      try { specs = v.specs_json ? (typeof v.specs_json === "string" ? JSON.parse(v.specs_json) : v.specs_json) : {}; } catch (e) {}
      try { gallery = v.gallery_json ? (typeof v.gallery_json === "string" ? JSON.parse(v.gallery_json) : v.gallery_json) : []; } catch (e) {}

      return {
        id: v.id,
        name: v.name,
        brand: v.brand || v.name.split(" ")[0],
        model: v.model || v.name,
        category: v.category,
        year: v.year || 2024,
        fuel_type: v.fuel_type || "Petrol",
        transmission: v.transmission || "Manual",
        price: Number(v.price),
        deposit_amount: Number(v.deposit_amount || 1000),
        rating: Number(v.rating),
        image: v.image,
        vehicle_reg_no: v.vehicle_reg_no,
        status: v.status || "Active",
        description: v.description || "",
        features,
        specs,
        gallery: gallery.length > 0 ? gallery : [v.image]
      };
    });
    return res.json(formatted);
  } catch (error) {
    console.error("[GET /api/vehicles Error]:", error);
    return res.status(500).json({ error: "Failed to retrieve vehicle catalog." });
  }
});

// GET /api/vehicles/:id
app.get("/api/vehicles/:id", async (req, res) => {
  try {
    const rawParam = req.params.id;
    const isNum = !isNaN(rawParam);

    let query = isNum ? "SELECT * FROM vehicles WHERE id = ?" : "SELECT * FROM vehicles WHERE name = ? OR model = ?";
    const [rows] = await pool.query(query, [rawParam, rawParam]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "Vehicle not found." });
    }

    const v = rows[0];
    let features = [];
    let specs = {};
    let gallery = [];
    try { features = v.features_json ? (typeof v.features_json === "string" ? JSON.parse(v.features_json) : v.features_json) : []; } catch (e) {}
    try { specs = v.specs_json ? (typeof v.specs_json === "string" ? JSON.parse(v.specs_json) : v.specs_json) : {}; } catch (e) {}
    try { gallery = v.gallery_json ? (typeof v.gallery_json === "string" ? JSON.parse(v.gallery_json) : v.gallery_json) : []; } catch (e) {}

    return res.json({
      vehicle: {
        ...v,
        price: Number(v.price),
        deposit_amount: Number(v.deposit_amount || 1000),
        rating: Number(v.rating),
        features,
        specs,
        gallery: gallery.length > 0 ? gallery : [v.image]
      }
    });
  } catch (error) {
    console.error("[GET /api/vehicles/:id Error]:", error);
    return res.status(500).json({ error: "Failed to load vehicle record." });
  }
});

// GET /api/vehicles/:name/availability
app.get("/api/vehicles/:name/availability", async (req, res) => {
  try {
    const vehicleName = decodeURIComponent(req.params.name);
    const [rows] = await pool.query(
      `SELECT id, vehicle_name, pickup_date, pickup_time, hours, booking_status 
       FROM bookings 
       WHERE vehicle_name = ? AND booking_status != 'Cancelled'`,
      [vehicleName]
    );
    return res.json({ bookings: rows });
  } catch (error) {
    console.error("[Vehicle Availability Error]:", error);
    res.status(500).json({ error: "Failed to retrieve vehicle availability schedule." });
  }
});

// POST /api/contact - Customer Inquiries & Showroom Messages
app.post("/api/contact", generalApiLimiter.middleware(), async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: "All fields (name, email, subject, message) are required." });
    }

    const trimmedName = String(name).trim();
    const trimmedEmail = String(email).trim().toLowerCase();
    const trimmedSubject = String(subject).trim();
    const trimmedMessage = String(message).trim();

    if (trimmedName.length < 2 || trimmedName.length > 100) {
      return res.status(400).json({ error: "Name must be between 2 and 100 characters." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail) || trimmedEmail.length > 120) {
      return res.status(400).json({ error: "Please provide a valid email address." });
    }

    if (trimmedSubject.length < 2 || trimmedSubject.length > 200) {
      return res.status(400).json({ error: "Subject must be between 2 and 200 characters." });
    }

    if (trimmedMessage.length < 5 || trimmedMessage.length > 2000) {
      return res.status(400).json({ error: "Message must be between 5 and 2000 characters." });
    }

    console.log(`[Contact Submission] Received message from '${trimmedName}' (${trimmedEmail}): Subject: "${trimmedSubject}"`);

    return res.status(200).json({
      message: "Thank you, your message has been received. Our team will get back to you shortly."
    });
  } catch (error) {
    console.error("[Contact API Error]:", error);
    return res.status(500).json({ error: "Failed to process inquiry. Please try again later." });
  }
});

// ------------------------------------------------------------
// 9. TRANSACTIONAL BOOKING CREATION & CONCURRENCY CONTROL
// ------------------------------------------------------------

// POST /api/bookings - Atomic Double-Booking Prevention with Row Locking
app.post("/api/bookings", requireCustomer, async (req, res) => {
  let connection = null;
  try {
    const vehicleName = req.body.vehicle || req.body.vehicle_name;
    const vehicle_id = req.body.vehicle_id;
    const date = req.body.date || req.body.pickup_date;
    const time = req.body.time || req.body.pickup_time;
    const hours = req.body.hours;
    const payment_method = req.body.payment_method;
    const initialStatus = req.body.booking_status && ["Pending", "Confirmed"].includes(req.body.booking_status) ? req.body.booking_status : "Confirmed";

    if ((!vehicleName && !vehicle_id) || !date || !time || !hours) {
      return res.status(400).json({ error: "All booking fields (vehicle, date, time, hours) are required." });
    }

    if (req.body.terms_accepted !== undefined && (req.body.terms_accepted === false || req.body.terms_accepted === "false" || req.body.terms_accepted === 0)) {
      return res.status(400).json({ error: "Please accept the required rental conditions before continuing." });
    }

    const duration = Number(hours);
    if (!Number.isInteger(duration) || duration < 1 || duration > 24) {
      return res.status(400).json({ error: "Rental hours must be an integer between 1 and 24." });
    }

    const formattedTime = time.length === 5 ? time + ":00" : time;
    const requestedStart = `${date} ${formattedTime}`;
    const startDate = new Date(`${date}T${formattedTime}`);

    if (isNaN(startDate.getTime())) {
      return res.status(400).json({ error: "Invalid pickup date or time format." });
    }

    // Acquire dedicated database connection for atomic transaction
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Lock vehicle record FOR UPDATE
    let vehicle = null;
    if (vehicle_id) {
      const [rows] = await connection.query("SELECT * FROM vehicles WHERE id = ? FOR UPDATE", [vehicle_id]);
      if (rows && rows.length > 0) vehicle = rows[0];
    } else {
      const [rows] = await connection.query("SELECT * FROM vehicles WHERE name = ? FOR UPDATE", [vehicleName]);
      if (rows && rows.length > 0) vehicle = rows[0];
    }

    if (!vehicle) {
      await connection.rollback();
      return res.status(404).json({ error: "Requested vehicle record not found in active fleet." });
    }

    if (vehicle.status !== "Active") {
      await connection.rollback();
      return res.status(400).json({ error: `This vehicle is currently ${vehicle.status} and unavailable for booking.` });
    }

    // 2. Atomic Overlap Detection with ROW LOCKING
    const [conflicts] = await connection.query(
      `SELECT id, pickup_date, pickup_time, hours 
       FROM bookings 
       WHERE vehicle_name = ? 
         AND booking_status != 'Cancelled'
         AND TIMESTAMP(pickup_date, pickup_time) < DATE_ADD(?, INTERVAL ? HOUR)
         AND DATE_ADD(TIMESTAMP(pickup_date, pickup_time), INTERVAL hours HOUR) > ?
       FOR UPDATE`,
      [vehicle.name, requestedStart, duration, requestedStart]
    );

    if (conflicts && conflicts.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        error: `Schedule Conflict: ${vehicle.name} is already reserved during the requested interval. Please select a different time or vehicle.`
      });
    }

    // 3. Compute Financial Calculations from authoritatively locked vehicle record
    const rentalPrice = Math.round(Number(vehicle.price) * duration);
    const depositAmount = Math.round(Number(vehicle.deposit_amount) || 1000);
    const totalPrice = rentalPrice + depositAmount;
    const bookingId = "RZ-" + crypto.randomUUID().split("-")[0].toUpperCase();
    const userId = req.user.id;
    const userName = req.user.name;
    const userEmail = req.user.email || "customer@ridezone.com";
    const vehicleRegNo = vehicle.vehicle_reg_no || "TS 09 RZ 1001";
    const validPaymentMethods = ["UPI", "Credit / Debit Card", "Credit Card", "Debit Card", "Net Banking"];
    const paymentMethod = payment_method && validPaymentMethods.includes(payment_method) ? payment_method : "UPI";
    const expectedReturnDateTime = new Date(startDate.getTime() + duration * 3600 * 1000);
    const expectedReturnStr = expectedReturnDateTime.toISOString().slice(0, 19).replace('T', ' ');

    // 4. Insert booking into database inside transaction
    await connection.query(
      `INSERT INTO bookings 
       (id, user_id, user_name, customer_email, vehicle_id, vehicle_name, vehicle_reg_no, pickup_date, pickup_time, hours, rental_price, deposit_amount, total_price, payment_method, payment_status, booking_status, cancellation_fee, refund_amount, expected_return, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Paid', ?, 0, 0, ?, NOW())`,
      [
        bookingId, userId, userName, userEmail, vehicle.id, vehicle.name, vehicleRegNo,
        date, formattedTime, duration, rentalPrice, depositAmount, totalPrice, paymentMethod,
        initialStatus, expectedReturnStr
      ]
    );

    // Commit Transaction atomically
    await connection.commit();

    const [savedRows] = await pool.query("SELECT * FROM bookings WHERE id = ?", [bookingId]);
    const savedBooking = savedRows && savedRows.length > 0 ? savedRows[0] : {
      id: bookingId,
      user_id: userId,
      user_name: userName,
      customer_email: userEmail,
      vehicle_id: vehicle.id,
      vehicle_name: vehicle.name,
      vehicle_reg_no: vehicleRegNo,
      pickup_date: date,
      pickup_time: formattedTime,
      hours: duration,
      rental_price: rentalPrice,
      deposit_amount: depositAmount,
      total_price: totalPrice,
      payment_method: paymentMethod,
      payment_status: "Paid",
      booking_status: "Confirmed",
      created_at: new Date()
    };

    return res.status(201).json({
      message: "Vehicle reserved and confirmed successfully.",
      booking: savedBooking
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (rbErr) {}
    }
    console.error("[Transactional Booking Error]:", error);
    return res.status(500).json({ error: "Failed to reserve vehicle. Database transaction rolled back." });
  } finally {
    if (connection) connection.release();
  }
});

// ------------------------------------------------------------
// 10. ATOMIC & IDEMPOTENT CANCELLATION ENGINE
// ------------------------------------------------------------

// POST /api/user/bookings/:id/cancel
app.post("/api/user/bookings/:id/cancel", requireCustomer, async (req, res) => {
  let connection = null;
  try {
    const bookingId = req.params.id;
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Lock booking FOR UPDATE
    const [rows] = await connection.query(
      "SELECT * FROM bookings WHERE id = ? AND user_id = ? FOR UPDATE",
      [bookingId, req.user.id]
    );

    if (!rows || rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Booking record not found or unauthorized access." });
    }

    const booking = rows[0];

    if (booking.booking_status === "Cancelled") {
      await connection.rollback();
      return res.status(400).json({ error: "This booking is already cancelled." });
    }

    if (booking.booking_status === "Completed" || booking.actual_return) {
      await connection.rollback();
      return res.status(400).json({ error: "Completed bookings cannot be cancelled." });
    }

    const createdAt = new Date(booking.created_at);
    const now = new Date();
    const elapsedHours = (now.getTime() - createdAt.getTime()) / (3600 * 1000);

    if (elapsedHours >= 1) {
      await connection.rollback();
      return res.status(400).json({
        error: "Free 100% refund cancellation is only eligible within 1 hour of booking creation."
      });
    }

    const refundAmount = Number(booking.total_price);

    // Conditional atomic update
    const [updateResult] = await connection.query(
      `UPDATE bookings 
       SET booking_status = 'Cancelled',
           cancellation_fee = 0,
           refund_amount = ?,
           cancelled_at = NOW(),
           cancelled_by = 'Customer'
       WHERE id = ? AND user_id = ? AND booking_status = 'Confirmed'`,
      [refundAmount, bookingId, req.user.id]
    );

    if (updateResult.affectedRows !== 1) {
      await connection.rollback();
      return res.status(409).json({ error: "Booking state changed concurrently. Cancellation aborted." });
    }

    await connection.commit();

    return res.status(200).json({
      message: "Booking cancelled successfully. 100% full refund has been initiated.",
      bookingId,
      refundAmount,
      refund_amount: refundAmount,
      cancellationFee: 0,
      cancellation_fee: 0,
      cancelledAt: new Date().toISOString()
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (rbErr) {}
    }
    console.error("[Atomic Cancel Error]:", error);
    return res.status(500).json({ error: "Failed to process cancellation transaction." });
  } finally {
    if (connection) connection.release();
  }
});

// ------------------------------------------------------------
// 11. CUSTOMER PROFILE & BOOKINGS
// ------------------------------------------------------------

// GET /api/user/profile
app.get("/api/user/profile", requireCustomer, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, email, phone, COALESCE(status, 'Active') AS status, profile_photo, created_at FROM users WHERE id = ?",
      [req.user.id]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "User profile not found." });
    }
    return res.json({ user: rows[0] });
  } catch (error) {
    console.error("[Get User Profile Error]:", error);
    return res.status(500).json({ error: "Failed to load user profile." });
  }
});

// GET /api/user/bookings
app.get("/api/user/bookings", requireCustomer, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC",
      [req.user.id]
    );
    res.json({ bookings: rows });
  } catch (error) {
    console.error("[User Bookings Error]:", error);
    res.status(500).json({ error: "Failed to load customer bookings." });
  }
});

// PUT /api/user/profile
app.put("/api/user/profile", requireCustomer, async (req, res) => {
  try {
    const { name, email, phone, profile_photo } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required." });
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone ? phone.trim() : null;
    const cleanPhoto = profile_photo !== undefined ? profile_photo : null;

    const [existing] = await pool.query(
      "SELECT id FROM users WHERE email = ? AND id != ?",
      [trimmedEmail, req.user.id]
    );
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: "Email address is already taken by another account." });
    }

    await pool.query(
      "UPDATE users SET name = ?, email = ?, phone = ?, profile_photo = COALESCE(?, profile_photo) WHERE id = ?",
      [trimmedName, trimmedEmail, trimmedPhone, cleanPhoto, req.user.id]
    );

    await pool.query(
      "UPDATE bookings SET user_name = ?, customer_email = ? WHERE user_id = ?",
      [trimmedName, trimmedEmail, req.user.id]
    );

    const updatedUser = {
      id: req.user.id,
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
      profile_photo: cleanPhoto || req.user.profile_photo || null,
      role: req.user.role || "customer"
    };

    const token = jwt.sign(
      { id: updatedUser.id, name: updatedUser.name, email: updatedUser.email, role: updatedUser.role, iat: Math.floor(Date.now() / 1000) },
      JWT_SECRET,
      { expiresIn: updatedUser.role === "admin" ? "24h" : "7d" }
    );

    return res.json({
      message: "Customer profile updated successfully.",
      user: updatedUser,
      token
    });
  } catch (error) {
    console.error("[Customer Update Profile Error]:", error);
    res.status(500).json({ error: "Failed to update customer profile." });
  }
});

// ------------------------------------------------------------
// 12. COMPREHENSIVE ADMINISTRATOR REST API SUITE
// ------------------------------------------------------------

// GET /api/admin/stats & /api/admin/dashboard-stats - Full 8 KPIs & Revenue Engine
app.get(["/api/admin/stats", "/api/admin/dashboard-stats"], requireAdmin, async (req, res) => {
  try {
    const period = req.query.period === "30d" || req.query.period === "month" ? "30d" : "7d";

    const [[{ total_vehicles }]] = await pool.query("SELECT COUNT(*) as total_vehicles FROM vehicles");
    const [[{ active_vehicles }]] = await pool.query("SELECT COUNT(*) as active_vehicles FROM vehicles WHERE status = 'Active'");
    const [[{ maint_vehicles }]] = await pool.query("SELECT COUNT(*) as maint_vehicles FROM vehicles WHERE status = 'Inactive'");
    const [[{ total_users }]] = await pool.query("SELECT COUNT(*) as total_users FROM users");
    const [[{ total_bookings }]] = await pool.query("SELECT COUNT(*) as total_bookings FROM bookings");
    const [[{ pending_bookings }]] = await pool.query("SELECT COUNT(*) as pending_bookings FROM bookings WHERE booking_status = 'Pending'");
    const [[{ confirmed_bookings }]] = await pool.query("SELECT COUNT(*) as confirmed_bookings FROM bookings WHERE booking_status = 'Confirmed'");
    const [[{ completed_bookings }]] = await pool.query("SELECT COUNT(*) as completed_bookings FROM bookings WHERE booking_status = 'Completed' OR actual_return IS NOT NULL");
    const [[{ cancelled_bookings }]] = await pool.query("SELECT COUNT(*) as cancelled_bookings FROM bookings WHERE booking_status = 'Cancelled'");

    // Financial calculations - Authoritative non-cancelled rental amounts
    const [[{ gross_revenue }]] = await pool.query("SELECT COALESCE(SUM(total_price), 0) as gross_revenue FROM bookings WHERE booking_status != 'Cancelled'");
    const [[{ net_rental }]] = await pool.query("SELECT COALESCE(SUM(rental_price), 0) as net_rental FROM bookings WHERE booking_status != 'Cancelled'");
    const [[{ total_deposits_held }]] = await pool.query("SELECT COALESCE(SUM(deposit_amount), 0) as total_deposits_held FROM bookings WHERE booking_status = 'Confirmed' AND actual_return IS NULL");
    const [[{ total_refunds }]] = await pool.query("SELECT COALESCE(SUM(refund_amount), 0) as total_refunds FROM bookings WHERE booking_status = 'Cancelled'");
    const [[{ total_late_fees }]] = await pool.query("SELECT COALESCE(SUM(late_charge), 0) as total_late_fees FROM bookings");

    // Active live rentals count
    const [currentlyRentedRows] = await pool.query(`
      SELECT DISTINCT vehicle_name 
      FROM bookings 
      WHERE booking_status = 'Confirmed' 
        AND actual_return IS NULL 
        AND NOW() >= TIMESTAMP(pickup_date, pickup_time)
        AND NOW() <= DATE_ADD(TIMESTAMP(pickup_date, pickup_time), INTERVAL hours HOUR)
    `);
    const bookedVehiclesCount = currentlyRentedRows.length;
    const availableVehiclesCount = Math.max(0, Number(active_vehicles) - bookedVehiclesCount);

    // Bookings Trend (7-day or Month / 30-day continuous calendar buckets)
    const numDays = period === "30d" ? 30 : 7;
    const buckets = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Generate consecutive calendar days ending today in application local time (IST)
    const now = new Date();
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateKey = `${yyyy}-${mm}-${dd}`;
      buckets.push({
        key: dateKey,
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        day: dayNames[d.getDay()],
        count: 0,
        revenue: 0
      });
    }

    const startDateKey = buckets[0].key;
    const endDateKey = buckets[buckets.length - 1].key;

    // All bookings created during this period count toward Booking Activity (Confirmed, Pending, Completed, Cancelled).
    // Revenue counts non-cancelled bookings.
    // Use DATE_FORMAT(created_at, '%Y-%m-%d') to match MySQL session timezone / local date.
    const [trendRows] = await pool.query(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m-%d') as b_date,
        COUNT(*) as booking_count,
        COALESCE(SUM(CASE WHEN booking_status != 'Cancelled' THEN rental_price ELSE 0 END), 0) as rev
      FROM bookings
      WHERE DATE_FORMAT(created_at, '%Y-%m-%d') >= ?
        AND DATE_FORMAT(created_at, '%Y-%m-%d') <= ?
      GROUP BY b_date
      ORDER BY b_date ASC
    `, [startDateKey, endDateKey]);

    const countMap = new Map();
    trendRows.forEach(tr => {
      countMap.set(tr.b_date, {
        count: Number(tr.booking_count),
        revenue: Number(tr.rev)
      });
    });

    const bookingsTrend = buckets.map(b => {
      const row = countMap.get(b.key);
      return {
        date: b.date,
        day: b.day,
        count: row ? row.count : 0,
        revenue: row ? row.revenue : 0
      };
    });

    // Top 5 Booked Vehicles with real booking counts and fleet information
    const [topVehRows] = await pool.query(`
      SELECT b.vehicle_name, 
             COUNT(*) as count, 
             COALESCE(SUM(b.rental_price), 0) as revenue,
             COALESCE(MAX(v.image), '/assets/honda.png') as image,
             COALESCE(MAX(v.category), 'Bike') as category,
             COALESCE(MAX(v.status), 'Active') as status
      FROM bookings b
      LEFT JOIN vehicles v ON b.vehicle_name = v.name
      WHERE b.booking_status != 'Cancelled'
      GROUP BY b.vehicle_name
      ORDER BY count DESC 
      LIMIT 5
    `);

    const totalValidBookings = Math.max(Number(total_bookings) - Number(cancelled_bookings), 1);
    const topVehicles = topVehRows.map(tv => ({
      name: tv.vehicle_name,
      count: Number(tv.count),
      revenue: Number(tv.revenue),
      image: tv.image,
      category: tv.category,
      status: tv.status,
      percentage: Math.round((Number(tv.count) / totalValidBookings) * 100)
    }));

    // Recent Bookings for Dashboard table
    const [recentRows] = await pool.query(`
      SELECT b.id, b.vehicle_name, b.vehicle_reg_no, b.pickup_date, b.pickup_time, b.hours, 
             b.rental_price, b.total_price, b.booking_status, b.created_at, b.cancelled_by,
             COALESCE(b.user_name, u.name, 'Customer') AS customer_name,
             COALESCE(b.customer_email, u.email, '') AS customer_email
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      ORDER BY b.created_at DESC
      LIMIT 8
    `);

    const statsPayload = {
      totalVehicles: Number(total_vehicles),
      availableVehicles: availableVehiclesCount,
      bookedVehicles: bookedVehiclesCount,
      maintenanceVehicles: Number(maint_vehicles),
      totalUsers: Number(total_users),
      totalBookings: Number(total_bookings),
      pendingBookings: Number(pending_bookings),
      activeRentals: bookedVehiclesCount,
      completedBookings: Number(completed_bookings),
      cancelledBookings: Number(cancelled_bookings),
      grossRevenue: Number(gross_revenue),
      rentalRevenue: Number(net_rental),
      netRentalRevenue: Number(net_rental),
      totalDepositsHeld: Number(total_deposits_held),
      depositsHeld: Number(total_deposits_held),
      totalRefunds: Number(total_refunds),
      depositsRefunded: Number(total_refunds),
      totalLateFees: Number(total_late_fees),
      period,
      bookingsTrend,
      topVehicles,
      recentBookings: recentRows
    };

    res.json({
      stats: statsPayload,
      period,
      bookingsTrend,
      topVehicles,
      recentBookings: recentRows
    });
  } catch (error) {
    console.error("[Admin Stats Error]:", error);
    res.status(500).json({ error: "Failed to generate administrator analytics." });
  }
});

// GET /api/admin/vehicles - Admin Fleet Catalog
app.get("/api/admin/vehicles", requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM vehicles ORDER BY id ASC");
    const [activeBookings] = await pool.query(`
      SELECT DISTINCT vehicle_name 
      FROM bookings 
      WHERE booking_status = 'Confirmed' 
        AND actual_return IS NULL 
        AND NOW() >= TIMESTAMP(pickup_date, pickup_time)
        AND NOW() <= DATE_ADD(TIMESTAMP(pickup_date, pickup_time), INTERVAL hours HOUR)
    `);
    const activeNames = new Set(activeBookings.map(b => b.vehicle_name));

    const vehicles = rows.map(v => {
      let liveStatus = "Available";
      if (v.status === "Inactive") {
        liveStatus = "Maintenance";
      } else if (activeNames.has(v.name)) {
        liveStatus = "Booked";
      }

      let features = [];
      let specs = {};
      let gallery = [];
      try { features = v.features_json ? (typeof v.features_json === "string" ? JSON.parse(v.features_json) : v.features_json) : []; } catch (e) {}
      try { specs = v.specs_json ? (typeof v.specs_json === "string" ? JSON.parse(v.specs_json) : v.specs_json) : {}; } catch (e) {}
      try { gallery = v.gallery_json ? (typeof v.gallery_json === "string" ? JSON.parse(v.gallery_json) : v.gallery_json) : []; } catch (e) {}

      return {
        ...v,
        price: Number(v.price),
        deposit_amount: Number(v.deposit_amount || 1000),
        rating: Number(v.rating),
        live_status: liveStatus,
        features,
        specs,
        gallery: gallery.length > 0 ? gallery : [v.image]
      };
    });

    res.json({ vehicles });
  } catch (error) {
    console.error("[Admin Get Vehicles Error]:", error);
    res.status(500).json({ error: "Failed to retrieve fleet catalog." });
  }
});

// POST /api/admin/vehicles - Add Vehicle
app.post("/api/admin/vehicles", requireAdmin, async (req, res) => {
  try {
    const { name, brand, model, category, year, fuel_type, transmission, price, deposit_amount, rating, image, vehicle_reg_no, status, description, features, specs, gallery, additional_images } = req.body;
    if (!name || !category || !price || !image || !vehicle_reg_no) {
      return res.status(400).json({ error: "Name, category, price, image, and registration number are required." });
    }

    let finalGallery = [];
    if (Array.isArray(gallery) && gallery.length > 0) {
      finalGallery = [...gallery];
    } else if (Array.isArray(additional_images)) {
      finalGallery = [image, ...additional_images.filter(img => img !== image)];
    } else {
      finalGallery = [image];
    }
    if (!finalGallery.includes(image)) {
      finalGallery.unshift(image);
    }

    const [insertResult] = await pool.query(
      `INSERT INTO vehicles (name, brand, model, category, year, fuel_type, transmission, price, deposit_amount, rating, image, vehicle_reg_no, status, description, features_json, specs_json, gallery_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(), brand ? brand.trim() : name.split(" ")[0], model ? model.trim() : name,
        category, year || 2024, fuel_type || "Petrol", transmission || "Manual",
        Number(price), Number(deposit_amount || 1000), Number(rating || 4.8), image,
        vehicle_reg_no.trim(), status || "Active", description || "",
        JSON.stringify(features || []), JSON.stringify(specs || {}), JSON.stringify(finalGallery)
      ]
    );

    const [saved] = await pool.query("SELECT * FROM vehicles WHERE id = ?", [insertResult.insertId]);
    res.status(201).json({ message: "Vehicle added successfully.", vehicle: saved[0] });
  } catch (error) {
    console.error("[Admin Add Vehicle Error]:", error);
    res.status(500).json({ error: "Failed to add vehicle to fleet." });
  }
});

// GET /api/admin/vehicles/:id
app.get("/api/admin/vehicles/:id", requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM vehicles WHERE id = ?", [req.params.id]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: "Vehicle not found." });
    const v = rows[0];
    let features = [];
    let specs = {};
    let gallery = [];
    try { features = v.features_json ? (typeof v.features_json === "string" ? JSON.parse(v.features_json) : v.features_json) : []; } catch (e) {}
    try { specs = v.specs_json ? (typeof v.specs_json === "string" ? JSON.parse(v.specs_json) : v.specs_json) : {}; } catch (e) {}
    try { gallery = v.gallery_json ? (typeof v.gallery_json === "string" ? JSON.parse(v.gallery_json) : v.gallery_json) : []; } catch (e) {}

    res.json({
      vehicle: {
        ...v,
        price: Number(v.price),
        deposit_amount: Number(v.deposit_amount || 1000),
        rating: Number(v.rating),
        features,
        specs,
        gallery: gallery.length > 0 ? gallery : [v.image]
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve vehicle details." });
  }
});

// PUT /api/admin/vehicles/:id - Update Vehicle
app.put("/api/admin/vehicles/:id", requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const { name, brand, model, category, year, fuel_type, transmission, price, deposit_amount, rating, image, vehicle_reg_no, status, description, features, specs, gallery, additional_images } = req.body;

    let galleryJson = null;
    if (Array.isArray(gallery) && gallery.length > 0) {
      galleryJson = JSON.stringify(gallery);
    } else if (Array.isArray(additional_images) && additional_images.length > 0) {
      const g = [image || "", ...additional_images.filter(img => img !== image)].filter(Boolean);
      galleryJson = JSON.stringify(g);
    }

    await pool.query(
      `UPDATE vehicles 
       SET name = COALESCE(?, name), 
           brand = COALESCE(?, brand), 
           model = COALESCE(?, model), 
           category = COALESCE(?, category), 
           year = COALESCE(?, year), 
           fuel_type = COALESCE(?, fuel_type), 
           transmission = COALESCE(?, transmission), 
           price = COALESCE(?, price), 
           deposit_amount = COALESCE(?, deposit_amount), 
           rating = COALESCE(?, rating), 
           image = COALESCE(?, image), 
           vehicle_reg_no = COALESCE(?, vehicle_reg_no), 
           status = COALESCE(?, status), 
           description = COALESCE(?, description), 
           features_json = COALESCE(?, features_json), 
           specs_json = COALESCE(?, specs_json), 
           gallery_json = COALESCE(?, gallery_json)
       WHERE id = ?`,
      [
        name || null, brand || null, model || null, category || null, year || null, fuel_type || null, transmission || null,
        price !== undefined ? Number(price) : null,
        deposit_amount !== undefined ? Number(deposit_amount) : null,
        rating !== undefined ? Number(rating) : null,
        image || null, vehicle_reg_no || null, status || null,
        description !== undefined ? description : null,
        features ? JSON.stringify(features) : null,
        specs ? JSON.stringify(specs) : null,
        galleryJson,
        id
      ]
    );

    const [updated] = await pool.query("SELECT * FROM vehicles WHERE id = ?", [id]);
    res.json({ message: "Vehicle updated successfully.", vehicle: updated[0] });
  } catch (error) {
    console.error("[Admin Update Vehicle Error]:", error);
    res.status(500).json({ error: "Failed to update vehicle record." });
  }
});

// DELETE /api/admin/vehicles/:id
app.delete("/api/admin/vehicles/:id", requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    // Check if vehicle has active rentals
    const [active] = await pool.query(
      "SELECT id FROM bookings WHERE vehicle_id = ? AND booking_status = 'Confirmed' AND actual_return IS NULL",
      [id]
    );
    if (active.length > 0) {
      return res.status(400).json({ error: "Cannot delete vehicle with active reservations. Please complete or cancel active bookings first." });
    }

    await pool.query("DELETE FROM vehicles WHERE id = ?", [id]);
    res.json({ message: "Vehicle deleted successfully." });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete vehicle." });
  }
});

// GET /api/admin/bookings - Searchable Bookings
app.get("/api/admin/bookings", requireAdmin, async (req, res) => {
  try {
    const { status, vehicle, search, date } = req.query;
    let query = `
      SELECT b.id, b.user_id, COALESCE(b.user_name, u.name, a.name, 'Customer') AS customer_name,
             COALESCE(b.customer_email, u.email, a.email, 'customer@ridezone.com') AS customer_email,
             COALESCE(u.phone, a.phone, '+91 98765 43210') AS customer_phone,
             b.vehicle_id, b.vehicle_name, b.vehicle_reg_no, b.pickup_date, b.pickup_time,
             b.hours, b.rental_price, b.deposit_amount, b.total_price, b.payment_method,
             b.payment_status, b.booking_status, b.cancellation_fee, b.refund_amount,
             b.cancelled_at, b.cancelled_by, b.cancellation_reason, b.cancellation_details,
             b.expected_return, b.actual_return, b.late_hours, b.late_charge,
             b.created_at
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN admins a ON b.user_id = a.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== "all") {
      query += " AND b.booking_status = ?";
      params.push(status);
    }
    if (vehicle && vehicle !== "all") {
      query += " AND b.vehicle_name = ?";
      params.push(vehicle);
    }
    if (date) {
      query += " AND b.pickup_date = ?";
      params.push(date);
    }
    if (search && String(search).trim()) {
      const s = `%${String(search).trim()}%`;
      query += " AND (b.id LIKE ? OR b.user_name LIKE ? OR u.name LIKE ? OR b.customer_email LIKE ? OR u.email LIKE ? OR b.vehicle_name LIKE ? OR b.vehicle_reg_no LIKE ?)";
      params.push(s, s, s, s, s, s, s);
    }

    query += " ORDER BY b.created_at DESC";
    const [rows] = await pool.query(query, params);

    // Compute authoritative global booking status counts
    const [[counts]] = await pool.query(`
      SELECT 
        COUNT(*) AS \`all\`,
        SUM(CASE WHEN booking_status = 'Pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN booking_status = 'Confirmed' THEN 1 ELSE 0 END) AS confirmed,
        SUM(CASE WHEN booking_status = 'Active' THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN booking_status = 'Completed' OR actual_return IS NOT NULL THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN booking_status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled
      FROM bookings
    `);

    res.json({
      bookings: rows,
      counts: {
        all: Number(counts.all || 0),
        pending: Number(counts.pending || 0),
        confirmed: Number(counts.confirmed || 0),
        active: Number(counts.active || 0),
        completed: Number(counts.completed || 0),
        cancelled: Number(counts.cancelled || 0)
      }
    });
  } catch (error) {
    console.error("[Admin Bookings Error]:", error);
    res.status(500).json({ error: "Failed to retrieve bookings list." });
  }
});

// GET /api/admin/bookings/:id
app.get("/api/admin/bookings/:id", requireAdmin, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const [rows] = await pool.query(
      `SELECT b.*, 
              COALESCE(b.user_name, u.name, a.name) AS customer_name,
              COALESCE(b.customer_email, u.email, a.email, 'customer@ridezone.com') AS customer_email,
              COALESCE(u.phone, a.phone, '+91 98765 43210') AS customer_phone
       FROM bookings b
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN admins a ON b.user_id = a.id
       WHERE b.id = ?`,
      [bookingId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "Booking record not found." });
    }

    res.json({ booking: rows[0] });
  } catch (error) {
    res.status(500).json({ error: "Failed to load booking details." });
  }
});

// POST or PATCH /api/admin/bookings/:id/accept - Administrator Accept & Confirm Pending Booking
app.all("/api/admin/bookings/:id/accept", requireAdmin, async (req, res) => {
  if (req.method !== "POST" && req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed. Use POST or PATCH." });
  }
  let connection = null;
  try {
    const bookingId = req.params.id;
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query("SELECT * FROM bookings WHERE id = ? FOR UPDATE", [bookingId]);
    if (!rows || rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Booking record not found." });
    }

    const booking = rows[0];
    if (booking.booking_status === "Confirmed") {
      await connection.rollback();
      return res.status(400).json({ error: "Booking is already confirmed." });
    }
    if (booking.booking_status === "Cancelled") {
      await connection.rollback();
      return res.status(400).json({ error: "Cannot accept a cancelled booking." });
    }
    if (booking.booking_status === "Completed") {
      await connection.rollback();
      return res.status(400).json({ error: "Cannot accept a completed booking." });
    }

    await connection.query(
      `UPDATE bookings SET booking_status = 'Confirmed' WHERE id = ?`,
      [bookingId]
    );

    const [updated] = await connection.query("SELECT * FROM bookings WHERE id = ?", [bookingId]);
    await connection.commit();

    return res.status(200).json({
      message: `Booking #${bookingId} accepted and confirmed successfully.`,
      booking: updated[0]
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("[Admin Accept Booking Error]:", error);
    return res.status(500).json({ error: "Failed to accept booking." });
  } finally {
    if (connection) connection.release();
  }
});

// POST or PATCH /api/admin/bookings/:id/activate - Administrator Vehicle Handover & Activation
app.all("/api/admin/bookings/:id/activate", requireAdmin, async (req, res) => {
  if (req.method !== "POST" && req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed. Use POST or PATCH." });
  }
  let connection = null;
  try {
    const bookingId = req.params.id;
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query("SELECT * FROM bookings WHERE id = ? FOR UPDATE", [bookingId]);
    if (!rows || rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Booking record not found." });
    }

    const booking = rows[0];
    if (booking.booking_status === "Active") {
      await connection.rollback();
      return res.status(400).json({ error: "Booking is already active." });
    }
    if (booking.booking_status === "Completed") {
      await connection.rollback();
      return res.status(400).json({ error: "Completed bookings cannot be activated." });
    }
    if (booking.booking_status === "Cancelled") {
      await connection.rollback();
      return res.status(400).json({ error: "Cancelled bookings cannot be activated." });
    }
    if (booking.booking_status !== "Confirmed") {
      await connection.rollback();
      return res.status(400).json({ error: `Cannot activate booking in '${booking.booking_status}' status. Only Confirmed bookings can be activated.` });
    }

    await connection.query(
      `UPDATE bookings SET booking_status = 'Active' WHERE id = ?`,
      [bookingId]
    );

    const [updated] = await connection.query("SELECT * FROM bookings WHERE id = ?", [bookingId]);
    await connection.commit();

    return res.status(200).json({
      message: `Booking #${bookingId} activated. Vehicle handed over to customer.`,
      booking: updated[0]
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("[Admin Activate Booking Error]:", error);
    return res.status(500).json({ error: "Failed to activate booking." });
  } finally {
    if (connection) connection.release();
  }
});

// POST or PATCH /api/admin/bookings/:id/cancel - Transactional Admin Cancellation
app.all("/api/admin/bookings/:id/cancel", requireAdmin, async (req, res) => {
  if (req.method !== "POST" && req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed. Use POST or PATCH." });
  }

  // Predefined allowed reasons
  const ALLOWED_REASONS = [
    "Vehicle unavailable",
    "Vehicle requires urgent maintenance",
    "Vehicle damaged / unsafe",
    "Vehicle already reserved",
    "Pickup/location unavailable",
    "Customer eligibility issue",
    "Payment/verification issue",
    "Administrative decision",
    "Other"
  ];

  const { cancellation_reason, cancellation_details } = req.body || {};
  const cleanReason = cancellation_reason ? String(cancellation_reason).trim() : "";

  if (!cleanReason) {
    return res.status(400).json({ error: "A cancellation reason is required before cancelling this booking." });
  }

  if (!ALLOWED_REASONS.includes(cleanReason)) {
    return res.status(400).json({ error: "Invalid cancellation reason selected. Please choose a valid predefined reason." });
  }

  const cleanDetails = cancellation_details ? String(cancellation_details).trim() : null;

  if (cleanReason === "Other") {
    if (!cleanDetails || cleanDetails.length < 3) {
      return res.status(400).json({ error: "Additional details are required when selecting 'Other' as the cancellation reason." });
    }
  }

  let connection = null;
  try {
    const bookingId = req.params.id;
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query("SELECT * FROM bookings WHERE id = ? FOR UPDATE", [bookingId]);
    if (!rows || rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Booking record not found." });
    }

    const booking = rows[0];
    if (booking.booking_status === "Cancelled") {
      await connection.rollback();
      return res.status(400).json({ error: "Booking is already cancelled." });
    }
    if (booking.booking_status === "Completed" || booking.actual_return) {
      await connection.rollback();
      return res.status(400).json({ error: "Completed bookings cannot be cancelled." });
    }

    const refundAmount = Number(booking.total_price);
    await connection.query(
      `UPDATE bookings 
       SET booking_status = 'Cancelled',
           cancellation_fee = 0,
           refund_amount = ?,
           cancelled_at = NOW(),
           cancelled_by = 'RideZone Admin',
           cancellation_reason = ?,
           cancellation_details = ? 
       WHERE id = ?`,
      [refundAmount, cleanReason, cleanDetails, bookingId]
    );

    const [updated] = await connection.query("SELECT * FROM bookings WHERE id = ?", [bookingId]);
    await connection.commit();
    res.json({
      message: "Booking cancelled by administrator. 100% full refund registered.",
      refundAmount,
      refund_amount: refundAmount,
      cancelled_by: "RideZone Admin",
      cancellation_reason: cleanReason,
      cancellation_details: cleanDetails,
      booking: updated[0]
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("[Admin Cancellation Error]:", error);
    res.status(500).json({ error: "Failed to process admin cancellation." });
  } finally {
    if (connection) connection.release();
  }
});

// POST or PATCH /api/admin/bookings/:id/return - Transactional Vehicle Return & Overdue Calculation
app.all("/api/admin/bookings/:id/return", requireAdmin, async (req, res) => {
  if (req.method !== "POST" && req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed. Use POST or PATCH." });
  }
  let connection = null;
  try {
    const bookingId = req.params.id;
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT b.*, v.price as hourly_price FROM bookings b LEFT JOIN vehicles v ON b.vehicle_name = v.name WHERE b.id = ? FOR UPDATE",
      [bookingId]
    );

    if (!rows || rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Booking not found." });
    }

    const booking = rows[0];
    if (booking.booking_status === "Completed" || booking.actual_return) {
      await connection.rollback();
      return res.status(400).json({ error: "This booking has already been returned and marked Completed." });
    }
    if (booking.booking_status === "Cancelled") {
      await connection.rollback();
      return res.status(400).json({ error: "Cannot return a cancelled booking." });
    }

    const pickupDateTime = new Date(`${booking.pickup_date.toISOString().split("T")[0]}T${booking.pickup_time}`);
    const scheduledEnd = new Date(pickupDateTime.getTime() + booking.hours * 3600 * 1000);
    const actualEnd = new Date();

    let lateHours = 0;
    let lateCharge = 0;

    if (actualEnd > scheduledEnd) {
      const diffMs = actualEnd.getTime() - scheduledEnd.getTime();
      lateHours = Math.ceil(diffMs / (3600 * 1000));
      const hourlyRate = Number(booking.hourly_price) || (Number(booking.rental_price) / booking.hours) || 250;
      lateCharge = lateHours * hourlyRate;
    }

    await connection.query(
      `UPDATE bookings 
       SET actual_return = NOW(),
           late_hours = ?,
           late_charge = ?,
           booking_status = 'Completed'
       WHERE id = ?`,
      [lateHours, lateCharge, bookingId]
    );

    await connection.commit();

    res.json({
      message: "Vehicle return processed successfully.",
      lateHours,
      lateCharge,
      depositStatus: "Security deposit released back to customer."
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("[Return Vehicle Error]:", error);
    res.status(500).json({ error: "Failed to process vehicle return." });
  } finally {
    if (connection) connection.release();
  }
});

// GET /api/admin/users - Customer Accounts & Lifetime Analytics
app.get("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.name, u.email, u.phone, COALESCE(u.status, 'Active') AS status, u.profile_photo, u.created_at,
             COALESCE(b_agg.total_bookings, 0) AS total_bookings,
             COALESCE(b_agg.active_rentals, 0) AS active_rentals,
             COALESCE(b_agg.upcoming_bookings, 0) AS upcoming_bookings,
             COALESCE(b_agg.completed_bookings, 0) AS completed_bookings,
             COALESCE(b_agg.cancelled_bookings, 0) AS cancelled_bookings,
             COALESCE(b_agg.total_spent, 0) AS total_spent
      FROM users u
      LEFT JOIN (
        SELECT user_id,
               COUNT(id) AS total_bookings,
               SUM(CASE WHEN booking_status = 'Confirmed' AND actual_return IS NULL AND NOW() >= TIMESTAMP(pickup_date, pickup_time) AND NOW() <= DATE_ADD(TIMESTAMP(pickup_date, pickup_time), INTERVAL hours HOUR) THEN 1 ELSE 0 END) AS active_rentals,
               SUM(CASE WHEN booking_status = 'Confirmed' AND TIMESTAMP(pickup_date, pickup_time) > NOW() THEN 1 ELSE 0 END) AS upcoming_bookings,
               SUM(CASE WHEN booking_status = 'Completed' OR actual_return IS NOT NULL THEN 1 ELSE 0 END) AS completed_bookings,
               SUM(CASE WHEN booking_status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled_bookings,
               SUM(CASE WHEN booking_status != 'Cancelled' THEN total_price ELSE 0 END) AS total_spent
        FROM bookings
        GROUP BY user_id
      ) b_agg ON u.id = b_agg.user_id
      ORDER BY u.id DESC
    `);
    res.json({ users: rows });
  } catch (error) {
    console.error("[Admin Users Error]:", error);
    res.status(500).json({ error: "Failed to retrieve customer accounts." });
  }
});

// GET /api/admin/users/:id
app.get("/api/admin/users/:id", requireAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const [userRows] = await pool.query("SELECT id, name, email, phone, COALESCE(status, 'Active') AS status, profile_photo, created_at FROM users WHERE id = ?", [userId]);
    if (!userRows || userRows.length === 0) {
      return res.status(404).json({ error: "Customer not found." });
    }

    const [bookings] = await pool.query(
      "SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    res.json({
      user: userRows[0],
      bookings,
      summary: {
        totalBookings: bookings.length,
        active: bookings.filter(b => b.booking_status === "Confirmed" && !b.actual_return).length,
        completed: bookings.filter(b => b.booking_status === "Completed" || b.actual_return).length,
        cancelled: bookings.filter(b => b.booking_status === "Cancelled").length,
        totalSpent: bookings.filter(b => b.booking_status !== "Cancelled").reduce((sum, b) => sum + Number(b.total_price), 0)
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to load customer profile." });
  }
});

// PATCH /api/admin/users/:id/status - Toggle Customer Status (Active / Suspended)
app.patch("/api/admin/users/:id/status", requireAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { status } = req.body;
    if (!status || !["Active", "Suspended"].includes(status)) {
      return res.status(400).json({ error: "Valid status ('Active' or 'Suspended') is required." });
    }

    const [existing] = await pool.query("SELECT id, name, email, status FROM users WHERE id = ?", [userId]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: "Customer account not found." });
    }

    await pool.query("UPDATE users SET status = ? WHERE id = ?", [status, userId]);
    return res.json({ message: `Customer account status updated to ${status}.`, userId, status });
  } catch (error) {
    console.error("[Admin Update User Status Error]:", error);
    return res.status(500).json({ error: "Failed to update customer status." });
  }
});


// GET /api/admin/payments - Accounting Ledger
app.get("/api/admin/payments", requireAdmin, async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = `
      SELECT b.id, b.user_id, 
             COALESCE(b.user_name, u.name, a.name, 'Customer') AS customer_name,
             COALESCE(b.customer_email, u.email, a.email, 'customer@ridezone.com') AS customer_email,
             COALESCE(u.phone, a.phone, '+91 98765 43210') AS customer_phone,
             b.vehicle_id, b.vehicle_name, b.vehicle_reg_no,
             COALESCE(v.brand, 'RideZone') AS vehicle_brand,
             COALESCE(v.model, b.vehicle_name) AS vehicle_model,
             b.pickup_date, b.pickup_time, b.hours, b.expected_return, b.actual_return,
             b.rental_price, b.deposit_amount, b.total_price,
             b.payment_method, b.payment_status, b.booking_status, 
             b.cancellation_fee, b.refund_amount, b.cancelled_at, b.cancelled_by,
             b.late_hours, b.late_charge,
             b.created_at
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN admins a ON b.user_id = a.id
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
      WHERE 1=1
    `;
    const params = [];

    if (search && String(search).trim()) {
      const cleanSearch = String(search).trim().replace(/^TXN-/, "");
      const s = `%${String(search).trim()}%`;
      const sClean = `%${cleanSearch}%`;
      query += " AND (b.id LIKE ? OR b.id LIKE ? OR b.user_name LIKE ? OR u.name LIKE ? OR b.customer_email LIKE ? OR u.email LIKE ? OR b.vehicle_name LIKE ? OR b.vehicle_reg_no LIKE ?)";
      params.push(s, sClean, s, s, s, s, s, s);
    }

    if (status && status !== "all") {
      if (status === "Refunded") {
        query += " AND (b.booking_status = 'Cancelled' OR b.refund_amount > 0)";
      } else if (status === "Paid") {
        query += " AND b.booking_status != 'Cancelled' AND (b.payment_status = 'Paid' OR b.payment_status IS NULL)";
      } else if (status === "Pending") {
        query += " AND (b.booking_status = 'Pending' OR b.payment_status = 'Pending')";
      }
    }

    query += " ORDER BY b.created_at DESC";
    const [rows] = await pool.query(query, params);

    const [[{ gross }]] = await pool.query("SELECT COALESCE(SUM(total_price), 0) as gross FROM bookings WHERE booking_status != 'Cancelled'");
    const [[{ net_rental }]] = await pool.query("SELECT COALESCE(SUM(rental_price), 0) as net_rental FROM bookings WHERE booking_status != 'Cancelled'");
    const [[{ deposits_held }]] = await pool.query("SELECT COALESCE(SUM(deposit_amount), 0) as deposits_held FROM bookings WHERE booking_status = 'Confirmed' AND actual_return IS NULL");
    const [[{ total_refunds }]] = await pool.query("SELECT COALESCE(SUM(refund_amount), 0) as total_refunds FROM bookings WHERE booking_status = 'Cancelled' OR refund_amount > 0");

    const grossNum = Number(gross);
    const netRentalNum = Number(net_rental);
    const depositsHeldNum = Number(deposits_held);
    const refundsNum = Number(total_refunds);

    res.json({
      summary: {
        gross_volume: grossNum,
        net_rental: netRentalNum,
        total_deposits_held: depositsHeldNum,
        total_refunds: refundsNum,
        grossRevenue: grossNum,
        netRentalRevenue: netRentalNum,
        depositsHeld: depositsHeldNum,
        totalRefunds: refundsNum,
        totalTransactions: rows.length
      },
      transactions: rows.map(r => ({
        ...r,
        transaction_id: `TXN-${String(r.id).replace(/^RZ-/, "")}`,
        booking_id: r.id,
        rental_price: Number(r.rental_price),
        deposit_amount: Number(r.deposit_amount),
        total_price: Number(r.total_price),
        refund_amount: Number(r.refund_amount || 0),
        display_status: r.booking_status === "Cancelled" ? "Refunded" : (r.payment_status || "Paid")
      }))
    });
  } catch (error) {
    console.error("[Admin Payments Error]:", error);
    res.status(500).json({ error: "Failed to load financial records." });
  }
});

// GET /api/admin/availability
app.get("/api/admin/availability", requireAdmin, async (req, res) => {
  try {
    const { vehicle } = req.query;
    let query = `
      SELECT b.id, b.vehicle_name, b.vehicle_reg_no, 
             COALESCE(b.user_name, u.name, a.name) as customer_name,
             COALESCE(b.customer_email, u.email, a.email, 'customer@ridezone.com') as customer_email,
             COALESCE(u.phone, a.phone, '+91 98765 43210') as customer_phone,
             b.pickup_date, b.pickup_time, b.hours, b.booking_status, b.expected_return, b.actual_return
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN admins a ON b.user_id = a.id
      WHERE b.booking_status != 'Cancelled'
    `;
    const params = [];
    if (vehicle && vehicle !== "all") {
      query += " AND b.vehicle_name = ?";
      params.push(vehicle);
    }
    query += " ORDER BY b.pickup_date ASC, b.pickup_time ASC";
    const [rows] = await pool.query(query, params);
    res.json({ bookings: rows });
  } catch (error) {
    res.status(500).json({ error: "Failed to load availability calendar." });
  }
});

// ------------------------------------------------------------
// 13. BOOTSTRAP & START SERVER
// ------------------------------------------------------------
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log("==================================================");
    console.log(`  RideZone Hardened Server running on http://localhost:${PORT}`);
    console.log("==================================================");
  });
}).catch((err) => {
  console.error("[Fatal Startup Error]:", err);
  process.exit(1);
});
