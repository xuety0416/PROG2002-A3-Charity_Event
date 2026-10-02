/**
 * event_db.js
 * ---------------------------------------------------------------------------
 * PROG2002 Web Development II - Assessment 3
 *
 * Database access layer for the Charity Event website.
 *
 * A3 schema changes reflected here (Part 1 "Backend update"):
 *   - charity_events now stores latitude / longitude (used by the optional
 *     Open-Meteo weather API).
 *   - a new event_registrations table records every ticket purchase and is
 *     linked to charity_events through the event_id foreign key.
 *
 * The module exports a single mysql2 connection pool so every API request can
 * reuse connections instead of opening a new one. Connection settings can be
 * overridden with environment variables, which is required when the app is
 * deployed to the SCU cPanel server (where the database name / user / password
 * are different from the local development machine).
 * ---------------------------------------------------------------------------
 */
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'charityevents_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  // Make DECIMAL/NUMERIC values come back as numbers so the front-end can do
  // arithmetic (e.g. progress percentage) without extra parsing.
  decimalNumbers: true,
  dateStrings: false
});

/**
 * Small helper used by server.js on start-up to fail fast when the database
 * configuration is wrong instead of throwing an error on the first request.
 * @returns {Promise<boolean>} true when the database is reachable.
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log('Database connection pool is ready.');
    return true;
  } catch (err) {
    console.error('Unable to connect to the database:', err.message);
    return false;
  }
}

module.exports = pool;
module.exports.testConnection = testConnection;
