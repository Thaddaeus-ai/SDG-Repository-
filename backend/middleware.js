const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { User } = require('./models');

// Lets async route handlers throw: errors go to the error handler in app.js.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const signToken = (user) =>
  jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

// Verifies the Bearer token, then loads the user from the database so a deleted
// user or a changed role takes effect immediately instead of when the token expires.
const requireLogin = wrap(async (req, res, next) => {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  let payload;
  try { payload = m && jwt.verify(m[1], process.env.JWT_SECRET); } catch (e) { payload = null; }
  const user = payload && mongoose.isObjectIdOrHexString(payload.sub) && (await User.findById(payload.sub).select('role email name'));
  if (!user) return res.status(401).json({ message: 'Log in first.' });
  req.user = { id: user.id, role: user.role, email: user.email, name: user.name };
  next();
});

const requireAdmin = [requireLogin, (req, res, next) =>
  req.user.role === 'admin' ? next() : res.status(403).json({ message: 'Admins only.' })];

// For routes with :id, anything that is not a valid ObjectId is simply "not found".
const idParam = (_req, res, next, id) =>
  mongoose.isObjectIdOrHexString(id) ? next() : res.status(404).json({ message: 'Not found.' });

const paging = (q, def = 20) => {
  const page = Math.max(parseInt(q.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(q.limit, 10) || def, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};
const toNum = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
const isHttpUrl = (u) => { try { return ['http:', 'https:'].includes(new URL(u).protocol); } catch (e) { return false; } };
const round3 = (n) => Math.round(n * 1000) / 1000;

module.exports = { wrap, signToken, requireLogin, requireAdmin, idParam, paging, toNum, isHttpUrl, round3 };
