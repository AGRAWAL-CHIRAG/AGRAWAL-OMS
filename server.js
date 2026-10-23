const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from your public/client folder
app.use(express.static(path.join(__dirname, 'public')));

// PostgreSQL Connection Pool (Supabase with SSL configuration)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 5000
});

// Test database connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('Database connection error:', err.stack);
  } else {
    console.log('Connected to Supabase PostgreSQL database successfully!');
    release();
  }
});

// ==================== API ROUTES ====================

// 1. Get all inventory items (Fixes the 404 error on the billing page)
app.get('/api/inventory', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventory ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching inventory:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Add a new inventory item
app.post('/api/inventory', async (req, res) => {
  try {
    const { name, price, quantity } = req.body;
    const result = await pool.query(
      'INSERT INTO inventory (name, price, quantity) VALUES ($1, $2, $3) RETURNING *',
      [name, price, quantity]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding inventory:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Get all customers
app.get('/api/customers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM customers ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching customers:', err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Save a new invoice / billing record
app.post('/api/invoices', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { customer_name, items, total_amount } = req.body;
    
    const invoiceResult = await client.query(
      'INSERT INTO invoices (customer_name, total_amount) VALUES ($1, $2) RETURNING id',
      [customer_name, total_amount]
    );
    const invoiceId = invoiceResult.rows[0].id;

    for (let item of items) {
      await client.query(
        'INSERT INTO invoice_items (invoice_id, item_name, quantity, price) VALUES ($1, $2, $3, $4)',
        [invoiceId, item.name, item.quantity, item.price]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, invoiceId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error saving invoice:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Fallback to serve index.html for frontend single-page routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(port, () => {
  console.log(`Agrawal OMS Server is running on port ${port}`);
});