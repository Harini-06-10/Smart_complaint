const express = require('express');
const User = require('../models/User');
const { signToken, protect } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register  – citizens self-register
router.post('/register', async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required' });
  if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) return res.status(409).json({ message: 'An account with this email already exists' });

  const user = await User.create({ name, email, password, phone, role: 'citizen' });
  res.status(201).json({ token: signToken(user), user: user.toSafeJSON() });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }
  res.json({ token: signToken(user), user: user.toSafeJSON() });
});

// GET /api/auth/me
router.get('/me', protect, (req, res) => res.json({ user: req.user.toSafeJSON() }));

// PATCH /api/auth/me  – update profile / language preference
router.patch('/me', protect, async (req, res) => {
  const { name, phone, preferredLanguage } = req.body;
  if (name) req.user.name = name;
  if (phone !== undefined) req.user.phone = phone;
  if (preferredLanguage) req.user.preferredLanguage = preferredLanguage;
  await req.user.save();
  res.json({ user: req.user.toSafeJSON() });
});

module.exports = router;
