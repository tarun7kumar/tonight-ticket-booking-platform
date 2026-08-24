const dotenv = require('dotenv');
const path = require('path');

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const env = {
  PORT: parseInt(process.env.PORT, 10) || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  DEFAULT_HOLD_TTL_MINUTES: parseInt(process.env.DEFAULT_HOLD_TTL_MINUTES, 10) || 10,
  WAITLIST_OFFER_TTL_MINUTES: parseInt(process.env.WAITLIST_OFFER_TTL_MINUTES, 10) || 15,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  FROM_EMAIL: process.env.FROM_EMAIL || 'onboarding@resend.dev',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  SCHEDULER_INTERVAL_SECONDS: parseInt(process.env.SCHEDULER_INTERVAL_SECONDS, 10) || 30,
};

// Validate required env vars
const required = ['DATABASE_URL', 'JWT_SECRET'];
for (const key of required) {
  if (!env[key]) {
    console.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

module.exports = env;
