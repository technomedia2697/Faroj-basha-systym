import express from 'express';
import Recipe from '../models/Recipe.js';
import { verifyToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/permissions.js';
import { sendRouteError } from '../middleware/routeError.js';

const router = express.Router();

// GET all recipes for a product - All users can view
router.get('/product/:product_id', verifyToken, async (req, res) => {
  try {
    console.log('[Recipe GET] Fetching recipe for product:', req.params.product_id);
    
    const recipe = await Recipe.findOne({ product: req.params.product_id })
      .populate({
        path: 'ingredients.ingredient',
        select: 'name unit',
        options: { strictPopulate: false }
      });
    
    if (!recipe) {
      console.log('[Recipe GET] No recipe found for product:', req.params.product_id);
      return res.json([]);
    }

    const ingredients = recipe.ingredients.map(ing => ({
      id: ing._id,
      product_id: recipe.product,
      ingredient_id: ing.ingredient?._id,
      ingredient_name: ing.ingredient?.name || 'Unknown',
      unit: ing.ingredient?.unit || '',
      quantity: ing.quantity
    }));

    console.log('[Recipe GET] ✓ Found recipe with', ingredients.length, 'ingredients');
    res.json(ingredients);
  } catch (error) {
    console.error('[Recipe GET] ✗ Error:', error.message);
    sendRouteError(res, error);
  }
});

// CREATE recipe item - Only Admin
router.post('/', verifyToken, requireRole('admin'), async (req, res) => {
  const { product, ingredient, quantity } = req.body;

  console.log('[Recipe POST] Creating recipe item:', { product, ingredient, quantity });

  if (!product || !ingredient || quantity === undefined) {
    return res.status(400).json({ error: 'Product, ingredient, and quantity are required' });
  }

  if (quantity <= 0) {
    return res.status(400).json({ error: 'Quantity must be greater than 0' });
  }

  try {
    let recipe = await Recipe.findOne({ product });

    if (recipe) {
      // Check if ingredient already in recipe
      const exists = recipe.ingredients.some(ing => ing.ingredient.toString() === ingredient);
      if (exists) {
        console.warn('[Recipe POST] Ingredient already in recipe:', ingredient);
        return res.status(409).json({ error: 'This ingredient is already in the recipe' });
      }
      recipe.ingredients.push({ ingredient, quantity });
      console.log('[Recipe POST] Added ingredient to existing recipe');
    } else {
      recipe = new Recipe({
        product,
        ingredients: [{ ingredient, quantity }]
      });
      console.log('[Recipe POST] Created new recipe');
    }

    await recipe.save();
    await recipe.populate({
      path: 'ingredients.ingredient',
      select: 'name unit',
      options: { strictPopulate: false }
    });

    const lastIng = recipe.ingredients[recipe.ingredients.length - 1];
    console.log('[Recipe POST] ✓ Successfully created:', lastIng.ingredient.name);
    
    res.status(201).json({
      id: lastIng._id,
      product_id: recipe.product,
      ingredient_id: lastIng.ingredient?._id,
      ingredient_name: lastIng.ingredient.name,
      quantity: lastIng.quantity
    });
  } catch (error) {
    console.error('[Recipe POST] ✗ Error:', error.message);
    sendRouteError(res, error);
  }
});

// UPDATE recipe item - Only Admin
router.put('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  const { quantity } = req.body;

  console.log('[Recipe PUT] Updating recipe item:', req.params.id, 'quantity:', quantity);

  if (quantity === undefined || quantity <= 0) {
    return res.status(400).json({ error: 'Quantity must be a positive number' });
  }

  try {
    const recipe = await Recipe.findOne({ 'ingredients._id': req.params.id });

    if (!recipe) {
      console.warn('[Recipe PUT] Recipe item not found:', req.params.id);
      return res.status(404).json({ error: 'Recipe item not found' });
    }

    const ingredient = recipe.ingredients.id(req.params.id);
    const oldQuantity = ingredient.quantity;
    ingredient.quantity = quantity;
    await recipe.save();

    console.log('[Recipe PUT] ✓ Updated quantity from', oldQuantity, 'to', quantity);
    res.json({ id: ingredient._id, quantity });
  } catch (error) {
    console.error('[Recipe PUT] ✗ Error:', error.message);
    sendRouteError(res, error);
  }
});

// DELETE recipe item - Only Admin
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  console.log('[Recipe DELETE] Deleting recipe item:', req.params.id);
  
  try {
    const recipe = await Recipe.findOne({ 'ingredients._id': req.params.id });

    if (!recipe) {
      console.warn('[Recipe DELETE] Recipe item not found:', req.params.id);
      return res.status(404).json({ error: 'Recipe item not found' });
    }

    recipe.ingredients.id(req.params.id).remove();
    await recipe.save();

    console.log('[Recipe DELETE] ✓ Successfully deleted');
    res.json({ message: 'Recipe item deleted' });
  } catch (error) {
    console.error('[Recipe DELETE] ✗ Error:', error.message);
    sendRouteError(res, error);
  }
});

export default router;
