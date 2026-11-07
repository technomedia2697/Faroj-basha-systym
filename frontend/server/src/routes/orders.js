import express from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Recipe from '../models/Recipe.js';
import Ingredient from '../models/Ingredient.js';
import StockMovement from '../models/StockMovement.js';
import ProductionLog from '../models/ProductionLog.js';
import { verifyToken } from '../middleware/auth.js';
import { requirePermission, requireRole } from '../middleware/permissions.js';
import { sendRouteError } from '../middleware/routeError.js';

const router = express.Router();

// GET all orders - All users can view
router.get('/', verifyToken, requirePermission('view_orders'), async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('items.product_id', 'name price')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(orders);
  } catch (error) {
    sendRouteError(res, error);
  }
});

// GET order by ID - All users can view
router.get('/:id', verifyToken, requirePermission('view_orders'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    const order = await Order.findById(req.params.id)
      .populate('items.product_id')
      .populate('createdBy', 'name email');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    sendRouteError(res, error);
  }
});

// CREATE new order - All users can create
router.post('/', verifyToken, requirePermission('create_orders'), async (req, res) => {
  const {
    customer_name,
    customer_phone = '',
    customer_address = '',
    items,
    discount: requestedDiscount = 0,
    tax: requestedTax = 0,
    payment_method = 'cash',
    notes = '',
    type = 'takeaway',
    table_number = null,
    table_section = null,
    delivery_fee: submittedDeliveryFee,
    checks = null,
  } = req.body;
  const idempotencyKey = req.get('Idempotency-Key');
  let delivery_fee = submittedDeliveryFee;

  if (idempotencyKey && (idempotencyKey.length < 8 || idempotencyKey.length > 128)) {
    return res.status(400).json({ error: 'Idempotency-Key must be between 8 and 128 characters' });
  }
  if (
    typeof customer_name !== 'string' ||
    !customer_name.trim() ||
    customer_name.length > 120 ||
    typeof customer_phone !== 'string' ||
    customer_phone.length > 40 ||
    typeof customer_address !== 'string' ||
    customer_address.length > 500 ||
    typeof notes !== 'string' ||
    notes.length > 1000
  ) {
    return res.status(400).json({ error: 'Invalid customer or order details' });
  }
  if (!['table', 'takeaway', 'delivery'].includes(type)) {
    return res.status(400).json({ error: 'Invalid order type' });
  }
  if (!['cash', 'card', 'other'].includes(payment_method)) {
    return res.status(400).json({ error: 'Invalid payment method' });
  }
  if (type === 'delivery' && !customer_address.trim()) {
    return res.status(400).json({ error: 'Customer address is required for delivery orders' });
  }
  if (type === 'delivery' && delivery_fee == null) {
    delivery_fee = Number(process.env.DELIVERY_FEE_DEFAULT || 0);
  }

  if (
    !Array.isArray(items) && !Array.isArray(checks) ||
    (Array.isArray(items) && items.length === 0 && (!Array.isArray(checks) || checks.length === 0)) ||
    (Array.isArray(items) && items.length > 100) ||
    (Array.isArray(checks) && (checks.length === 0 || checks.length > 50))
  ) {
    return res.status(400).json({ error: 'Customer name and items/checks are required' });
  }
  if (![requestedDiscount, requestedTax, delivery_fee ?? 0].every((value) => Number.isFinite(Number(value)) && Number(value) >= 0)) {
    return res.status(400).json({ error: 'Discount, tax, and delivery fee must be non-negative numbers' });
  }

  try {
    if (idempotencyKey) {
      const existingOrder = await Order.findOne({ idempotencyKey, createdBy: req.userId })
        .populate('items.product_id', 'name price')
        .populate('createdBy', 'name email');
      if (existingOrder) {
        return res.status(200).json(existingOrder);
      }
    }

    const discount = Number(requestedDiscount);
    const tax = Number(requestedTax);
    delivery_fee = Number(delivery_fee || 0);

    let subtotal = 0;
    const processedItems = [];
    const checksProcessed = [];

    if (Array.isArray(checks) && checks.length > 0) {
      for (const chk of checks) {
        if (!chk || !Array.isArray(chk.items) || chk.items.length === 0 || chk.items.length > 100) {
          return res.status(400).json({ error: 'Each check must have items' });
        }
        const checkType = chk.type || type;
        const checkDeliveryFee = Number(chk.delivery_fee || 0);
        if (!['table', 'takeaway', 'delivery'].includes(checkType) || !Number.isFinite(checkDeliveryFee) || checkDeliveryFee < 0) {
          return res.status(400).json({ error: 'Invalid check details' });
        }
        let checkSubtotal = 0;
        const checkItems = [];
        for (const it of chk.items) {
          if (!it || !Number.isInteger(Number(it.quantity)) || Number(it.quantity) < 1 || Number(it.quantity) > 1000) {
            return res.status(400).json({ error: 'Each item must have a valid quantity' });
          }
          const isManualItem = !it.product_id;
          let product = null;
          if (isManualItem) {
            if (typeof it.product_name !== 'string' || !it.product_name.trim() || !Number.isFinite(Number(it.price)) || Number(it.price) < 0) {
              return res.status(400).json({ error: 'Manual items require a name and non-negative price' });
            }
          } else {
            if (!mongoose.isValidObjectId(it.product_id)) {
              return res.status(400).json({ error: 'Each saved product must have a valid product ID' });
            }
            product = await Product.findById(it.product_id);
            if (!product) {
              return res.status(404).json({ error: `Product with ID ${it.product_id} not found` });
            }
            if (product.status === 'inactive') {
              return res.status(409).json({ error: 'One or more products are unavailable' });
            }
          }
          const itemQuantity = Number(it.quantity);
          const itemPrice = isManualItem ? Number(it.price) : product.price;
          const itemSubtotal = itemPrice * itemQuantity;
          checkSubtotal += itemSubtotal;
          subtotal += itemSubtotal;

          const processed = {
            ...(product ? { product_id: product._id } : {}),
            product_name: product?.name || it.product_name.trim(),
            price: itemPrice,
            quantity: itemQuantity,
            subtotal: itemSubtotal,
          };
          processedItems.push(processed);
          checkItems.push(processed);
        }
        checksProcessed.push({
          type: checkType,
          table_number: chk.table_number || null,
          delivery_fee: checkDeliveryFee,
          items: checkItems,
          subtotal: checkSubtotal,
          total: checkSubtotal + checkDeliveryFee,
        });
      }
    } else {
      // Single items array
      for (const item of items) {
        if (!item || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || Number(item.quantity) > 1000) {
          return res.status(400).json({ error: 'Each item must have a valid quantity' });
        }

        const itemQuantity = Number(item.quantity);
        const isManualItem = !item.product_id;
        let product = null;
        if (isManualItem) {
          if (typeof item.product_name !== 'string' || !item.product_name.trim() || !Number.isFinite(Number(item.price)) || Number(item.price) < 0) {
            return res.status(400).json({ error: 'Manual items require a name and non-negative price' });
          }
        } else {
          if (!mongoose.isValidObjectId(item.product_id)) {
            return res.status(400).json({ error: 'Each saved product must have a valid product ID' });
          }
          product = await Product.findById(item.product_id);
          if (!product) {
            return res.status(404).json({ error: `Product with ID ${item.product_id} not found` });
          }
          if (product.status === 'inactive') {
            return res.status(409).json({ error: 'One or more products are unavailable' });
          }
        }

        const itemPrice = isManualItem ? Number(item.price) : product.price;
        const itemSubtotal = itemPrice * itemQuantity;
        subtotal += itemSubtotal;

        processedItems.push({
          ...(product ? { product_id: product._id } : {}),
          product_name: product?.name || item.product_name.trim(),
          price: itemPrice,
          quantity: itemQuantity,
          subtotal: itemSubtotal,
        });

      }
    }

    if (discount > subtotal) {
      return res.status(400).json({ error: 'Discount cannot exceed the order subtotal' });
    }
    const finalSubtotal = subtotal - discount;
    const totalDeliveryFees = delivery_fee + checksProcessed.reduce((s, c) => s + (c.delivery_fee || 0), 0);
    const total = finalSubtotal + tax + totalDeliveryFees;

    console.log('[Order POST] ✓ Totals calculated - subtotal:', subtotal, 'discount:', discount, 'tax:', tax, 'total:', total);

    const order = new Order({
      customer_name,
      customer_phone: customer_phone.trim(),
      customer_address,
      items: processedItems,
      subtotal,
      discount,
      tax,
      delivery_fee,
      type,
      table_number,
      table_section,
      checks: checksProcessed,
      total,
      payment_method,
      notes: notes.trim(),
      createdBy: req.userId,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    });

    if (['takeaway', 'delivery'].includes(type)) {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const consumed = await deductInventoryForOrderAtomic(order, req.userId, session);
        order.inventory_deducted = true;
        const savedOrder = await order.save({ session });
        await session.commitTransaction();
        const populatedOrder = await Order.findById(savedOrder._id)
          .populate('items.product_id', 'name price')
          .populate('createdBy', 'name email');

        populatedOrder._doc.consumed = consumed;
        return res.status(201).json(populatedOrder);
      } catch (err) {
        await session.abortTransaction();
        if (err.code === 11000 && idempotencyKey) {
          const existingOrder = await Order.findOne({ idempotencyKey, createdBy: req.userId })
            .populate('items.product_id', 'name price')
            .populate('createdBy', 'name email');
          if (existingOrder) {
            return res.status(200).json(existingOrder);
          }
        }
        if (err.code === 'INSUFFICIENT_STOCK') {
          return res.status(409).json({ error: err.message });
        }
        throw err;
      } finally {
        await session.endSession();
      }
    }

    const savedOrder = await order.save();
    
    const populatedOrder = await Order.findById(savedOrder._id)
      .populate('items.product_id', 'name price')
      .populate('createdBy', 'name email');
    
    res.status(201).json(populatedOrder);
  } catch (error) {
    if (error.code === 11000 && idempotencyKey) {
      try {
        const existingOrder = await Order.findOne({ idempotencyKey, createdBy: req.userId })
          .populate('items.product_id', 'name price')
          .populate('createdBy', 'name email');
        if (existingOrder) {
          return res.status(200).json(existingOrder);
        }
      } catch (lookupError) {
        return sendRouteError(res, lookupError);
      }
    }
    sendRouteError(res, error);
  }
});

