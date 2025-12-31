const { Client } = require('pg');

const client = new Client({
  user: 'postgres',
  password: 'Mayu@1702',
  host: 'localhost',
  port: 5432,
  database: 'postgres' // connect to default database
});

(async () => {
  try {
    await client.connect();
    await client.query('CREATE DATABASE yaan_db;');
    console.log('Database yaan_db created successfully');
  } catch (err) {
    console.error('Error creating database:', err);
  } finally {
    await client.end();
  }
})();
