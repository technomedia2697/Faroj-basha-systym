import express from 'express';
import Setting, { getTaxRate } from '../models/Setting.js';
import { verifyToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/permissions.js';
import { sendRouteError } from '../middleware/routeError.js';

const router = express.Router();

// Every signed-in user (cashiers too) reads the shared tax rate.
router.get('/', verifyToken, async (req, res) => {
  try {
    res.json({ taxRate: await getTaxRate() });
  } catch (error) {
    sendRouteError(res, error);
  }
});

// Only the administrator changes it. It applies to NEW orders only; saved orders keep their tax.
router.put('/', verifyToken, requireRole('admin'), async (req, res) => {
  const taxRate = Number(req.body?.taxRate);
  if (req.body?.taxRate === '' || req.body?.taxRate === null || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
    return res.status(400).json({ error: 'Tax rate must be a number between 0 and 100' });
  }
  try {
    const doc = await Setting.findByIdAndUpdate(
      'app',
      { $set: { taxRate: Math.round(taxRate * 100) / 100 } },
      { new: true, upsert: true, runValidators: true },
    );
    res.json({ taxRate: doc.taxRate });
  } catch (error) {
    sendRouteError(res, error);
  }
});

export default router;