// Cashiers and administrators can update order status.
router.put('/:id/status', verifyToken, requireRole(['admin', 'staff']), async (req, res) => {
  const { status } = req.body;

  if (!['pending', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (order.status !== 'pending' && status !== order.status) {
      return res.status(409).json({ error: 'A completed or cancelled order cannot change status' });
    }

    let consumedResult = null;
    const shouldDeductInventory = status === 'completed' &&
      order.status === 'pending' &&
      !order.inventory_deducted;

    if (shouldDeductInventory) {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        consumedResult = await deductInventoryForOrderAtomic(order, req.userId, session);
        order.inventory_deducted = true;
        order.status = status;
        order.completedAt = new Date();
        await order.save({ session });
        await session.commitTransaction();
      } catch (err) {
        await session.abortTransaction();
        if (err.code === 'INSUFFICIENT_STOCK') {
          return res.status(409).json({ error: err.message });
        }
        throw err;
      } finally {
        await session.endSession();
      }
    } else {
      order.status = status;
      if (status === 'completed') {
        order.completedAt = new Date();
      }
      await order.save();
    }

    // Return populated order and attach consumed summary (if any) for client visibility
    const populatedOrder = await Order.findById(order._id)
      .populate('items.product_id', 'name price')
      .populate('createdBy', 'name email');

    if (consumedResult) populatedOrder._doc.consumed = consumedResult;

    res.json(populatedOrder);
  } catch (error) {
    sendRouteError(res, error);
  }
});

