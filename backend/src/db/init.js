const fs = require('fs');
const path = require('path');
const { Pool, Client } = require('pg');
const env = require('../config/env');

/**
 * Initialize the database by creating it if missing and running schema.sql
 */
const initDB = async () => {
  let adminClient = null;
  let targetPool = null;

  try {
    const url = new URL(env.DATABASE_URL);
    const dbName = url.pathname.replace(/^\//, '') || 'ticket_booking';
    
    // Connect to default 'postgres' database first to ensure target db exists
    url.pathname = '/postgres';
    adminClient = new Client({ connectionString: url.toString() });
    
    console.log(`🔍 Checking if database "${dbName}" exists...`);
    await adminClient.connect();
    const checkDb = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );

    if (checkDb.rowCount === 0) {
      console.log(`⚡ Database "${dbName}" not found. Creating it now...`);
      await adminClient.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✅ Database "${dbName}" created successfully!`);
    } else {
      console.log(`ℹ️ Database "${dbName}" already exists.`);
    }
    await adminClient.end();
    adminClient = null;

    // Connect to the target database and execute schema.sql
    targetPool = new Pool({ connectionString: env.DATABASE_URL });
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    console.log('🔧 Running schema migrations...');
    await targetPool.query(schema);
    console.log('✅ Database schema created successfully!');
    console.log('👤 Default admin: admin@ticketbooking.com / admin123');
  } catch (err) {
    console.error('❌ Database initialization failed:', err.message);
    throw err;
  } finally {
    if (adminClient) {
      try { await adminClient.end(); } catch {}
    }
    if (targetPool) {
      try { await targetPool.end(); } catch {}
    }
  }
};

initDB()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

