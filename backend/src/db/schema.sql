-- ============================================
-- Ticket Booking System — Database Schema
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. ENUM TYPES
-- ============================================

CREATE TYPE user_role AS ENUM ('admin', 'organiser', 'customer');
CREATE TYPE event_type AS ENUM ('movie', 'concert');
CREATE TYPE event_status AS ENUM ('upcoming', 'ongoing', 'completed', 'cancelled');
CREATE TYPE seat_status AS ENUM ('available', 'held', 'booked');
CREATE TYPE booking_status AS ENUM ('confirmed', 'cancelled');
CREATE TYPE waitlist_status AS ENUM ('waiting', 'offered', 'fulfilled', 'expired');

-- ============================================
-- 2. USERS
-- ============================================

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'customer',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================
-- 3. VENUES
-- ============================================

CREATE TABLE venues (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  address TEXT,
  total_rows INT NOT NULL DEFAULT 0,
  total_columns INT NOT NULL DEFAULT 0,
  created_by INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. SEAT CATEGORIES
-- ============================================

CREATE TABLE seat_categories (
  id SERIAL PRIMARY KEY,
  venue_id INT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#4A90D9',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(venue_id, name)
);

-- ============================================
-- 5. VENUE SEATS (physical layout)
-- ============================================

CREATE TABLE venue_seats (
  id SERIAL PRIMARY KEY,
  venue_id INT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  category_id INT NOT NULL REFERENCES seat_categories(id) ON DELETE RESTRICT,
  row_label VARCHAR(5) NOT NULL,
  seat_number INT NOT NULL,
  x_pos INT NOT NULL DEFAULT 0,
  y_pos INT NOT NULL DEFAULT 0,
  is_aisle BOOLEAN DEFAULT FALSE,
  UNIQUE(venue_id, row_label, seat_number)
);

CREATE INDEX idx_venue_seats_venue ON venue_seats(venue_id);

-- ============================================
-- 6. EVENTS
-- ============================================

CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  organiser_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  venue_id INT NOT NULL REFERENCES venues(id) ON DELETE RESTRICT,
  title VARCHAR(300) NOT NULL,
  type event_type NOT NULL,
  description TEXT,
  poster_url TEXT,
  event_date DATE NOT NULL,
  event_time TIME NOT NULL,
  status event_status NOT NULL DEFAULT 'upcoming',
  hold_ttl_minutes INT NOT NULL DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_events_organiser ON events(organiser_id);
CREATE INDEX idx_events_venue ON events(venue_id);
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_events_status ON events(status);

-- ============================================
-- 7. EVENT PRICING (per category per event)
-- ============================================

CREATE TABLE event_pricing (
  id SERIAL PRIMARY KEY,
  event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category_id INT NOT NULL REFERENCES seat_categories(id) ON DELETE RESTRICT,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  UNIQUE(event_id, category_id)
);

-- ============================================
-- 8. SHOW SEATS (per-show seat status — core concurrency table)
-- ============================================

CREATE TABLE show_seats (
  id SERIAL PRIMARY KEY,
  event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  venue_seat_id INT NOT NULL REFERENCES venue_seats(id) ON DELETE CASCADE,
  status seat_status NOT NULL DEFAULT 'available',
  held_by INT REFERENCES users(id) ON DELETE SET NULL,
  held_at TIMESTAMP WITH TIME ZONE,
  booked_by INT REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(event_id, venue_seat_id)
);

CREATE INDEX idx_show_seats_event ON show_seats(event_id);
CREATE INDEX idx_show_seats_status ON show_seats(status);
CREATE INDEX idx_show_seats_held ON show_seats(status, held_at) WHERE status = 'held';
CREATE INDEX idx_show_seats_held_by ON show_seats(held_by) WHERE held_by IS NOT NULL;

-- ============================================
-- 9. BOOKINGS
-- ============================================

CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  event_id INT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  booking_ref VARCHAR(20) NOT NULL UNIQUE,
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  status booking_status NOT NULL DEFAULT 'confirmed',
  qr_code_data TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cancelled_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_event ON bookings(event_id);
CREATE INDEX idx_bookings_ref ON bookings(booking_ref);
CREATE INDEX idx_bookings_status ON bookings(status);

-- ============================================
-- 10. BOOKING SEATS (junction)
-- ============================================

CREATE TABLE booking_seats (
  id SERIAL PRIMARY KEY,
  booking_id INT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  show_seat_id INT NOT NULL REFERENCES show_seats(id) ON DELETE RESTRICT,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  UNIQUE(booking_id, show_seat_id)
);

CREATE INDEX idx_booking_seats_booking ON booking_seats(booking_id);

-- ============================================
-- 11. WAITLIST
-- ============================================

CREATE TABLE waitlist (
  id SERIAL PRIMARY KEY,
  event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category_id INT NOT NULL REFERENCES seat_categories(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status waitlist_status NOT NULL DEFAULT 'waiting',
  offer_token VARCHAR(100),
  offered_at TIMESTAMP WITH TIME ZONE,
  offer_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- A user can only be on the waitlist once per event+category
  UNIQUE(event_id, category_id, user_id)
);

CREATE INDEX idx_waitlist_event_category ON waitlist(event_id, category_id);
CREATE INDEX idx_waitlist_status ON waitlist(status);
CREATE INDEX idx_waitlist_token ON waitlist(offer_token) WHERE offer_token IS NOT NULL;
CREATE INDEX idx_waitlist_offered ON waitlist(status, offer_expires_at) WHERE status = 'offered';

-- ============================================
-- SEED: Default admin user
-- Password: admin123 (bcrypt hash)
-- ============================================

INSERT INTO users (name, email, password_hash, role)
VALUES (
  'System Admin',
  'admin@ticketbooking.com',
  '$2a$10$8K1p/NjCzV0bGpCv8VyKqOQhZX7N7J3bFyj0g5eIbmNv3MhQKzxKi',
  'admin'
) ON CONFLICT (email) DO NOTHING;
