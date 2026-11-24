const express = require('express');
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { wrap, signToken, requireLogin } = require('../middleware');

const router = express.Router();

// POST /auth/register - always creates a normal user. Admins are created by the seed script.
router.post('/register', wrap(async (req, res) => {
  const { name, email, password } = req.body || {};
  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email.' });
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) return res.status(400).json({ message: 'Password must be 8 to 128 characters.' });
  try {
    const user = await User.create({
      name: typeof name === 'string' ? name.trim().slice(0, 60) : undefined,
      email,
      passwordHash: await bcrypt.hash(password, 10)
    });
    res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'That email is already registered.' });
    throw err;
  }
}));

// POST /auth/login - returns { token, user }
router.post('/login', wrap(async (req, res) => {
  const { email, password } = req.body || {};
  const user = typeof email === 'string' && (await User.findOne({ email: email.toLowerCase().trim() }));
  const ok = user && typeof password === 'string' && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) return res.status(401).json({ message: 'Wrong email or password.' });
  res.json({ token: signToken(user), user });
}));

router.get('/me', requireLogin, wrap(async (req, res) => res.json(await User.findById(req.user.id))));

module.exports = router;
