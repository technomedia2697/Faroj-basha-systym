import express from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Recipe from '../models/Recipe.js';
import Ingredient from '../models/Ingredient.js';
import ProductionLog from '../models/ProductionLog.js';
import StockMovement from '../models/StockMovement.js';
import { verifyToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/permissions.js';
import { sendRouteError } from '../middleware/routeError.js';

const router = express.Router();

// GET production logs
router.get('/', verifyToken, async (req, res) => {
  try {
    const logs = await ProductionLog.find()
      .populate({
        path: 'product',
        select: 'name',
        options: { strictPopulate: false }
      })
      .populate({
        path: 'producedBy',
        select: 'name',
        options: { strictPopulate: false }
      })
      .sort({ createdAt: -1 })
      .limit(100);
    
    res.json(logs);
  } catch (error) {
    console.error('Production logs fetch error:', error);
    sendRouteError(res, error);
  }
});

// GET production log by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const log = await ProductionLog.findById(req.params.id)
      .populate({
        path: 'product',
        select: 'name',
        options: { strictPopulate: false }
      })
      .populate({
        path: 'producedBy',
        select: 'name email',
        options: { strictPopulate: false }
      });
    
    if (!log) {
      return res.status(404).json({ error: 'Production log not found' });
    }

    res.json(log);
  } catch (error) {
    console.error('Production log fetch error:', error);
    sendRouteError(res, error);
  }
});

// PRODUCE a product - Main business logic with MongoDB transaction
router.post('/produce', verifyToken, requireRole('admin'), async (req, res) => {
  const { product, quantity, notes } = req.body;

  console.log('[Production POST] Starting production:', { product, quantity });

  if (!product) {
    return res.status(400).json({ error: 'Product ID is required' });
  }

  if (!quantity || quantity <= 0 || !Number.isFinite(quantity)) {
    return res.status(400).json({ error: 'Quantity must be a positive number' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Get recipe for product
    const recipe = await Recipe.findOne({ product }).populate({
      path: 'ingredients.ingredient',
      select: 'name unit quantity'
    }).session(session);

    if (!recipe || recipe.ingredients.length === 0) {
      await session.abortTransaction();
      console.warn('[Production POST] No recipe found for product:', product);
      return res.status(400).json({ error: 'No recipe found for this product' });
    }

    console.log('[Production POST] Found recipe with', recipe.ingredients.length, 'ingredients');

    // Track consumed details for response (ingredient, consumed, remaining)
    const consumedDetails = [];

    // Check if enough ingredients available
    const insufficientIngredients = []; 
    for (const item of recipe.ingredients) {
      const requiredAmount = item.quantity * quantity;
      const currentStock = item.ingredient.quantity;
      
      console.log('[Production POST] Checking', item.ingredient.name, '- required:', requiredAmount, 'available:', currentStock);
      
      if (currentStock < requiredAmount) {
        insufficientIngredients.push({
          name: item.ingredient.name,
          required: requiredAmount,
          available: currentStock,
          unit: item.ingredient.unit
        });
      }
    }

    if (insufficientIngredients.length > 0) {
      await session.abortTransaction();
      console.warn('[Production POST] Insufficient ingredients:', insufficientIngredients);
      
      const details = insufficientIngredients
        .map(i => `${i.name}: need ${i.required}${i.unit}, have ${i.available}${i.unit}`)
        .join('; ');
      return res.status(400).json({
        error: `Insufficient ingredients: ${details}`
      });
    }

    // Deduct ingredients and create stock movements
    console.log('[Production POST] Deducting ingredients...');
    
    for (const item of recipe.ingredients) {
      const deductAmount = item.quantity * quantity;
      
      // Update ingredient stock and get updated doc
      const updatedIngredient = await Ingredient.findByIdAndUpdate(
        item.ingredient._id,
        { $inc: { quantity: -deductAmount } },
        { new: true, session }
      );

      // Log stock movement with remaining_after
      await StockMovement.create(
        [{
          ingredient: item.ingredient._id,
          movementType: 'OUT',
          quantity: deductAmount,
          reason: 'production',
          recordedBy: req.userId,
          reference: `Product: ${product}`,
          notes: `Production - ${quantity} units produced`,
          remaining_after: updatedIngredient.quantity
        }],
        { session }
      );

      consumedDetails.push({
        ingredientId: item.ingredient._id,
        name: item.ingredient.name,
        consumed: deductAmount,
        remaining: updatedIngredient.quantity,
        unit: item.ingredient.unit
      });

      console.log('[Production POST] ✓ Deducted', deductAmount, 'units of', item.ingredient.name);
    }

    // Log production
    const productionLog = await ProductionLog.create(
      [{
        product,
        quantity,
        producedBy: req.userId,
        status: 'completed',
        completedAt: new Date(),
        notes: notes || ''
      }],
      { session }
    );

    await session.commitTransaction();

    const log = await ProductionLog.findById(productionLog[0]._id)
      .populate('product', 'name')
      .populate('producedBy', 'name email');

    console.log('[Production POST] ✓ Successfully produced:', quantity, 'units');

    res.status(201).json({
      message: 'Production recorded successfully',
      data: log,
      consumed: consumedDetails
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('[Production POST] ✗ Error:', error.message);
    sendRouteError(res, error);
  } finally {
    await session.endSession();
  }
});

// UPDATE production log status
router.put('/:id/status', verifyToken, requireRole('admin'), async (req, res) => {
  const { status } = req.body;

  const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const log = await ProductionLog.findByIdAndUpdate(
      req.params.id,
      { 
        status,
        completedAt: status === 'completed' ? new Date() : null,
        updatedAt: new Date()
      },
      { new: true }
    ).populate('product', 'name').populate('producedBy', 'name');

    if (!log) {
      return res.status(404).json({ error: 'Production log not found' });
    }

    res.json(log);
  } catch (error) {
    sendRouteError(res, error);
  }
});

export default router;
