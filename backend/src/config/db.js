const { Pool } = require('pg');
const dotenv = require('dotenv');

if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

pool.on('connect', () => {
  console.log('✅ PostgreSQL connected');
});

pool.on('error', (err) => {
  console.error('PostgreSQL connection error:', err.message);
});

const getClient = async () => {
  const client = await pool.connect();

  const query = client.query;
  const release = client.release;

  const timeout = setTimeout(() => {
    console.error('A client has been checked out for more than 5 seconds!');
    if (client.lastQuery) {
      console.error(`Last query: ${client.lastQuery}`);
    }
  }, 5000);

  client.query = (...args) => {
    client.lastQuery = args;
    return query.apply(client, args);
  };

  client.release = () => {
    clearTimeout(timeout);
    client.query = query;
    return release.apply(client);
  };

  return client;
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient,
  pool,
};