// Auto-produce items for order
async function autoProduceOrderItems(order, userId) {
  console.log('[AutoProduce] Starting automatic production for order:', order.order_number);
  
  for (const item of order.items) {
    try {
      console.log('[AutoProduce] Producing item:', item.product_name, 'qty:', item.quantity);
      
      const product = await Product.findById(item.product_id);
      if (!product) {
        throw new Error(`Product not found: ${item.product_id}`);
      }

      // Get recipe for product
      const recipe = await Recipe.findOne({ product: item.product_id }).populate({
        path: 'ingredients.ingredient',
        select: 'name unit quantity'
      });

      if (!recipe || recipe.ingredients.length === 0) {
        console.warn('[AutoProduce] No recipe found for:', product.name);
        continue;
      }

      console.log('[AutoProduce] Found recipe with', recipe.ingredients.length, 'ingredients');

      // Check if enough ingredients available
      const insufficientIngredients = [];
      for (const recipeItem of recipe.ingredients) {
        if (!recipeItem.ingredient) {
          // Ingredient referenced in recipe missing from DB
          insufficientIngredients.push({
            name: '(unknown ingredient)',
            required: recipeItem.quantity * item.quantity,
            available: 0,
            unit: ''
          });
          continue;
        }

        const requiredAmount = recipeItem.quantity * item.quantity;
        const currentStock = recipeItem.ingredient.quantity;
        
        console.log('[AutoProduce] Checking', recipeItem.ingredient.name, '- required:', requiredAmount, 'available:', currentStock);
        
        if (currentStock < requiredAmount) {
          insufficientIngredients.push({
            name: recipeItem.ingredient.name,
            required: requiredAmount,
            available: currentStock,
            unit: recipeItem.ingredient.unit
          });
        }
      }

      if (insufficientIngredients.length > 0) {
        const details = insufficientIngredients
          .map(i => `${i.name}: need ${i.required}${i.unit}, have ${i.available}${i.unit}`)
          .join('; ');
        throw new Error(`Insufficient ingredients for ${product.name}: ${details}`);
      }

      // Deduct ingredients from inventory
      for (const recipeItem of recipe.ingredients) {
        if (!recipeItem.ingredient) {
          console.warn('[AutoProduce] Skipping missing ingredient reference in recipe for product:', product.name);
          continue; // Defensive: ingredient referenced in recipe was deleted
        }

        const requiredAmount = recipeItem.quantity * item.quantity;
        const ingredient = recipeItem.ingredient;

        // Double-check availability (extra safety)
        if (ingredient.quantity < requiredAmount) {
          throw new Error(`Insufficient ${ingredient.name}. Available: ${ingredient.quantity}, Required: ${requiredAmount}`);
        }

        ingredient.quantity -= requiredAmount;
        await ingredient.save();
        console.log('[AutoProduce] ✓ Deducted', requiredAmount, 'units of', ingredient.name);

        // Record stock movement for production
        const movement = new StockMovement({
          ingredient: ingredient._id,
          movementType: 'OUT',
          quantity: requiredAmount,
          reference: order.order_number,
          reason: 'production',
          recordedBy: userId,
          notes: `Auto-production for order ${order.order_number} - product ${product.name}`,
          remaining_after: ingredient.quantity
        });
        await movement.save();
      }

      // Create production log
      const productionLog = new ProductionLog({
        product: item.product_id,
        quantity: item.quantity,
        status: 'completed',
        reference: order.order_number,
        producedBy: userId,
        notes: `Auto-produced from order ${order.order_number}`
      });
      await productionLog.save();
      console.log('[AutoProduce] ✓ Created production log for', product.name);

    } catch (itemError) {
      console.error('[AutoProduce] Error producing item:', itemError.message);
      throw itemError;
    }
  }
  
  console.log('[AutoProduce] ✓ All items auto-produced successfully');
}

