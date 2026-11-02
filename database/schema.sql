-- ============================================================
-- RideZone Database Schema Reference (Hardened Production Schema)
-- ============================================================

CREATE DATABASE IF NOT EXISTS ridezone;
USE ridezone;

-- Migration Tracker
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 1. Users Table (RideZone Customers)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'Active',
    profile_photo LONGTEXT,
    password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Admins Table (RideZone Administrators)
CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20) DEFAULT '+91 98765 43210',
    location VARCHAR(100) DEFAULT 'Hyderabad, Telangana, India',
    role_title VARCHAR(100) DEFAULT 'Super Admin',
    profile_photo LONGTEXT,
    password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. Vehicles Table
CREATE TABLE IF NOT EXISTS vehicles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    brand VARCHAR(100),
    model VARCHAR(100),
    category VARCHAR(50) NOT NULL,
    year INT DEFAULT 2024,
    fuel_type VARCHAR(50) DEFAULT 'Petrol',
    transmission VARCHAR(100) DEFAULT 'Manual',
    price DECIMAL(10, 2) NOT NULL,
    deposit_amount INT NOT NULL DEFAULT 1000,
    rating DECIMAL(2, 1) NOT NULL DEFAULT 4.8,
    image VARCHAR(255) NOT NULL,
    vehicle_reg_no VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    description TEXT,
    features_json TEXT,
    specs_json TEXT,
    gallery_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 4. Bookings Table (Transactional Ledger)
CREATE TABLE IF NOT EXISTS bookings (
    id VARCHAR(36) PRIMARY KEY,
    user_id INT,
    user_name VARCHAR(100),
    customer_email VARCHAR(255),
    vehicle_id INT,
    vehicle_name VARCHAR(100) NOT NULL,
    vehicle_reg_no VARCHAR(20) DEFAULT 'TS 09 RZ 1001',
    pickup_date DATE NOT NULL,
    pickup_time TIME NOT NULL,
    hours INT NOT NULL,
    rental_price INT NOT NULL DEFAULT 0,
    deposit_amount INT NOT NULL DEFAULT 1000,
    total_price INT NOT NULL,
    payment_method VARCHAR(30) DEFAULT 'UPI',
    payment_status VARCHAR(20) DEFAULT 'Paid',
    booking_status VARCHAR(20) DEFAULT 'Confirmed',
    cancellation_fee INT NOT NULL DEFAULT 0,
    refund_amount INT NOT NULL DEFAULT 0,
    cancelled_at TIMESTAMP NULL,
    cancelled_by VARCHAR(50) DEFAULT NULL,
    cancellation_reason VARCHAR(100) DEFAULT NULL,
    cancellation_details TEXT DEFAULT NULL,
    expected_return TIMESTAMP NULL,
    actual_return TIMESTAMP NULL,
    late_hours INT NOT NULL DEFAULT 0,
    late_charge INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
);

-- 5. Password Resets Table
CREATE TABLE IF NOT EXISTS password_resets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(100) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
