const bcrypt = require('bcryptjs');
const { pool, getClient } = require('../config/db');

async function seed() {
  console.log('🌱 Seeding Clean Database (3 User Accounts only)...');
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // 1. Truncate / Clear all old test data
    console.log('🧹 Clearing all previous test data, bookings, events, venues...');
    await client.query(`
      TRUNCATE TABLE 
        waitlist,
        booking_seats,
        bookings,
        show_seats,
        event_pricing,
        events,
        venue_seats,
        seat_categories,
        venues,
        users
      RESTART IDENTITY CASCADE
    `);

    // 2. Generate password hashes
    const adminHash = await bcrypt.hash('admin123', 10);
    const orgHash = await bcrypt.hash('organiser123', 10);
    const custHash = await bcrypt.hash('customer123', 10);

    // 3. Insert exactly 3 accounts
    await client.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES 
        ('Admin User', 'admin@ticketbooking.com', $1, 'admin'),
        ('Event Organiser', 'organiser@tonight.com', $2, 'organiser'),
        ('Test Customer', 'customer@tonight.com', $3, 'customer')`,
      [adminHash, orgHash, custHash]
    );

    await client.query('COMMIT');

    console.log(`
╔═════════════════════════════════════════════════════════════╗
║          ✅ CLEAN DATABASE INITIALIZED (3 USERS)            ║
╠═════════════════════════════════════════════════════════════╣
║  1. Admin:      admin@ticketbooking.com / admin123          ║
║  2. Organiser:  organiser@tonight.com   / organiser123      ║
║  3. Customer:   customer@tonight.com    / customer123       ║
╚═════════════════════════════════════════════════════════════╝
    `);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
