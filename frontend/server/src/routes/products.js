import express from 'express';
import Product from '../models/Product.js';
import { verifyToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/permissions.js';
import { sendRouteError } from '../middleware/routeError.js';

const router = express.Router();

// GET all products - All users can view
router.get('/', verifyToken, async (req, res) => {
  try {
    console.log('[Products GET] Fetching all products');
    
    const products = await Product.find()
      .populate({
        path: 'category',
        select: 'name',
        options: { strictPopulate: false }
      })
      .sort({ name: 1 });
    
    console.log('[Products GET] ✓ Found', products.length, 'products');
    res.json(products);
  } catch (error) {
    console.error('[Products GET] ✗ Error:', error.message);
    sendRouteError(res, error);
  }
});

// GET single product - All users can view
router.get('/:id', verifyToken, async (req, res) => {
  try {
    console.log('[Product GET] Fetching product:', req.params.id);
    
    const product = await Product.findById(req.params.id)
      .populate({
        path: 'category',
        options: { strictPopulate: false }
      });

    if (!product) {
      console.warn('[Product GET] Product not found:', req.params.id);
      return res.status(404).json({ error: 'Product not found' });
    }

    console.log('[Product GET] ✓ Found product:', product.name);
    res.json(product);
  } catch (error) {
    console.error('[Product GET] ✗ Error:', error.message);
    sendRouteError(res, error);
  }
});

// CREATE product - Only Admin
router.post('/', verifyToken, requireRole('admin'), async (req, res) => {
  const { name, category, description, price, status } = req.body;

  console.log('[Product POST] Attempting to create:', { name, category });

  if (!name || !name.trim()) {
    console.warn('[Product POST] Missing name');
    return res.status(400).json({ error: 'Product name is required' });
  }

  if (!category) {
    console.warn('[Product POST] Missing category');
    return res.status(400).json({ error: 'Product category is required' });
  }

  if (price && price < 0) {
    console.warn('[Product POST] Invalid price:', price);
    return res.status(400).json({ error: 'Product price cannot be negative' });
  }

  try {
    const product = await Product.create({
      name: name.trim(),
      category,
      description: description || '',
      price: price || 0,
      status: status || 'active'
    });
    
    await product.populate({
      path: 'category',
      select: 'name',
      options: { strictPopulate: false }
    });
    
    console.log('[Product POST] ✓ Created:', product._id, product.name);
    res.status(201).json(product);
  } catch (error) {
    console.error('[Product POST] ✗ Error:', error.message);
    if (error.code === 11000) {
      return res.status(409).json({ error: 'A product with this name already exists' });
    }
    sendRouteError(res, error);
  }
});

// UPDATE product - Only Admin
router.put('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  const { name, category, description, price, status } = req.body;

  console.log('[Product PUT] Updating product:', req.params.id);

  try {
    if (price && price < 0) {
      return res.status(400).json({ error: 'Product price cannot be negative' });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { 
        name: name ? name.trim() : undefined,
        category,
        description,
        price,
        status,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    ).populate({
      path: 'category',
      select: 'name',
      options: { strictPopulate: false }
    });

    if (!product) {
      console.warn('[Product PUT] Product not found:', req.params.id);
      return res.status(404).json({ error: 'Product not found' });
    }

    console.log('[Product PUT] ✓ Updated:', product._id, product.name);
    res.json(product);
  } catch (error) {
    console.error('[Product PUT] ✗ Error:', error.message);
    sendRouteError(res, error);
  }
});

// DELETE product - Only Admin
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  console.log('[Product DELETE] Deleting product:', req.params.id);
  
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      console.warn('[Product DELETE] Product not found:', req.params.id);
      return res.status(404).json({ error: 'Product not found' });
    }

    console.log('[Product DELETE] ✓ Deleted:', product._id, product.name);
    res.json({ message: 'Product deleted', product });
  } catch (error) {
    console.error('[Product DELETE] ✗ Error:', error.message);
    sendRouteError(res, error);
  }
});

// TOGGLE product status - Only Admin
router.patch('/:id/toggle-status', verifyToken, requireRole('admin'), async (req, res) => {
  console.log('[Product TOGGLE] Toggling status for:', req.params.id);
  
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      console.warn('[Product TOGGLE] Product not found:', req.params.id);
      return res.status(404).json({ error: 'Product not found' });
    }

    const oldStatus = product.status;
    product.status = product.status === 'active' ? 'inactive' : 'active';
    product.updatedAt = new Date();

    await product.save();

    console.log('[Product TOGGLE] ✓ Status changed:', oldStatus, '->', product.status);
    res.json(product);
  } catch (error) {
    console.error('[Product TOGGLE] ✗ Error:', error.message);
    sendRouteError(res, error);
  }
});

export default router;
