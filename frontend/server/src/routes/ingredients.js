import express from 'express';
import Ingredient from '../models/Ingredient.js';
import { verifyToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/permissions.js';
import { sendRouteError } from '../middleware/routeError.js';

const router = express.Router();

// GET all ingredients - All users can view
router.get('/', verifyToken, async (req, res) => {
  try {
    console.log('[Ingredients GET] Fetching all ingredients');
    
    const ingredients = await Ingredient.find().sort({ name: 1 });
    
    console.log('[Ingredients GET] ✓ Found', ingredients.length, 'ingredients');
    res.json(ingredients);
  } catch (error) {
    console.error('[Ingredients GET] ✗ Error:', error.message);
    sendRouteError(res, error);
  }
});

// GET single ingredient - All users can view
router.get('/:id', verifyToken, async (req, res) => {
  try {
    console.log('[Ingredient GET] Fetching ingredient:', req.params.id);
    
    const ingredient = await Ingredient.findById(req.params.id);
    if (!ingredient) {
      console.warn('[Ingredient GET] Ingredient not found:', req.params.id);
      return res.status(404).json({ error: 'Ingredient not found' });
    }
    
    console.log('[Ingredient GET] ✓ Found:', ingredient.name);
    res.json(ingredient);
  } catch (error) {
    console.error('[Ingredient GET] ✗ Error:', error.message);
    sendRouteError(res, error);
  }
});

// CREATE ingredient - Only Admin
router.post('/', verifyToken, requireRole('admin'), async (req, res) => {
  const { name, unit, quantity, reorderLevel, unitCost } = req.body;

  console.log('[Ingredient POST] Attempting to create:', { name, unit });

  if (!name || !name.trim()) {
    console.warn('[Ingredient POST] Missing name');
    return res.status(400).json({ error: 'Ingredient name is required' });
  }

  if (!unit) {
    console.warn('[Ingredient POST] Missing unit');
    return res.status(400).json({ error: 'Unit is required' });
  }

  const validUnits = ['kg', 'g', 'l', 'ml', 'pcs', 'dozen'];
  if (!validUnits.includes(unit)) {
    console.warn('[Ingredient POST] Invalid unit:', unit);
    return res.status(400).json({ error: `Unit must be one of: ${validUnits.join(', ')}` });
  }

  if (quantity && (quantity < 0 || !Number.isFinite(quantity))) {
    return res.status(400).json({ error: 'Quantity must be a non-negative number' });
  }

  if (reorderLevel && (reorderLevel < 0 || !Number.isFinite(reorderLevel))) {
    return res.status(400).json({ error: 'Reorder level must be a non-negative number' });
  }

  try {
    const ingredient = await Ingredient.create({
      name: name.trim(),
      unit,
      quantity: quantity || 0,
      reorderLevel: reorderLevel || 10,
      unitCost: unitCost || 0
    });
    
    console.log('[Ingredient POST] ✓ Created:', ingredient._id, ingredient.name);
    res.status(201).json(ingredient);
  } catch (error) {
    console.error('[Ingredient POST] ✗ Error:', error.message);
    if (error.code === 11000) {
      return res.status(409).json({ error: 'An ingredient with this name already exists' });
    }
    sendRouteError(res, error);
  }
});

// UPDATE ingredient - Only Admin
router.put('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  const { name, unit, quantity, reorderLevel, unitCost } = req.body;

  console.log('[Ingredient PUT] Updating ingredient:', req.params.id);

  try {
    const validUnits = ['kg', 'g', 'l', 'ml', 'pcs', 'dozen'];
    if (unit && !validUnits.includes(unit)) {
      return res.status(400).json({ error: `Unit must be one of: ${validUnits.join(', ')}` });
    }

    if (quantity && (quantity < 0 || !Number.isFinite(quantity))) {
      return res.status(400).json({ error: 'Quantity must be a non-negative number' });
    }

    const ingredient = await Ingredient.findByIdAndUpdate(
      req.params.id,
      { 
        name: name ? name.trim() : undefined,
        unit,
        quantity,
        reorderLevel,
        unitCost,
        updatedAt: new Date() 
      },
      { new: true, runValidators: true }
    );

    if (!ingredient) {
      console.warn('[Ingredient PUT] Ingredient not found:', req.params.id);
      return res.status(404).json({ error: 'Ingredient not found' });
    }

    console.log('[Ingredient PUT] ✓ Updated:', ingredient._id, ingredient.name);
    res.json(ingredient);
  } catch (error) {
    console.error('[Ingredient PUT] ✗ Error:', error.message);
    sendRouteError(res, error);
  }
});

// DELETE ingredient - Only Admin
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  console.log('[Ingredient DELETE] Deleting ingredient:', req.params.id);
  
  try {
    const ingredient = await Ingredient.findByIdAndDelete(req.params.id);

    if (!ingredient) {
      console.warn('[Ingredient DELETE] Ingredient not found:', req.params.id);
      return res.status(404).json({ error: 'Ingredient not found' });
    }

    console.log('[Ingredient DELETE] ✓ Deleted:', ingredient._id, ingredient.name);
    res.json({ message: 'Ingredient deleted', ingredient });
  } catch (error) {
    console.error('[Ingredient DELETE] ✗ Error:', error.message);
    sendRouteError(res, error);
  }
});

export default router;