// Deduct inventory for order
async function deductInventoryForOrder(order, userId, session = null) {
  console.log('[Inventory] Starting deduction for order:', order.order_number);
  
  const deductions = {};
  const consumed = [];

  // Gather ingredient requirements from all order items
  for (const item of order.items) {
    if (!item.product_id) continue;
    console.log('[Inventory] Processing product item:', item.product_id);
    
    const recipe = await Recipe.findOne({ product: item.product_id })
      .populate('ingredients.ingredient');

    if (recipe && recipe.ingredients.length > 0) {
      console.log('[Inventory] Found recipe with', recipe.ingredients.length, 'ingredients');
      
      for (const recipeItem of recipe.ingredients) {
        const ingredientId = recipeItem.ingredient._id.toString();
        const quantityNeeded = recipeItem.quantity * item.quantity;

        if (!deductions[ingredientId]) {
          deductions[ingredientId] = {
            ingredient: recipeItem.ingredient,
            totalQuantity: 0
          };
        }
        deductions[ingredientId].totalQuantity += quantityNeeded;
        console.log('[Inventory] Added', quantityNeeded, 'units of', recipeItem.ingredient.name);
      }
    } else {
      console.log('[Inventory] No recipe found for product:', item.product_id);
    }
  }

  // Apply deductions to inventory
  console.log('[Inventory] Applying', Object.keys(deductions).length, 'ingredient deductions');
  
  for (const [ingredientId, deductionData] of Object.entries(deductions)) {
    const ingredient = await Ingredient.findById(ingredientId);
    
    if (!ingredient) {
      throw new Error(`Ingredient not found: ${ingredientId}`);
    }

    // Check availability
    if (ingredient.quantity < deductionData.totalQuantity) {
      throw new Error(
        `Insufficient ${ingredient.name}. Available: ${ingredient.quantity}, Required: ${deductionData.totalQuantity}`
      );
    }

    // Deduct from inventory
    ingredient.quantity -= deductionData.totalQuantity;
    await ingredient.save();
    console.log('[Inventory] ✓ Deducted', deductionData.totalQuantity, 'units of', ingredient.name);

    // Record stock movement
    const movement = new StockMovement({
      ingredient: ingredientId,
      movementType: 'OUT',
      quantity: deductionData.totalQuantity,
      reference: order.order_number,
      reason: 'production',
      recordedBy: userId,
      notes: `Stock deduction for order ${order.order_number} - customer ${order.customer_name}`,
      remaining_after: ingredient.quantity
    });
    await movement.save();
    console.log('[Inventory] ✓ Recorded movement for', ingredient.name);
    consumed.push({ ingredientId, name: deductionData.ingredient.name, consumed: deductionData.totalQuantity, remaining: ingredient.quantity, unit: deductionData.ingredient.unit });
  }
  
  console.log('[Inventory] ✓ Deduction completed successfully');
  return consumed;
}

