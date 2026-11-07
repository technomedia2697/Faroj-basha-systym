import express from 'express';
import Ingredient from '../models/Ingredient.js';
import Product from '../models/Product.js';
import StockMovement from '../models/StockMovement.js';
import { verifyToken } from '../middleware/auth.js';
import { sendRouteError } from '../middleware/routeError.js';

const router = express.Router();

// GET dashboard summary
router.get('/summary', verifyToken, async (req, res) => {
  try {

    // Total ingredients count
    const totalIngredients = await Ingredient.countDocuments();
    console.log('[Dashboard SUMMARY] Total ingredients:', totalIngredients);

    // Low stock alerts
    const lowStockAlerts = await Ingredient.find({
      $expr: { $lte: ['$quantity', '$reorderLevel'] }
    }).sort({ quantity: 1 }).limit(20);
    console.log('[Dashboard SUMMARY] Low stock alerts found:', lowStockAlerts.length);

    // Most consumed ingredients (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const mostConsumed = await StockMovement.aggregate([
      {
        $match: {
          movementType: 'OUT',
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: '$ingredient',
          total_consumed: { $sum: '$quantity' }
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
          ingredient_id: '$_id',
          name: '$ingredientDetails.name',
          unit: '$ingredientDetails.unit',
          total_consumed: 1
        }
      },
      { $sort: { total_consumed: -1 } },
      { $limit: 10 }
    ]);
    console.log('[Dashboard SUMMARY] Most consumed ingredients (last 30 days):', mostConsumed.length);

    // Total active products
    const totalProducts = await Product.countDocuments({ isActive: true });
    console.log('[Dashboard SUMMARY] Active products:', totalProducts);

    console.log('[Dashboard SUMMARY] ✓ Successfully fetched all dashboard data');
    res.json({
      total_ingredients: totalIngredients,
      low_stock_alerts: lowStockAlerts,
      most_consumed_ingredients: mostConsumed,
      total_products: totalProducts
    });
  } catch (error) {
    console.error('[Dashboard SUMMARY] ✗ Error:', error.message);
    sendRouteError(res, error);
  }
});

// GET consumption chart data
router.get('/consumption-chart', verifyToken, async (req, res) => {
  try {
    console.log('[Dashboard CONSUMPTION] Fetching consumption chart data');

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const result = await StockMovement.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          movements: { $sum: 1 },
          consumed: {
            $sum: {
              $cond: [{ $eq: ['$movementType', 'OUT'] }, '$quantity', 0]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          movements: 1,
          consumed: 1
        }
      },
      { $sort: { 'date': 1 } }
    ]);

    console.log('[Dashboard CONSUMPTION] ✓ Found data for', result.length, 'days');
    res.json(result || []);
  } catch (error) {
    console.error('[Dashboard CONSUMPTION] ✗ Error:', error.message);
    sendRouteError(res, error);
  }
});

export default router;
