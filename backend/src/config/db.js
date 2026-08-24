const { Pool } = require('pg');
const { newDb } = require('pg-mem');
const bcrypt = require('bcryptjs');
const env = require('./env');

let activePool = null;
let isInMemory = false;
let memDbInstance = null;

// Initialize real PostgreSQL pool
const realPool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
});

async function initInMemoryDB() {
  console.log('⚡ Initializing in-memory PostgreSQL engine (pg-mem)...');
  memDbInstance = newDb({ autoCreateForeignKeyIndices: true });

  memDbInstance.public.registerFunction({
    name: 'version',
    implementation: () => 'PostgreSQL 15.0 (pg-mem)',
  });

  const pgAdapter = memDbInstance.adapters.createPg();
  const memPool = new pgAdapter.Pool();

  const schema = `
    CREATE TYPE user_role AS ENUM ('admin', 'organiser', 'customer');
    CREATE TYPE event_type AS ENUM ('movie', 'concert');
    CREATE TYPE event_status AS ENUM ('upcoming', 'ongoing', 'completed', 'cancelled');
    CREATE TYPE seat_status AS ENUM ('available', 'held', 'booked');
    CREATE TYPE booking_status AS ENUM ('confirmed', 'cancelled');
    CREATE TYPE waitlist_status AS ENUM ('waiting', 'offered', 'fulfilled', 'expired');

    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role user_role NOT NULL DEFAULT 'customer',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE venues (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      address TEXT,
      total_rows INT NOT NULL DEFAULT 0,
      total_columns INT NOT NULL DEFAULT 0,
      created_by INT NOT NULL REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE seat_categories (
      id SERIAL PRIMARY KEY,
      venue_id INT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
      name VARCHAR(50) NOT NULL,
      color VARCHAR(7) NOT NULL DEFAULT '#4f46e5',
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(venue_id, name)
    );

    CREATE TABLE venue_seats (
      id SERIAL PRIMARY KEY,
      venue_id INT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
      category_id INT NOT NULL REFERENCES seat_categories(id),
      row_label VARCHAR(5) NOT NULL,
      seat_number INT NOT NULL,
      x_pos INT NOT NULL DEFAULT 0,
      y_pos INT NOT NULL DEFAULT 0,
      is_aisle BOOLEAN DEFAULT FALSE,
      UNIQUE(venue_id, row_label, seat_number)
    );

    CREATE TABLE events (
      id SERIAL PRIMARY KEY,
      organiser_id INT NOT NULL REFERENCES users(id),
      venue_id INT NOT NULL REFERENCES venues(id),
      title VARCHAR(300) NOT NULL,
      type event_type NOT NULL,
      description TEXT,
      poster_url TEXT,
      event_date DATE NOT NULL,
      event_time TIME NOT NULL,
      status event_status NOT NULL DEFAULT 'upcoming',
      hold_ttl_minutes INT NOT NULL DEFAULT 10,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE event_pricing (
      id SERIAL PRIMARY KEY,
      event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      category_id INT NOT NULL REFERENCES seat_categories(id),
      price NUMERIC NOT NULL DEFAULT 0,
      UNIQUE(event_id, category_id)
    );

    CREATE TABLE show_seats (
      id SERIAL PRIMARY KEY,
      event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      venue_seat_id INT NOT NULL REFERENCES venue_seats(id) ON DELETE CASCADE,
      status seat_status NOT NULL DEFAULT 'available',
      held_by INT REFERENCES users(id),
      held_at TIMESTAMP,
      booked_by INT REFERENCES users(id),
      UNIQUE(event_id, venue_seat_id)
    );

    CREATE TABLE bookings (
      id SERIAL PRIMARY KEY,
      event_id INT NOT NULL REFERENCES events(id),
      user_id INT NOT NULL REFERENCES users(id),
      booking_ref VARCHAR(20) NOT NULL UNIQUE,
      total_amount NUMERIC NOT NULL DEFAULT 0,
      status booking_status NOT NULL DEFAULT 'confirmed',
      qr_code_data TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      cancelled_at TIMESTAMP
    );

    CREATE TABLE booking_seats (
      id SERIAL PRIMARY KEY,
      booking_id INT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      show_seat_id INT NOT NULL REFERENCES show_seats(id),
      price NUMERIC NOT NULL DEFAULT 0,
      UNIQUE(booking_id, show_seat_id)
    );

    CREATE TABLE waitlist (
      id SERIAL PRIMARY KEY,
      event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      category_id INT NOT NULL REFERENCES seat_categories(id) ON DELETE CASCADE,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status waitlist_status NOT NULL DEFAULT 'waiting',
      offer_token VARCHAR(100),
      offered_at TIMESTAMP,
      offer_expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(event_id, category_id, user_id)
    );
  `;

  await memPool.query(schema);

  // Seed default 3 user accounts only
  const adminHash = await bcrypt.hash('admin123', 10);
  const orgHash = await bcrypt.hash('organiser123', 10);
  const custHash = await bcrypt.hash('customer123', 10);

  await memPool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES 
     ('Admin User', 'admin@ticketbooking.com', $1, 'admin'),
     ('Event Organiser', 'organiser@tonight.com', $2, 'organiser'),
     ('Test Customer', 'customer@tonight.com', $3, 'customer')`,
    [adminHash, orgHash, custHash]
  );

  console.log('✅ In-memory database initialized with 3 clean accounts!');
  console.log('👤 Ready Accounts:');
  console.log('   - Admin:      admin@ticketbooking.com / admin123');
  console.log('   - Organiser:  organiser@tonight.com   / organiser123');
  console.log('   - Customer:   customer@tonight.com    / customer123');

  activePool = memPool;
  isInMemory = true;
  return memPool;
}

// Check database connection and fallback if unavailable
async function getActivePool() {
  if (activePool) return activePool;

  try {
    const client = await realPool.connect();
    client.release();
    console.log('📦 Connected to PostgreSQL database server.');
    activePool = realPool;
    return activePool;
  } catch (err) {
    console.log(`⚠️ PostgreSQL server connection failed (${err.code || err.message}).`);
    return await initInMemoryDB();
  }
}

/**
 * Execute a query with optional parameters
 */
const query = async (text, params) => {
  const pool = await getActivePool();
  return await pool.query(text, params);
};

/**
 * Get a client from the pool for transactions
 */
const getClient = async () => {
  const pool = await getActivePool();
  const client = await pool.connect();
  return client;
};

module.exports = {
  pool: realPool,
  query,
  getClient,
  getActivePool,
};