async function deductInventoryForOrderAtomic(order, userId, session = null) {
  // Atomic deduction with pre-validation and detailed consumed return
  console.log('[Inventory.Atomic] Starting atomic deduction for order:', order.order_number);
  const deductions = {};

  for (const item of order.items) {
    if (!item.product_id) continue;
    const recipe = await Recipe.findOne({ product: item.product_id }).populate('ingredients.ingredient');
    if (!recipe || recipe.ingredients.length === 0) continue;
    for (const ri of recipe.ingredients) {
      if (!ri.ingredient) {
        console.warn('[Inventory.Atomic] Skipping missing ingredient in recipe for product:', item.product_id);
        continue; // defensive: recipe references deleted ingredient
      }
      const id = ri.ingredient._id.toString();
      const need = ri.quantity * item.quantity;
      if (!deductions[id]) deductions[id] = { ingredient: ri.ingredient, totalQuantity: 0 };
      deductions[id].totalQuantity += need;
    }
  }

  // validate availability
  for (const [id, data] of Object.entries(deductions)) {
    const ing = session ? await Ingredient.findById(id).session(session) : await Ingredient.findById(id);
    if (!ing) throw new Error(`Ingredient not found: ${id}`);
    if (ing.quantity < data.totalQuantity) {
      throw new Error(`Insufficient ${ing.name}. Available: ${ing.quantity}, Required: ${data.totalQuantity}`);
    }
  }

  // apply deductions and record movements
  const consumed = [];
  for (const [id, data] of Object.entries(deductions)) {
    const updated = await Ingredient.findOneAndUpdate(
      { _id: id, quantity: { $gte: data.totalQuantity } },
      { $inc: { quantity: -data.totalQuantity } },
      { new: true, session }
    );
    if (!updated) {
      const latest = session
        ? await Ingredient.findById(id).session(session)
        : await Ingredient.findById(id);
      const error = new Error(
        `Insufficient ${data.ingredient.name}. Available: ${latest?.quantity ?? 0}, Required: ${data.totalQuantity}`
      );
      error.code = 'INSUFFICIENT_STOCK';
      throw error;
    }
    await StockMovement.create([{
      ingredient: id,
      movementType: 'OUT',
      quantity: data.totalQuantity,
      reference: order.order_number,
      reason: 'production',
      recordedBy: userId,
      notes: `Stock deduction for order ${order.order_number}`,
      remaining_after: updated.quantity
    }], { session });

    consumed.push({ ingredientId: id, name: data.ingredient.name, consumed: data.totalQuantity, remaining: updated.quantity, unit: data.ingredient.unit });
  }


  console.log('[Inventory.Atomic] ✓ Completed');
  return consumed;
}

