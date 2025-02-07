const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    password: 'D040294k',
    host: 'localhost',
    port: 5432,
    database: 'IMS_Application'
});

module.exports = pool; 