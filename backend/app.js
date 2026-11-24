const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

const app = express();
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: (process.env.CORS_ORIGIN || 'http://localhost:8000').split(',').map((s) => s.trim()) }));
app.use(express.json({ limit: '50kb' }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false });
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/carbon-logs', require('./routes/carbon'));
app.use('/api/articles', require('./routes/articles'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/users', require('./routes/users'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/uploads', require('./routes/uploads'));
app.get('/api/health', (_req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 }));

app.use('/api', (_req, res) => res.status(404).json({ message: 'Not found.' }));

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'Request too large.' });
  if (err.name === 'ValidationError') return res.status(400).json({ message: Object.values(err.errors)[0].message });
  if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid value for ' + err.path + '.' });
  console.error(err);
  res.status(500).json({ message: 'Server error.' });
});

module.exports = app;