// ===== Checks (Split Bills) =====

// Create a new check for a table order
router.post('/:id/checks', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const deliveryFee = Number(req.body.delivery_fee || 0);
    if (!Number.isFinite(deliveryFee) || deliveryFee < 0) {
      return res.status(400).json({ error: 'Delivery fee must be a non-negative number' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'pending') {
      return res.status(409).json({ error: 'Checks can only be added to pending orders' });
    }
    const checkId = new mongoose.Types.ObjectId();
    const check = {
      _id: checkId,
      type: order.type,
      table_number: order.table_number || null,
      delivery_fee: deliveryFee,
      items: [],
      subtotal: 0,
      total: 0,
      inventory_deducted: !!order.inventory_deducted,
      closedAt: null,
      consumed: []
    };

    order.checks.push(check);
    await order.save();

    return res.json({ check });
  } catch (err) {
    return sendRouteError(res, err);
  }
});

// Move an item (or quantity) from order main items into a check
router.post('/:id/checks/:checkId/add-item', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { product_id, quantity } = req.body;
    const q = Number(quantity);
    if (
      !mongoose.isValidObjectId(req.params.id) ||
      !mongoose.isValidObjectId(req.params.checkId) ||
      !mongoose.isValidObjectId(product_id) ||
      !Number.isInteger(q) ||
      q < 1 ||
      q > 1000
    ) {
      return res.status(400).json({ error: 'Invalid order, check, product, or quantity' });
    }

    // normalize incoming product id (accept string or object with _id)
    const pid = (product_id && (product_id._id || product_id)) ? String(product_id._id || product_id) : String(product_id);

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const check = order.checks.id(req.params.checkId);
    if (!check) return res.status(404).json({ error: 'Check not found' });
    if (order.status !== 'pending' || check.closedAt) {
      return res.status(409).json({ error: 'Items can only be moved to an open check on a pending order' });
    }
    // If parent order already had inventory deducted, ensure check is marked accordingly to avoid double-deduction
    if (order.inventory_deducted) {
      check.inventory_deducted = true;
    }

    // find in order items robustly (handles populated product objects)
    const orderItemIndex = order.items.findIndex(i => {
      const iPid = i.product_id ? (i.product_id._id ? String(i.product_id._id) : String(i.product_id)) : null;
      return iPid === pid;
    });
    if (orderItemIndex === -1) {
      const itemsSnapshot = order.items.map(it => {
        const v = it.product_id && (it.product_id._id || it.product_id);
        return v ? String(v) : null;
      });
      return res.status(404).json({ error: 'Product not found in order items' });
    }

    const orderItem = order.items[orderItemIndex];
    if (orderItem.quantity < q) return res.status(400).json({ error: 'Not enough quantity in order to move' });

    // reduce quantity or remove from order
    order.items[orderItemIndex].quantity -= q;
    if (order.items[orderItemIndex].quantity <= 0) {
      order.items.splice(orderItemIndex, 1);
    }

    // add/update in check items
    const checkItemIndex = check.items.findIndex(i => {
      const cPid = i.product_id ? (i.product_id._id ? String(i.product_id._id) : String(i.product_id)) : null;
      return cPid === pid;
    });
    if (checkItemIndex >= 0) {
      check.items[checkItemIndex].quantity += q;
      check.items[checkItemIndex].subtotal = check.items[checkItemIndex].price * check.items[checkItemIndex].quantity;
    } else {
      check.items.push({
        product_id: orderItem.product_id,
        product_name: orderItem.product_name,
        price: orderItem.price,
        quantity: q,
        subtotal: orderItem.price * q
      });
    }

    // Recompute subtotals and totals for order and check
    const recompute = (items) => items.reduce((s, it) => s + (it.price * it.quantity), 0);
    check.subtotal = recompute(check.items);
    check.total = check.subtotal + (check.delivery_fee || 0);

    order.subtotal = recompute(order.items);
    order.total = order.subtotal + (order.tax || 0) + (order.delivery_fee || 0) - (order.discount || 0);

    await order.save();
    return res.json({ order, check });
  } catch (err) {
    return sendRouteError(res, err);
  }
});

