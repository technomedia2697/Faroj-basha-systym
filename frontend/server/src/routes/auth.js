import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import User from '../models/User.js';
import { verifyToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/permissions.js';

const router = express.Router();
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('JWT_SECRET is not configured securely');
  }
  return secret;
}

// LOGIN
router.post('/login', loginRateLimit, async (req, res) => {
  const { email, password } = req.body;

  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      getJwtSecret(),
      { expiresIn: process.env.JWT_EXPIRE || '24h', algorithm: 'HS256' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login failed', { name: error.name || 'Error', code: error.code });
    res.status(500).json({ error: 'Unable to sign in right now' });
  }
});

// REGISTER
router.post('/register', verifyToken, requireRole('admin'), async (req, res) => {
  const { email, password, name } = req.body;

  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    typeof name !== 'string' ||
    !email.trim() ||
    !name.trim() ||
    email.length > 254 ||
    name.trim().length > 120
  ) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }

  if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ error: 'Password must be 12-72 UTF-8 bytes long' });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: normalizedEmail,
      password: hashedPassword,
      name: name.trim(),
      role: 'staff'
    });

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      getJwtSecret(),
      { expiresIn: process.env.JWT_EXPIRE || '24h', algorithm: 'HS256' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration failed', { name: error.name || 'Error', code: error.code });
    if (error.code === 11000) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }
    res.status(500).json({ error: 'Unable to create the account' });
  }
});

// GET user profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Profile retrieval failed', { name: error.name || 'Error', code: error.code });
    res.status(500).json({ error: 'Unable to load the profile' });
  }
});

// UPDATE profile
router.put('/profile', verifyToken, async (req, res) => {
  const { name, email } = req.body;

  if (typeof name !== 'string' || typeof email !== 'string' || !name.trim() || !email.trim()) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.userId,
      { name: name.trim(), email: email.trim().toLowerCase(), updatedAt: new Date() },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Profile update failed', { name: error.name || 'Error', code: error.code });
    if (error.code === 11000) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }
    res.status(500).json({ error: 'Unable to update the profile' });
  }
});

// CHANGE password
router.put('/change-password', verifyToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  if (newPassword.length < 12 || Buffer.byteLength(newPassword, 'utf8') > 72) {
    return res.status(400).json({ error: 'New password must be 12-72 UTF-8 bytes long' });
  }

  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.updatedAt = new Date();
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change failed', { name: error.name || 'Error', code: error.code });
    res.status(500).json({ error: 'Unable to change the password' });
  }
});

// ADMIN: manage cashier accounts without ever returning password data.
router.get('/users', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const users = await User.find({ role: 'staff' })
      .select('_id name email role createdAt updatedAt')
      .sort({ name: 1 });
    res.json(users);
  } catch (error) {
    console.error('User listing failed', { name: error.name || 'Error', code: error.code });
    res.status(500).json({ error: 'Unable to load cashier accounts' });
  }
});

router.post('/users', verifyToken, requireRole('admin'), async (req, res) => {
  const { name, email, password } = req.body;
  if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' ||
      !name.trim() || !email.trim()) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }
  if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ error: 'Password must be 12-72 UTF-8 bytes long' });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(409).json({ error: 'A user with this email already exists' });
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: await bcrypt.hash(password, 10),
      role: 'staff',
    });
    res.status(201).json({ _id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (error) {
    console.error('Cashier creation failed', { name: error.name || 'Error', code: error.code });
    res.status(500).json({ error: 'Unable to create the cashier account' });
  }
});

router.put('/users/:id', verifyToken, requireRole('admin'), async (req, res) => {
  const { name, email, password } = req.body;
  if (typeof name !== 'string' || typeof email !== 'string' || !name.trim() || !email.trim()) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  if (password !== undefined && (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72)) {
    return res.status(400).json({ error: 'Password must be 12-72 UTF-8 bytes long' });
  }

  try {
    const updates = { name: name.trim(), email: email.trim().toLowerCase(), updatedAt: new Date() };
    if (password) updates.password = await bcrypt.hash(password, 10);
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'staff' },
      updates,
      { new: true, runValidators: true }
    ).select('_id name email role');
    if (!user) return res.status(404).json({ error: 'Cashier account not found' });
    res.json(user);
  } catch (error) {
    console.error('Cashier update failed', { name: error.name || 'Error', code: error.code });
    if (error.code === 11000) return res.status(409).json({ error: 'A user with this email already exists' });
    res.status(500).json({ error: 'Unable to update the cashier account' });
  }
});

export default router;
