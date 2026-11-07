import express from 'express';
import Ingredient from '../models/Ingredient.js';
import Product from '../models/Product.js';
import StockMovement from '../models/StockMovement.js';
import ProductionLog from '../models/ProductionLog.js';
import Order from '../models/Order.js';
import { verifyToken } from '../middleware/auth.js';
import { sendRouteError } from '../middleware/routeError.js';

const router = express.Router();

// GET ingredient consumption report
router.get('/consumption', verifyToken, async (req, res) => {
  const { startDate, endDate } = req.query;

  console.log('[Report CONSUMPTION] Fetching consumption report:', { startDate, endDate });

  try {
    // Validate date parameters if provided
    if (startDate) {
      const start = new Date(startDate);
      if (isNaN(start.getTime())) {
        console.warn('[Report CONSUMPTION] Invalid startDate format');
        return res.status(400).json({ error: 'Invalid startDate format. Use ISO 8601 (YYYY-MM-DD)' });
      }
    }
    if (endDate) {
      const end = new Date(endDate);
      if (isNaN(end.getTime())) {
        console.warn('[Report CONSUMPTION] Invalid endDate format');
        return res.status(400).json({ error: 'Invalid endDate format. Use ISO 8601 (YYYY-MM-DD)' });
      }
    }

    const matchStage = { movementType: { $in: ['IN', 'OUT'] } };

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const result = await StockMovement.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$ingredient',
          consumed: {
            $sum: {
              $cond: [{ $eq: ['$movementType', 'OUT'] }, '$quantity', 0]
            }
          },
          added: {
            $sum: {
              $cond: [{ $eq: ['$movementType', 'IN'] }, '$quantity', 0]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'ingredients',
          localField: '_id',
          foreignField: '_id',
          as: 'ingredientDetails'
        }
      },
      {
        $unwind: '$ingredientDetails'
      },
      {
        $project: {
          _id: 0,
          id: '$_id',
          name: '$ingredientDetails.name',
          unit: '$ingredientDetails.unit',
          consumed: 1,
          added: 1
        }
      },
      { $sort: { consumed: -1 } }
    ]);

    console.log('[Report CONSUMPTION] ✓ Generated report for', result.length, 'ingredients');
    res.json(result);
  } catch (error) {
    console.error('[Report CONSUMPTION] ✗ Error:', error.message);
    sendRouteError(res, error);
  }
});

// GET product usage report
router.get('/product-usage', verifyToken, async (req, res) => {
  const { startDate, endDate } = req.query;

  console.log('[Report PRODUCT_USAGE] Fetching product usage report:', { startDate, endDate });

  try {
    // Validate date parameters if provided
    if (startDate) {
      const start = new Date(startDate);
      if (isNaN(start.getTime())) {
        console.warn('[Report PRODUCT_USAGE] Invalid startDate format');
        return res.status(400).json({ error: 'Invalid startDate format. Use ISO 8601 (YYYY-MM-DD)' });
      }
    }
    if (endDate) {
      const end = new Date(endDate);
      if (isNaN(end.getTime())) {
        console.warn('[Report PRODUCT_USAGE] Invalid endDate format');
        return res.status(400).json({ error: 'Invalid endDate format. Use ISO 8601 (YYYY-MM-DD)' });
      }
    }

    const matchStage = {};

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const result = await ProductionLog.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$product',
          times_produced: { $sum: 1 },
          total_quantity: { $sum: '$quantity' }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      {
        $unwind: '$productDetails'
      },
      {
        $project: {
          _id: 0,
          id: '$_id',
          name: '$productDetails.name',
          times_produced: 1,
          total_quantity: 1
        }
      },
      { $sort: { total_quantity: -1 } }
    ]);

    console.log('[Report PRODUCT_USAGE] ✓ Generated report for', result.length, 'products');
    res.json(result);
  } catch (error) {
    console.error('[Report PRODUCT_USAGE] ✗ Error:', error.message);
    sendRouteError(res, error);
  }
});

// GET stock status report
router.get('/stock-status', verifyToken, async (req, res) => {
  try {
    console.log('[Report STOCK_STATUS] Generating stock status report');

    const ingredients = await Ingredient.find();

    const result = ingredients.map(ing => {
      let status = 'OK';
      if (ing.quantity <= ing.reorderLevel) {
        status = 'LOW';
      } else if (ing.quantity > ing.reorderLevel * 2) {
        status = 'GOOD';
      }

      return {
        id: ing._id,
        name: ing.name,
        unit: ing.unit,
        quantity: ing.quantity,
        reorderLevel: ing.reorderLevel,
        status
      };
    }).sort((a, b) => {
      const statusOrder = { LOW: 0, OK: 1, GOOD: 2 };
      return statusOrder[a.status] - statusOrder[b.status] || a.quantity - b.quantity;
    });

    console.log('[Report STOCK_STATUS] ✓ Generated report for', result.length, 'ingredients');
    console.log('[Report STOCK_STATUS] Status breakdown:', {
      LOW: result.filter(r => r.status === 'LOW').length,
      OK: result.filter(r => r.status === 'OK').length,
      GOOD: result.filter(r => r.status === 'GOOD').length
    });

    res.json(result);
  } catch (error) {
    console.error('[Report STOCK_STATUS] ✗ Error:', error.message);
    sendRouteError(res, error);
  }
});

// GET sales by receipt type report (Takeaway, Delivery, Table)
router.get('/sales-by-receipt-type', verifyToken, async (req, res) => {
  try {
    console.log('[Report SALES_BY_TYPE] Generating sales by receipt type report');

    const result = await Order.aggregate([
      {
        $group: {
          _id: '$type',
          orders_count: { $sum: 1 },
          total_amount: { $sum: '$total' }
        }
      },
      {
        $project: {
          _id: 0,
          type: '$_id',
          orders_count: 1,
          total_amount: 1
        }
      }
    ]);

    return res.json(result);
  } catch (error) {
    console.error('[Report SALES_BY_TYPE] ✗ Error:', error.message);
    return sendRouteError(res, error);
  }
});

export default router;
