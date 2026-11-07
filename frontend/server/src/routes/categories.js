import express from 'express';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { verifyToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/permissions.js';
import { sendRouteError } from '../middleware/routeError.js';

const router = express.Router();

// GET all categories - All users can view
router.get('/', verifyToken, async (req, res) => {
  try {
    console.log('[Categories GET] Fetching all categories');
    
    const categories = await Category.find().sort({ name: 1 });
    
    // Add product count for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const count = await Product.countDocuments({ category: category._id });
        return {
          ...category.toObject(),
          products_count: count
        };
      })
    );
    
    console.log('[Categories GET] ✓ Found', categoriesWithCount.length, 'categories with counts');
    res.json(categoriesWithCount);
  } catch (error) {
    console.error('[Categories GET] ✗ Error:', error.message);
    sendRouteError(res, error);
  }
});

// CREATE category - Only Admin
router.post('/', verifyToken, requireRole('admin'), async (req, res) => {
  const { name, description } = req.body;

  console.log('[Category POST] Attempting to create:', { name });

  if (!name || !name.trim()) {
    console.warn('[Category POST] Missing name');
    return res.status(400).json({ error: 'Category name is required' });
  }

  try {
    const category = await Category.create({ 
      name: name.trim(), 
      description: description || '' 
    });
    
    console.log('[Category POST] ✓ Created:', category._id, category.name);
    res.status(201).json(category);
  } catch (error) {
    console.error('[Category POST] ✗ Error:', error.message);
    if (error.code === 11000) {
      return res.status(409).json({ error: 'A category with this name already exists' });
    }
    sendRouteError(res, error);
  }
});

// UPDATE category - Only Admin
router.put('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  const { name, description } = req.body;

  console.log('[Category PUT] Updating category:', req.params.id);

  try {
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { 
        name: name ? name.trim() : undefined, 
        description,
        updatedAt: new Date() 
      },
      { new: true, runValidators: true }
    );

    if (!category) {
      console.warn('[Category PUT] Category not found:', req.params.id);
      return res.status(404).json({ error: 'Category not found' });
    }

    console.log('[Category PUT] ✓ Updated:', category._id, category.name);
    res.json(category);
  } catch (error) {
    console.error('[Category PUT] ✗ Error:', error.message);
    sendRouteError(res, error);
  }
});

// DELETE category - Only Admin
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  console.log('[Category DELETE] Deleting category:', req.params.id);
  
  try {
    const category = await Category.findByIdAndDelete(req.params.id);

    if (!category) {
      console.warn('[Category DELETE] Category not found:', req.params.id);
      return res.status(404).json({ error: 'Category not found' });
    }

    console.log('[Category DELETE] ✓ Deleted:', category._id, category.name);
    res.json({ message: 'Category deleted', category });
  } catch (error) {
    console.error('[Category DELETE] ✗ Error:', error.message);
    sendRouteError(res, error);
  }
});

export default router;