// Close a check (deduct inventory for check items and mark as closed)
router.post('/:id/checks/:checkId/close', verifyToken, requireRole('admin'), async (req, res) => {
  let session;

  try {
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.checkId)) {
      return res.status(400).json({ error: 'Invalid order or check ID' });
    }

    session = await mongoose.startSession();
    session.startTransaction();
    const order = await Order.findById(req.params.id).session(session);
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Order not found' });
    }
    const check = order.checks.id(req.params.checkId);
    if (!check) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Check not found' });
    }
    if (order.status !== 'pending') {
      await session.abortTransaction();
      return res.status(409).json({ error: 'Checks can only be closed on pending orders' });
    }

    // If this check's inventory was already deducted (e.g., parent order had deduction), just close it without re-deducting
    if (check.inventory_deducted) {
      check.closedAt = new Date();
      await order.save({ session });
      await session.commitTransaction();
      return res.json({ check, consumed: check.consumed || [] });
    }

    const pseudoOrder = {
      order_number: `${order.order_number}-CHK-${check._id}`,
      items: check.items
    };

    // use existing atomic deduction helper
    const consumed = await deductInventoryForOrderAtomic(pseudoOrder, req.userId, session);

    // mark check as deducted and closed
    check.inventory_deducted = true;
    check.closedAt = new Date();
    check.consumed = consumed;

    await order.save({ session });
    await session.commitTransaction();

    return res.json({ check, consumed });
  } catch (err) {
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }
    return sendRouteError(res, err);
  } finally {
    if (session) {
      await session.endSession();
    }
  }
});

// DELETE order - Only Admin
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  console.log('[Order DELETE] Attempting to delete:', req.params.id);
  
  try {
    const order = await Order.findByIdAndDelete(req.params.id);

    if (!order) {
      console.warn('[Order DELETE] Order not found:', req.params.id);
      return res.status(404).json({ error: 'Order not found' });
    }

    console.log('[Order DELETE] ✓ Successfully deleted:', order._id, 'number:', order.order_number);
    res.json({ message: 'Order deleted', order });
  } catch (error) {
    sendRouteError(res, error);
  }
});

export default router;
