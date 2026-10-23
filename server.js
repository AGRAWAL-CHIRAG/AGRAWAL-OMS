const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// PostgreSQL Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Initialize Database Tables
async function initDB() {
  try {
    const client = await pool.connect();
    
    // Customers Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        payment_type VARCHAR(50) DEFAULT 'Cash',
        balance NUMERIC(10, 2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Invoices / Billing Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
        customer_name VARCHAR(255),
        total_amount NUMERIC(10, 2) NOT NULL,
        payment_mode VARCHAR(50) DEFAULT 'Cash',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Connected to PostgreSQL and verified database tables.');
    client.release();
  } catch (err) {
    console.error('Database initialization error:', err.message);
  }
}

initDB();

// API Endpoint: Get Customers (supports filtering by payment_type and search)
app.get('/api/customers', async (req, res) => {
  const { payment_type, search } = req.query;
  try {
    let query = 'SELECT * FROM customers WHERE 1=1';
    const queryParams = [];

    if (payment_type && payment_type !== 'All') {
      queryParams.push(payment_type);
      query += ` AND payment_type = $${queryParams.length}`;
    }

    if (search) {
      queryParams.push(`%${search}%`);
      query += ` AND (name ILIKE $${queryParams.length} OR phone ILIKE $${queryParams.length})`;
    }

    query += ' ORDER BY name ASC';

    const { rows } = await pool.query(query, queryParams);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching customers:', err);
    res.status(500).json({ error: 'Failed to fetch customer records' });
  }
});

// API Endpoint: Add New Customer
app.post('/api/customers', async (req, res) => {
  const { name, phone, payment_type, balance } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO customers (name, phone, payment_type, balance) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, phone, payment_type || 'Cash', balance || 0.00]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error adding customer:', err);
    res.status(500).json({ error: 'Failed to add customer' });
  }
});

// Default Route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Agrawal OMS Server is running on port ${PORT}`);
});