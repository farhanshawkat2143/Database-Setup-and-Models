const express = require('express');
const { body, validationResult, query } = require('express-validator');
const StockHistory = require('../models/StockHistory');
const StockTimeSeries = require('../models/StockTimeSeries');
const stockAnalysisService = require('../services/stockAnalysisService');
const seedDatabase = require('../scripts/seedDatabase');

const router = express.Router();

// POST /api/stocks/update - Record a new stock change
router.post('/update', [
  body('productId').notEmpty().withMessage('Product ID is required'),
  body('change').isNumeric().withMessage('Change must be a number'),
  body('reason').isIn(['restock', 'sale', 'adjustment']).withMessage('Reason must be restock, sale, or adjustment')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId, change, reason } = req.body;
    
    const stockRecord = await StockHistory.recordStockChange(productId, change, reason);
    
    // Broadcast real-time update to SSE clients
    broadcastToSSEClients({
      type: 'stock_change',
      productId: productId,
      change: change,
      newStockLevel: stockRecord.stockLevel,
      reason: reason,
      timestamp: stockRecord.timestamp
    });
    
    res.status(201).json({
      success: true,
      data: stockRecord,
      message: 'Stock change recorded successfully'
    });
  } catch (error) {
    console.error('Error recording stock change:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/stocks/history - Get historical data with aggregation
router.get('/history', [
  query('productId').notEmpty().withMessage('Product ID is required'),
  query('from').optional().isISO8601().withMessage('From date must be valid ISO8601 format'),
  query('to').optional().isISO8601().withMessage('To date must be valid ISO8601 format'),
  query('period').optional().isIn(['daily', 'weekly', 'monthly', 'quarterly']).withMessage('Period must be daily, weekly, monthly, or quarterly')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId, from, to, period = 'daily' } = req.query;
    
    const historicalData = await stockAnalysisService.getHistoricalData(productId, from, to, period);
    
    res.json({
      success: true,
      data: historicalData,
      productId,
      period,
      dateRange: { from, to }
    });
  } catch (error) {
    console.error('Error fetching historical data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/stocks/trend - Get trend analysis with moving average
router.get('/trend', [
  query('productId').notEmpty().withMessage('Product ID is required'),
  query('period').optional().isIn(['daily', 'weekly', 'monthly']).withMessage('Period must be daily, weekly, or monthly'),
  query('window').optional().isInt({ min: 1 }).withMessage('Window must be a positive integer')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId, period = 'daily', window = 7 } = req.query;
    
    const trendData = await stockAnalysisService.getTrendAnalysis(productId, period, parseInt(window));
    
    res.json({
      success: true,
      data: trendData,
      productId,
      period,
      window: parseInt(window)
    });
  } catch (error) {
    console.error('Error fetching trend analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/stocks/restock-pattern - Analyze restocking patterns
router.get('/restock-pattern', [
  query('productId').notEmpty().withMessage('Product ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId } = req.query;
    
    const patternData = await stockAnalysisService.analyzeRestockPattern(productId);
    
    res.json({
      success: true,
      data: patternData,
      productId
    });
  } catch (error) {
    console.error('Error analyzing restock pattern:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/stocks/current - Get current stock level for a product
router.get('/current', [
  query('productId').notEmpty().withMessage('Product ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId } = req.query;
    
    // Try to get from time-series first, fallback to old model
    let currentStock = 0;
    let lastUpdated = new Date();
    
    try {
      const latestRecord = await StockTimeSeries.findOne(
        { productId },
        {},
        { sort: { timestamp: -1 } }
      );
      
      if (latestRecord) {
        currentStock = latestRecord.stockLevel;
        lastUpdated = latestRecord.timestamp;
      } else {
        // Fallback to old model
        currentStock = await StockHistory.getLatestStockLevel(productId);
      }
    } catch (error) {
      console.log('Time-series not available, using fallback');
      currentStock = await StockHistory.getLatestStockLevel(productId);
    }
    
    res.json({
      success: true,
      data: {
        productId,
        currentStockLevel: currentStock,
        lastUpdated: lastUpdated
      }
    });
  } catch (error) {
    console.error('Error fetching current stock:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/stocks/seed - Seed sample data
router.post('/seed', async (req, res) => {
  try {
    await seedDatabase();
    res.json({
      success: true,
      message: 'Sample data seeded successfully'
    });
  } catch (error) {
    console.error('Error seeding database:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /api/stocks/clear - Clear all data
router.delete('/clear', async (req, res) => {
  try {
    const result = await StockHistory.deleteMany({});
    res.json({
      success: true,
      message: `Cleared ${result.deletedCount} records`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error clearing database:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/stocks/stats - Get database statistics
router.get('/stats', async (req, res) => {
  try {
    const totalRecords = await StockHistory.countDocuments();
    const products = await StockHistory.distinct('productId');
    const reasons = await StockHistory.aggregate([
      { $group: { _id: '$reason', count: { $sum: 1 } } }
    ]);
    
    res.json({
      success: true,
      data: {
        totalRecords,
        uniqueProducts: products.length,
        products,
        reasonBreakdown: reasons
      }
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/stocks/events - Server-Sent Events for real-time updates
router.get('/events', (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send initial connection message
  res.write('data: {"type": "connected", "message": "Real-time updates connected"}\n\n');

  // Keep connection alive with periodic heartbeat
  const heartbeat = setInterval(() => {
    res.write('data: {"type": "heartbeat", "timestamp": "' + new Date().toISOString() + '"}\n\n');
  }, 30000); // Every 30 seconds

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    console.log('SSE client disconnected');
  });

  // Store the response object for broadcasting updates
  if (!global.sseClients) {
    global.sseClients = [];
  }
  global.sseClients.push(res);

  console.log('SSE client connected. Total clients:', global.sseClients.length);
});

// Helper function to broadcast to all SSE clients
function broadcastToSSEClients(data) {
  if (global.sseClients) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    global.sseClients = global.sseClients.filter(client => {
      try {
        client.write(message);
        return true;
      } catch (error) {
        console.log('SSE client disconnected (error)');
        return false;
      }
    });
  }
}

module.exports = router;
