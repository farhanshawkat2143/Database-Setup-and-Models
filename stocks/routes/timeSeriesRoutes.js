const express = require('express');
const { body, validationResult, query } = require('express-validator');
const StockTimeSeries = require('../models/StockTimeSeries');
const StockLevel = require('../models/StockLevel');
const timeSeriesAnalysisService = require('../services/timeSeriesAnalysisService');

const router = express.Router();

// POST /api/timeseries/record - Record a time-series data point
router.post('/record', [
  body('productId').notEmpty().withMessage('Product ID is required'),
  body('change').isNumeric().withMessage('Change must be a number'),
  body('reason').isIn(['restock', 'sale', 'adjustment', 'return', 'damage']).withMessage('Invalid reason'),
  body('timestamp').optional().isISO8601().withMessage('Timestamp must be valid ISO8601 format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId, change, reason, timestamp = new Date(), location = 'warehouse' } = req.body;
    
    // Get current stock level
    const latestRecord = await StockTimeSeries.findOne(
      { productId },
      {},
      { sort: { timestamp: -1 } }
    );
    
    const currentStockLevel = latestRecord ? latestRecord.stockLevel : 0;
    const newStockLevel = Math.max(0, currentStockLevel + change);
    
    // Calculate velocity and acceleration
    const velocity = latestRecord ? change : 0;
    const acceleration = latestRecord && latestRecord.velocity !== undefined ? 
      change - latestRecord.velocity : 0;
    
    const timeSeriesRecord = new StockTimeSeries({
      timestamp: new Date(timestamp),
      productId,
      location,
      stockLevel: newStockLevel,
      change,
      reason,
      velocity,
      acceleration
    });
    
    const savedRecord = await timeSeriesRecord.save();
    
    // Broadcast real-time update
    if (global.sseClients) {
      const message = `data: ${JSON.stringify({
        type: 'timeseries_update',
        productId: productId,
        change: change,
        newStockLevel: newStockLevel,
        reason: reason,
        timestamp: savedRecord.timestamp,
        velocity: velocity,
        acceleration: acceleration
      })}\n\n`;
      
      global.sseClients = global.sseClients.filter(client => {
        try {
          client.write(message);
          return true;
        } catch (error) {
          return false;
        }
      });
    }
    
    res.status(201).json({
      success: true,
      data: savedRecord,
      message: 'Time-series data recorded successfully'
    });
  } catch (error) {
    console.error('Error recording time-series data:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/timeseries/data - Get time-series data with advanced aggregation
router.get('/data', [
  query('productId').notEmpty().withMessage('Product ID is required'),
  query('startTime').optional().isISO8601().withMessage('Start time must be valid ISO8601 format'),
  query('endTime').optional().isISO8601().withMessage('End time must be valid ISO8601 format'),
  query('granularity').optional().isIn(['1m', '5m', '15m', '1h', '1d', '1w', '1M']).withMessage('Invalid granularity'),
  query('includeMetrics').optional().isBoolean().withMessage('Include metrics must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      productId, 
      startTime, 
      endTime, 
      granularity = '1h',
      includeMetrics = false 
    } = req.query;
    
    const data = await StockTimeSeries.getTimeSeriesData(
      productId, 
      startTime || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default: 30 days ago
      endTime || new Date(),
      granularity
    );
    
    let metrics = null;
    if (includeMetrics === 'true') {
      metrics = await timeSeriesAnalysisService.calculateAdvancedMetrics(productId, startTime, endTime);
    }
    
    res.json({
      success: true,
      data: {
        timeSeries: data,
        metrics: metrics,
        metadata: {
          productId,
          granularity,
          dataPoints: data.length,
          timeRange: {
            start: startTime || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            end: endTime || new Date()
          }
        }
      }
    });
  } catch (error) {
    console.error('Error fetching time-series data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/timeseries/trend - Advanced trend analysis
router.get('/trend', [
  query('productId').notEmpty().withMessage('Product ID is required'),
  query('startTime').optional().isISO8601().withMessage('Start time must be valid ISO8601 format'),
  query('endTime').optional().isISO8601().withMessage('End time must be valid ISO8601 format'),
  query('method').optional().isIn(['linear', 'polynomial', 'exponential', 'moving_average']).withMessage('Invalid trend method')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      productId, 
      startTime, 
      endTime, 
      method = 'linear' 
    } = req.query;
    
    // Try StockTimeSeries first
    let trendAnalysis = await timeSeriesAnalysisService.analyzeTrend(
      productId, 
      startTime || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endTime || new Date(),
      method
    );
    
    // If insufficient data in StockTimeSeries, try StockLevel
    if (trendAnalysis.trend === 'insufficient_data') {
      console.log('StockTimeSeries has insufficient data, trying StockLevel...');
      
      // Get data from StockLevel model
      const stockLevelData = await StockLevel.find({
        productId: productId,
        isActive: true,
        timestamp: {
          $gte: new Date(startTime || Date.now() - 30 * 24 * 60 * 60 * 1000),
          $lte: new Date(endTime || Date.now())
        }
      }).sort({ timestamp: 1 });
      
      if (stockLevelData.length >= 3) {
        // Convert StockLevel data to time-series format and analyze
        const timeSeriesData = stockLevelData.map(record => ({
          timestamp: record.timestamp,
          stockLevel: record.stockPercentage,
          change: 0 // We don't have change data in StockLevel
        }));
        
        // Perform simple linear regression
        const n = timeSeriesData.length;
        if (n >= 3) {
          const xValues = timeSeriesData.map((_, index) => index);
          const yValues = timeSeriesData.map(d => d.stockLevel);
          
          const sumX = xValues.reduce((a, b) => a + b, 0);
          const sumY = yValues.reduce((a, b) => a + b, 0);
          const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
          const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);
          
          const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
          const intercept = (sumY - slope * sumX) / n;
          
          // Calculate R-squared
          const yMean = sumY / n;
          const ssRes = yValues.reduce((sum, y, i) => {
            const predicted = slope * xValues[i] + intercept;
            return sum + Math.pow(y - predicted, 2);
          }, 0);
          const ssTot = yValues.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
          const r2 = 1 - (ssRes / ssTot);
          
          let trend = 'stable';
          if (Math.abs(slope) > 0.1) {
            trend = slope > 0 ? 'increasing' : 'decreasing';
          }
          
          trendAnalysis = {
            method: method,
            trend: trend,
            slope: slope,
            intercept: intercept,
            r2: r2,
            confidence: Math.min(r2, 1),
            dataPoints: n
          };
        }
      }
    }
    
    res.json({
      success: true,
      data: trendAnalysis
    });
  } catch (error) {
    console.error('Error analyzing trend:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/timeseries/cycles - Cycle detection analysis
router.get('/cycles', [
  query('productId').notEmpty().withMessage('Product ID is required'),
  query('startTime').optional().isISO8601().withMessage('Start time must be valid ISO8601 format'),
  query('endTime').optional().isISO8601().withMessage('End time must be valid ISO8601 format'),
  query('maxPeriod').optional().isInt({ min: 1, max: 365 }).withMessage('Max period must be between 1 and 365')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      productId, 
      startTime, 
      endTime, 
      maxPeriod = 30 
    } = req.query;
    
    // Skip StockTimeSeries and go directly to StockLevel since our data is there
    console.log('Using StockLevel data for cycle detection...');
    
    // Get data from StockLevel model
    const stockLevelData = await StockLevel.find({
      productId: productId,
      isActive: true,
      timestamp: {
        $gte: new Date(startTime || Date.now() - 90 * 24 * 60 * 60 * 1000),
        $lte: new Date(endTime || Date.now())
      }
    }).sort({ timestamp: 1 });
    
    let cycleAnalysis = { cycles: [], confidence: 0, method: 'autocorrelation', dataPoints: 0 };
    
    if (stockLevelData.length >= 20) {
      // Perform autocorrelation analysis on StockLevel data
      const stockValues = stockLevelData.map(record => record.stockPercentage);
      const cycles = [];
      
      // Simple autocorrelation analysis
      for (let lag = 1; lag <= Math.min(parseInt(maxPeriod), Math.floor(stockValues.length / 4)); lag++) {
        let correlation = 0;
        let count = 0;
        
        for (let i = 0; i < stockValues.length - lag; i++) {
          correlation += stockValues[i] * stockValues[i + lag];
          count++;
        }
        
        if (count > 0) {
          correlation /= count;
          
          // Normalize correlation
          const mean = stockValues.reduce((a, b) => a + b, 0) / stockValues.length;
          const variance = stockValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / stockValues.length;
          const normalizedCorrelation = correlation / variance;
          
          // If correlation is significant, it might indicate a cycle
          if (Math.abs(normalizedCorrelation) > 0.2) { // Lowered threshold
            cycles.push({
              period: lag,
              strength: Math.abs(normalizedCorrelation),
              confidence: Math.min(Math.abs(normalizedCorrelation), 1)
            });
          }
        }
      }
      
      // Sort cycles by strength
      cycles.sort((a, b) => b.strength - a.strength);
      
      // Take top 3 cycles
      const topCycles = cycles.slice(0, 3);
      
      cycleAnalysis = {
        cycles: topCycles,
        confidence: topCycles.length > 0 ? topCycles[0].confidence : 0,
        method: 'autocorrelation',
        dataPoints: stockValues.length
      };
    }
    
    res.json({
      success: true,
      data: cycleAnalysis
    });
  } catch (error) {
    console.error('Error detecting cycles:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/timeseries/anomalies - Anomaly detection
router.get('/anomalies', [
  query('productId').notEmpty().withMessage('Product ID is required'),
  query('startTime').optional().isISO8601().withMessage('Start time must be valid ISO8601 format'),
  query('endTime').optional().isISO8601().withMessage('End time must be valid ISO8601 format'),
  query('threshold').optional().isFloat({ min: 1, max: 5 }).withMessage('Threshold must be between 1 and 5')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      productId, 
      startTime, 
      endTime, 
      threshold = 2 
    } = req.query;
    
    const anomalyAnalysis = await StockTimeSeries.detectAnomalies(
      productId, 
      startTime || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endTime || new Date(),
      parseFloat(threshold)
    );
    
    res.json({
      success: true,
      data: anomalyAnalysis
    });
  } catch (error) {
    console.error('Error detecting anomalies:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/timeseries/forecast - Forecasting
router.get('/forecast', [
  query('productId').notEmpty().withMessage('Product ID is required'),
  query('horizon').optional().isInt({ min: 1, max: 30 }).withMessage('Horizon must be between 1 and 30'),
  query('method').optional().isIn(['arima', 'exponential_smoothing', 'linear_trend']).withMessage('Invalid forecast method')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      productId, 
      horizon = 7, 
      method = 'linear_trend' 
    } = req.query;
    
    const forecast = await timeSeriesAnalysisService.generateForecast(
      productId, 
      parseInt(horizon),
      method
    );
    
    res.json({
      success: true,
      data: forecast
    });
  } catch (error) {
    console.error('Error generating forecast:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/timeseries/moving-average - Moving average analysis
router.get('/moving-average', [
  query('productId').notEmpty().withMessage('Product ID is required'),
  query('window').optional().isInt({ min: 2, max: 100 }).withMessage('Window must be between 2 and 100'),
  query('startTime').optional().isISO8601().withMessage('Start time must be valid ISO8601 format'),
  query('endTime').optional().isISO8601().withMessage('End time must be valid ISO8601 format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      productId, 
      window = 7, 
      startTime, 
      endTime 
    } = req.query;
    
    const movingAverageData = await StockTimeSeries.calculateMovingAverage(
      productId, 
      parseInt(window),
      startTime || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endTime || new Date()
    );
    
    res.json({
      success: true,
      data: {
        movingAverage: movingAverageData,
        window: parseInt(window),
        metadata: {
          productId,
          dataPoints: movingAverageData.length
        }
      }
    });
  } catch (error) {
    console.error('Error calculating moving average:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/timeseries/statistics - Comprehensive statistics
router.get('/statistics', [
  query('productId').notEmpty().withMessage('Product ID is required'),
  query('startTime').optional().isISO8601().withMessage('Start time must be valid ISO8601 format'),
  query('endTime').optional().isISO8601().withMessage('End time must be valid ISO8601 format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      productId, 
      startTime, 
      endTime 
    } = req.query;
    
    const statistics = await timeSeriesAnalysisService.calculateComprehensiveStatistics(
      productId, 
      startTime || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endTime || new Date()
    );
    
    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Error calculating statistics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
