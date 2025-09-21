const express = require('express');
const { body, validationResult, query } = require('express-validator');
const User = require('../models/User');
const Camera = require('../models/Camera');
const Shelf = require('../models/Shelf');
const Product = require('../models/Product');
const Image = require('../models/Image');
const StockLevel = require('../models/StockLevel');
const Alert = require('../models/Alert');

const router = express.Router();

// GET /api/cv/products - Get all products
router.get('/products', async (req, res) => {
  try {
    const products = await Product.find({ isActive: true }).sort({ name: 1 });
    res.json({
      success: true,
      data: products.map(product => product.getProductInfo())
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/cv/products/:id - Get product by ID
router.get('/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      data: product.getProductInfo()
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/cv/shelves - Get all shelves
router.get('/shelves', async (req, res) => {
  try {
    const shelves = await Shelf.find({ isActive: true })
      .populate('cameraId', 'name location status')
      .sort({ shelfName: 1 });
    
    res.json({
      success: true,
      data: shelves.map(shelf => ({
        ...shelf.getShelfInfo(),
        camera: shelf.cameraId
      }))
    });
  } catch (error) {
    console.error('Error fetching shelves:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/cv/cameras - Get all cameras
router.get('/cameras', async (req, res) => {
  try {
    const cameras = await Camera.find({ isActive: true }).sort({ name: 1 });
    res.json({
      success: true,
      data: cameras.map(camera => camera.getCameraInfo())
    });
  } catch (error) {
    console.error('Error fetching cameras:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/cv/stock/current - Get current stock levels
router.get('/stock/current', [
  query('productId').optional(),
  query('shelfId').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId, shelfId } = req.query;
    const matchStage = { isActive: true };
    
    if (productId) matchStage.productId = productId;
    if (shelfId) matchStage.shelfId = shelfId;

    // Get latest stock level for each shelf-product combination
    const pipeline = [
      { $match: matchStage },
      { $sort: { shelfId: 1, productId: 1, timestamp: -1 } },
      {
        $group: {
          _id: { shelfId: '$shelfId', productId: '$productId' },
          latestStock: { $first: '$stockPercentage' },
          latestCount: { $first: '$stockCount' },
          latestTimestamp: { $first: '$timestamp' },
          confidence: { $first: '$confidence' },
          detectionMethod: { $first: '$detectionMethod' },
          shelfId: { $first: '$shelfId' },
          productId: { $first: '$productId' }
        }
      },
      {
        $lookup: {
          from: 'shelves',
          localField: 'shelfId',
          foreignField: '_id',
          as: 'shelf'
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      {
        $unwind: '$shelf'
      },
      {
        $unwind: '$product'
      },
      {
        $sort: { 'shelf.shelfName': 1, 'product.name': 1 }
      }
    ];

    const stockLevels = await StockLevel.aggregate(pipeline);
    
    res.json({
      success: true,
      data: stockLevels.map(stock => ({
        stockId: stock._id,
        shelfId: stock.shelfId,
        productId: stock.productId,
        shelfName: stock.shelf.shelfName,
        productName: stock.product.name,
        stockPercentage: stock.latestStock,
        stockCount: stock.latestCount,
        confidence: stock.confidence,
        detectionMethod: stock.detectionMethod,
        lastUpdated: stock.latestTimestamp
      }))
    });
  } catch (error) {
    console.error('Error fetching current stock:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/cv/stock/history - Get stock history
router.get('/stock/history', [
  query('productId').optional(),
  query('shelfId').optional(),
  query('startTime').optional(),
  query('endTime').optional(),
  query('granularity').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId, shelfId, startTime, endTime, granularity = '1h' } = req.query;
    
    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'productId is required'
      });
    }

    let timeSeriesData;
    
    if (shelfId && shelfId !== 'all') {
      // Get data for specific shelf
      timeSeriesData = await StockLevel.getTimeSeriesData(
        shelfId, 
        productId, 
        startTime, 
        endTime, 
        granularity
      );
    } else {
      // Get aggregated data for all shelves with this product
      const matchStage = { productId, isActive: true };
      
      // Add date filters if provided
      if (startTime || endTime) {
        matchStage.timestamp = {};
        if (startTime) matchStage.timestamp.$gte = new Date(startTime);
        if (endTime) matchStage.timestamp.$lte = new Date(endTime);
      }

      // For now, let's return raw data instead of aggregated data
      // This will work better with the existing data structure
      timeSeriesData = await StockLevel.find(matchStage)
        .populate('shelfId', 'shelfName')
        .populate('productId', 'name')
        .sort({ timestamp: 1 })
        .limit(100); // Limit to prevent too much data
      
      // Format the data for the frontend
      timeSeriesData = timeSeriesData.map(record => ({
        timestamp: record.timestamp,
        stockPercentage: record.stockPercentage,
        stockCount: record.stockCount,
        confidence: record.confidence,
        shelfName: record.shelfId?.shelfName,
        productName: record.productId?.name
      }));
    }

    res.json({
      success: true,
      data: timeSeriesData
    });
  } catch (error) {
    console.error('Error fetching stock history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/cv/alerts - Get alerts
router.get('/alerts', [
  query('type').optional(),
  query('severity').optional(),
  query('acknowledged').optional(),
  query('resolved').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { type, severity, acknowledged, resolved } = req.query;
    const matchStage = {};
    
    if (type) matchStage.alertType = type;
    if (severity) matchStage.severity = severity;
    if (acknowledged !== undefined) matchStage.acknowledged = acknowledged === 'true';
    if (resolved !== undefined) matchStage.resolved = resolved === 'true';

    const alerts = await Alert.find(matchStage)
      .populate('stockId', 'shelfId productId stockPercentage timestamp')
      .populate('acknowledgedBy', 'username email')
      .populate('resolvedBy', 'username email')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      data: alerts.map(alert => alert.getAlertInfo())
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/cv/alerts/:id/acknowledge - Acknowledge alert
router.post('/alerts/:id/acknowledge', [
  body('userId').notEmpty().withMessage('User ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.body;
    const alert = await Alert.findById(req.params.id);
    
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    await alert.acknowledge(userId);
    
    res.json({
      success: true,
      data: alert.getAlertInfo()
    });
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/cv/dashboard - Get dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    const [
      totalProducts,
      totalShelves,
      totalCameras,
      activeAlerts,
      lowStockItems,
      recentStockLevels
    ] = await Promise.all([
      Product.countDocuments({ isActive: true }),
      Shelf.countDocuments({ isActive: true }),
      Camera.countDocuments({ isActive: true, status: 'online' }),
      Alert.countDocuments({ acknowledged: false, resolved: false }),
      StockLevel.detectLowStock(20),
      StockLevel.find({ isActive: true })
        .populate('shelfId', 'shelfName')
        .populate('productId', 'name')
        .sort({ timestamp: -1 })
        .limit(10)
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          totalProducts,
          totalShelves,
          totalCameras,
          activeAlerts
        },
        lowStockItems: lowStockItems.length,
        recentActivity: recentStockLevels.map(stock => ({
          shelfName: stock.shelfId?.shelfName,
          productName: stock.productId?.name,
          stockPercentage: stock.stockPercentage,
          timestamp: stock.timestamp
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/cv/seed - Seed computer vision data
router.post('/seed', async (req, res) => {
  try {
    const seedComputerVisionData = require('../scripts/seedComputerVisionData');
    await seedComputerVisionData();
    
    res.json({
      success: true,
      message: 'Computer vision data seeded successfully'
    });
  } catch (error) {
    console.error('Error seeding computer vision data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
