require('dotenv').config();
const mongoose = require('mongoose');

const { MONGODB_URI, JWT_SECRET } = process.env;
if (!MONGODB_URI || !JWT_SECRET || JWT_SECRET.length < 16) {
  console.error('Set MONGODB_URI and a JWT_SECRET of at least 16 characters in .env (copy .env.example).');
  process.exit(1);
}

const app = require('./app');
const PORT = process.env.PORT || 3000;

mongoose.connect(MONGODB_URI)
  .then(() => app.listen(PORT, () => console.log('API running at http://localhost:' + PORT + '/api')))
  .catch((err) => { console.error('Could not connect to MongoDB:', err.message); process.exit(1); });
