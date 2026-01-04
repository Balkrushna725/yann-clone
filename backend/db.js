const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Test the database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error connecting to the database:', err);
  } else {
    console.log('Successfully connected to the database at', res.rows[0].now);
  }
});

// Get a client from the pool for transactions
const getClient = async () => {
  const client = await pool.connect();
  
  // Monkey-patch the query method to include the query statement in the error message
  const query = client.query;
  const release = client.release;
  
  // Set a timeout of 5 seconds
  const timeout = setTimeout(() => {
    console.error('A client has been checked out for more than 5 seconds!');
    console.error(`The last executed query on this client was: ${client.lastQuery}`);
  }, 5000);

  // Set the last query and its parameters
  client.query = (...args) => {
    client.lastQuery = args;
    return query.apply(client, args);
  };

  // Return the client to the pool
  client.release = () => {
    clearTimeout(timeout);
    
    // Reset the client.query method
    client.query = query;
    
    // Call the original release method
    return release.apply(client);
  };
  
  return client;
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient,
  pool, // Export pool for direct access if needed
};