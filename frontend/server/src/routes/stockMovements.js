import express from 'express';
import StockMovement from '../models/StockMovement.js';
import Ingredient from '../models/Ingredient.js';
import { verifyToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/permissions.js';
import { sendRouteError } from '../middleware/routeError.js';

const router = express.Router();

// GET stock movements - All users can view
router.get('/', verifyToken, async (req, res) => {
  try {
    console.log('[StockMovements GET] Fetching all stock movements');
    
    let movements = await StockMovement.find()
      .populate({
        path: 'ingredient',
        select: 'name unit',
        options: { strictPopulate: false }
      })
      .populate({
        path: 'recordedBy',
        select: 'name email',
        options: { strictPopulate: false }
      })
      .sort({ createdAt: -1 })
      .limit(200);
    
    // تأكد من أن كل حركة تحتوي على البيانات الصحيحة
    movements = movements.map(movement => {
      const movementObj = movement.toObject();
      
      // أضف الحقول المفقودة
      if (movementObj.ingredient) {
        movementObj.ingredient_name = movementObj.ingredient.name || 'Unknown';
        movementObj.unit = movementObj.ingredient.unit || '';
      } else {
        movementObj.ingredient_name = 'Unknown';
        movementObj.unit = '';
      }
      
      // حول movementType إلى type للتوافقية
      movementObj.type = movementObj.movementType || 'OUT';
      
      // أضف amount بدل quantity
      movementObj.amount = movementObj.quantity || 0;
      
      // تأكد من وجود createdAt
      if (!movementObj.createdAt || movementObj.createdAt === 'Invalid Date') {
        movementObj.createdAt = new Date(movement._id.getTimestamp());
      }
      
      return movementObj;
    });
    
    console.log('[StockMovements GET] ✓ Found', movements.length, 'movements');
    res.json(movements);
  } catch (error) {
    console.error('[StockMovements GET] ✗ Error:', error.message);
    sendRouteError(res, error);
  }
});

// GET stock movements for specific ingredient - All users can view
router.get('/ingredient/:id', verifyToken, async (req, res) => {
  try {
    console.log('[StockMovement GET] Fetching movements for ingredient:', req.params.id);
    
    let movements = await StockMovement.find({ ingredient: req.params.id })
      .populate({
        path: 'recordedBy',
        select: 'name email',
        options: { strictPopulate: false }
      })
      .sort({ createdAt: -1 })
      .limit(100);
    
    // تأكد من أن كل حركة تحتوي على البيانات الصحيحة
    movements = movements.map(movement => {
      const movementObj = movement.toObject();
      
      // أضف الحقول المفقودة
      if (movementObj.ingredient) {
        movementObj.ingredient_name = movementObj.ingredient.name || 'Unknown';
        movementObj.unit = movementObj.ingredient.unit || '';
      } else {
        movementObj.ingredient_name = 'Unknown';
        movementObj.unit = '';
      }
      
      // حول movementType إلى type للتوافقية
      movementObj.type = movementObj.movementType || 'OUT';
      
      // أضف amount بدل quantity
      movementObj.amount = movementObj.quantity || 0;
      
      // تأكد من وجود createdAt
      if (!movementObj.createdAt || movementObj.createdAt === 'Invalid Date') {
        movementObj.createdAt = new Date(movement._id.getTimestamp());
      }
      
      return movementObj;
    });
    
    console.log('[StockMovement GET] ✓ Found', movements.length, 'movements');
    res.json(movements);
  } catch (error) {
    console.error('[StockMovement GET] ✗ Error:', error.message);
    sendRouteError(res, error);
  }
});

// ADD stock manually - Only Admin
router.post('/add', verifyToken, requireRole('admin'), async (req, res) => {
  const { ingredient, quantity, reason, reference } = req.body;

  console.log('[StockMovement ADD] Adding stock:', { ingredient, quantity, reason });

  if (!ingredient) {
    return res.status(400).json({ error: 'Ingredient ID is required' });
  }

  if (!quantity || quantity <= 0 || !Number.isFinite(quantity)) {
    return res.status(400).json({ error: 'Quantity must be a positive number' });
  }

  const validReasons = ['purchase', 'production', 'waste', 'return', 'adjustment'];
  if (reason && !validReasons.includes(reason)) {
    return res.status(400).json({ error: `Reason must be one of: ${validReasons.join(', ')}` });
  }

  try {
    // Verify ingredient exists
    const ingredientExists = await Ingredient.findById(ingredient);
    if (!ingredientExists) {
      console.warn('[StockMovement ADD] Ingredient not found:', ingredient);
      return res.status(404).json({ error: 'Ingredient not found' });
    }

    // Update ingredient quantity
    const updated = await Ingredient.findByIdAndUpdate(
      ingredient,
      { $inc: { quantity: quantity }, updatedAt: new Date() },
      { new: true }
    );

    // Log movement
    const movement = await StockMovement.create({
      ingredient,
      movementType: 'IN',
      quantity,
      reason: reason || 'purchase',
      reference: reference || '',
      recordedBy: req.userId,
      notes: `Manual addition by ${req.user?.email || 'unknown'}`
    });

    await movement.populate('ingredient', 'name unit');
    
    console.log('[StockMovement ADD] ✓ Added', quantity, 'units of', ingredientExists.name);
    res.status(201).json(movement);
  } catch (error) {
    console.error('[StockMovement ADD] ✗ Error:', error.message);
    sendRouteError(res, error);
  }
});

// ADJUST stock (for corrections)
router.post('/adjust', verifyToken, requireRole('admin'), async (req, res) => {
  const { ingredient, quantity, reason } = req.body;

  console.log('[StockMovement ADJUST] Adjusting stock:', { ingredient, quantity, reason });

  if (!ingredient) {
    return res.status(400).json({ error: 'Ingredient ID is required' });
  }

  if (quantity === undefined || quantity === 0 || !Number.isFinite(quantity)) {
    return res.status(400).json({ error: 'Quantity must be a non-zero number' });
  }

  const validReasons = ['purchase', 'production', 'waste', 'return', 'adjustment'];
  if (reason && !validReasons.includes(reason)) {
    return res.status(400).json({ error: `Reason must be one of: ${validReasons.join(', ')}` });
  }

  try {
    // Verify ingredient exists
    const ingredientExists = await Ingredient.findById(ingredient);
    if (!ingredientExists) {
      console.warn('[StockMovement ADJUST] Ingredient not found:', ingredient);
      return res.status(404).json({ error: 'Ingredient not found' });
    }

    // Check if adjustment would result in negative stock
    const newQuantity = ingredientExists.quantity + quantity;
    if (newQuantity < 0) {
      console.warn('[StockMovement ADJUST] Would result in negative stock:', newQuantity);
      return res.status(400).json({ error: 'Adjustment would result in negative stock' });
    }

    // Update ingredient quantity
    const updated = await Ingredient.findByIdAndUpdate(
      ingredient,
      { $inc: { quantity: quantity }, updatedAt: new Date() },
      { new: true }
    );

    // Log movement
    const movementType = quantity > 0 ? 'IN' : 'OUT';
    const movement = await StockMovement.create({
      ingredient,
      movementType,
      quantity: Math.abs(quantity),
      reason: reason || 'adjustment',
      recordedBy: req.userId,
      notes: `Stock adjustment by ${req.user?.email || 'unknown'}`
    });

    await movement.populate('ingredient', 'name unit');
    
    const direction = quantity > 0 ? 'Added' : 'Deducted';
    console.log('[StockMovement ADJUST] ✓', direction, Math.abs(quantity), 'units of', ingredientExists.name);
    res.status(201).json(movement);
  } catch (error) {
    console.error('[StockMovement ADJUST] ✗ Error:', error.message);
    sendRouteError(res, error);
  }
});

export default router;
