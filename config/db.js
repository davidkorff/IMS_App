const { Pool } = require('pg');

const pool = process.env.DATABASE_URL 
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // Required for Render's PostgreSQL
      }
    })
  : new Pool({
      user: 'postgres',
      password: 'D040294k',
      host: 'localhost',
      port: 5432,
      database: 'IMS_Application'
    });

module.exports = pool; 