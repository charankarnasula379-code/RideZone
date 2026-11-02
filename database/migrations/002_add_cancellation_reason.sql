-- ============================================================
-- Migration 002: Add cancellation reason and details to bookings
-- ============================================================

ALTER TABLE bookings ADD COLUMN cancellation_reason VARCHAR(100) DEFAULT NULL;
ALTER TABLE bookings ADD COLUMN cancellation_details TEXT DEFAULT NULL;
