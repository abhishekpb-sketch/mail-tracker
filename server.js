require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: '*', // Allow dashboard + extension
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'x-api-key']
}));
app.use(express.json());

// ─── API Key Auth Middleware ──────────────────────────────────────────────────
// Protect all /api/* routes — tracking pixel is public (no key needed)
app.use('/api', (req, res, next) => {
  const key = req.headers['x-api-key'];
  if (!key || key !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized — invalid API key' });
  }
  next();
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/track', require('./routes/track'));
app.use('/api/emails', require('./routes/emails'));
app.use('/api/analytics', require('./routes/analytics'));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'Mail Tracker API is running ✅', version: '1.0.0' });
});

// ─── Connect to MongoDB & Start Server ────────────────────────────────────────
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas');
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
