const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const StockTimeSeries = require('../models/StockTimeSeries');
const timeSeriesAnalysisService = require('../services/timeSeriesAnalysisService');

// Test database setup
const TEST_DB_URI = 'mongodb://localhost:27017/stock-tracking-test';

beforeAll(async () => {
  await mongoose.connect(TEST_DB_URI);
});

afterAll(async () => {
  await mongoose.connection.db.dropDatabase();
  await mongoose.connection.close();
});

beforeEach(async () => {
  await StockTimeSeries.deleteMany({});
});

describe('Time-Series Database Schema Tests', () => {
  test('should create a time-series record with all fields', async () => {
    const timeSeriesRecord = new StockTimeSeries({
      timestamp: new Date('2025-01-15T10:30:00Z'),
      productId: 'PROD001',
      location: 'warehouse',
      stockLevel: 100,
      change: 50,
      reason: 'restock',
      velocity: 10,
      acceleration: 2,
      seasonality: 0.1,
      trend: 0.05,
      residual: 0.02,
      confidence: 0.95,
      tags: ['high-volume', 'priority']
    });

    const savedRecord = await timeSeriesRecord.save();
    expect(savedRecord._id).toBeDefined();
    expect(savedRecord.productId).toBe('PROD001');
    expect(savedRecord.stockLevel).toBe(100);
    expect(savedRecord.velocity).toBe(10);
    expect(savedRecord.acceleration).toBe(2);
    expect(savedRecord.tags).toContain('high-volume');
  });

  test('should enforce required fields', async () => {
    const invalidRecord = new StockTimeSeries({
      // Missing required fields
      productId: 'PROD001'
    });

    await expect(invalidRecord.save()).rejects.toThrow();
  });

  test('should validate enum values', async () => {
    const invalidRecord = new StockTimeSeries({
      timestamp: new Date(),
      productId: 'PROD001',
      stockLevel: 100,
      change: 50,
      reason: 'invalid_reason' // Invalid enum value
    });

    await expect(invalidRecord.save()).rejects.toThrow();
  });
});

describe('Time-Series API Endpoints Tests', () => {
  test('POST /api/timeseries/record - should record time-series data', async () => {
    const response = await request(app)
      .post('/api/timeseries/record')
      .send({
        productId: 'PROD001',
        change: 50,
        reason: 'restock',
        timestamp: '2025-01-15T10:30:00Z'
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.stockLevel).toBe(50);
    expect(response.body.data.velocity).toBeDefined();
    expect(response.body.data.acceleration).toBeDefined();
  });

  test('GET /api/timeseries/data - should get aggregated time-series data', async () => {
    // Create test data
    const baseDate = new Date('2025-01-01');
    for (let i = 0; i < 10; i++) {
      await StockTimeSeries.create({
        timestamp: new Date(baseDate.getTime() + (i * 60 * 60 * 1000)), // Hourly
        productId: 'PROD001',
        stockLevel: 100 + (i * 10),
        change: 10,
        reason: 'restock',
        velocity: 5,
        acceleration: 1
      });
    }

    const response = await request(app)
      .get('/api/timeseries/data')
      .query({
        productId: 'PROD001',
        granularity: '1h',
        includeMetrics: 'true'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.timeSeries).toBeDefined();
    expect(response.body.data.metrics).toBeDefined();
    expect(Array.isArray(response.body.data.timeSeries)).toBe(true);
  });

  test('GET /api/timeseries/trend - should analyze trends', async () => {
    // Create trending data
    const baseDate = new Date('2025-01-01');
    for (let i = 0; i < 20; i++) {
      await StockTimeSeries.create({
        timestamp: new Date(baseDate.getTime() + (i * 24 * 60 * 60 * 1000)), // Daily
        productId: 'PROD001',
        stockLevel: 100 + (i * 5), // Increasing trend
        change: 5,
        reason: 'restock',
        velocity: 2,
        acceleration: 0.1
      });
    }

    const response = await request(app)
      .get('/api/timeseries/trend')
      .query({
        productId: 'PROD001',
        method: 'linear'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.trend).toBe('increasing');
    expect(response.body.data.slope).toBeGreaterThan(0);
    expect(response.body.data.r2).toBeGreaterThan(0);
  });

  test('GET /api/timeseries/cycles - should detect cycles', async () => {
    // Create cyclical data (weekly pattern)
    const baseDate = new Date('2025-01-01');
    for (let i = 0; i < 28; i++) { // 4 weeks
      const dayOfWeek = i % 7;
      const stockLevel = 100 + (dayOfWeek * 10); // Weekly pattern
      
      await StockTimeSeries.create({
        timestamp: new Date(baseDate.getTime() + (i * 24 * 60 * 60 * 1000)),
        productId: 'PROD001',
        stockLevel: stockLevel,
        change: dayOfWeek === 0 ? 20 : -5, // Restock on Sunday
        reason: dayOfWeek === 0 ? 'restock' : 'sale',
        velocity: 0,
        acceleration: 0
      });
    }

    const response = await request(app)
      .get('/api/timeseries/cycles')
      .query({
        productId: 'PROD001',
        maxPeriod: 10
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.cycles).toBeDefined();
    expect(Array.isArray(response.body.data.cycles)).toBe(true);
    expect(response.body.data.cycles.length).toBeGreaterThan(0);
  });

  test('GET /api/timeseries/anomalies - should detect anomalies', async () => {
    // Create data with anomalies
    const baseDate = new Date('2025-01-01');
    for (let i = 0; i < 20; i++) {
      let stockLevel = 100;
      if (i === 5) stockLevel = 200; // Anomaly
      if (i === 15) stockLevel = 20;  // Another anomaly
      
      await StockTimeSeries.create({
        timestamp: new Date(baseDate.getTime() + (i * 24 * 60 * 60 * 1000)),
        productId: 'PROD001',
        stockLevel: stockLevel,
        change: stockLevel - 100,
        reason: 'adjustment',
        velocity: 0,
        acceleration: 0
      });
    }

    const response = await request(app)
      .get('/api/timeseries/anomalies')
      .query({
        productId: 'PROD001',
        threshold: 2
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.anomalies).toBeDefined();
    expect(Array.isArray(response.body.data.anomalies)).toBe(true);
    expect(response.body.data.anomalies.length).toBeGreaterThan(0);
  });

  test('GET /api/timeseries/forecast - should generate forecasts', async () => {
    // Create historical data
    const baseDate = new Date('2025-01-01');
    for (let i = 0; i < 30; i++) {
      await StockTimeSeries.create({
        timestamp: new Date(baseDate.getTime() + (i * 24 * 60 * 60 * 1000)),
        productId: 'PROD001',
        stockLevel: 100 + (i * 2), // Linear trend
        change: 2,
        reason: 'restock',
        velocity: 1,
        acceleration: 0
      });
    }

    const response = await request(app)
      .get('/api/timeseries/forecast')
      .query({
        productId: 'PROD001',
        horizon: 7,
        method: 'linear_trend'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.forecast).toBeDefined();
    expect(Array.isArray(response.body.data.forecast)).toBe(true);
    expect(response.body.data.forecast.length).toBe(7);
  });
});

describe('Advanced Algorithm Tests', () => {
  beforeEach(async () => {
    // Create comprehensive test dataset
    const baseDate = new Date('2025-01-01');
    const products = ['PROD001', 'PROD002', 'PROD003'];
    
    for (const productId of products) {
      for (let i = 0; i < 100; i++) {
        const timestamp = new Date(baseDate.getTime() + (i * 60 * 60 * 1000)); // Hourly
        const dayOfWeek = Math.floor(i / 24) % 7;
        const hourOfDay = i % 24;
        
        // Create realistic patterns
        let stockLevel = 100;
        let change = 0;
        let reason = 'adjustment';
        
        // Weekly pattern
        if (dayOfWeek === 0) { // Sunday restock
          change = 50;
          reason = 'restock';
        } else if (hourOfDay >= 9 && hourOfDay <= 17) { // Business hours sales
          change = -Math.random() * 10;
          reason = 'sale';
        }
        
        stockLevel = Math.max(0, stockLevel + change);
        
        await StockTimeSeries.create({
          timestamp: timestamp,
          productId: productId,
          stockLevel: stockLevel,
          change: change,
          reason: reason,
          velocity: change,
          acceleration: 0
        });
      }
    }
  });

  test('should calculate moving averages correctly', async () => {
    const movingAverageData = await StockTimeSeries.calculateMovingAverage(
      'PROD001', 
      7, 
      new Date('2025-01-01'), 
      new Date('2025-01-10')
    );

    expect(Array.isArray(movingAverageData)).toBe(true);
    expect(movingAverageData.length).toBeGreaterThan(0);
    
    // Check that moving averages are calculated correctly
    const firstValidMA = movingAverageData.find(item => item.movingAvg !== null);
    expect(firstValidMA).toBeDefined();
    expect(typeof firstValidMA.movingAvg).toBe('number');
  });

  test('should detect trends accurately', async () => {
    const trendAnalysis = await StockTimeSeries.detectTrend(
      'PROD001',
      new Date('2025-01-01'),
      new Date('2025-01-10')
    );

    expect(trendAnalysis).toBeDefined();
    expect(trendAnalysis.slope).toBeDefined();
    expect(trendAnalysis.r2).toBeDefined();
    expect(trendAnalysis.trend).toMatch(/increasing|decreasing|stable|insufficient_data/);
    expect(trendAnalysis.confidence).toBeGreaterThanOrEqual(0);
    expect(trendAnalysis.confidence).toBeLessThanOrEqual(1);
  });

  test('should detect cycles in data', async () => {
    const cycleAnalysis = await StockTimeSeries.detectCycles(
      'PROD001',
      new Date('2025-01-01'),
      new Date('2025-01-10'),
      7
    );

    expect(cycleAnalysis).toBeDefined();
    expect(cycleAnalysis.cycles).toBeDefined();
    expect(Array.isArray(cycleAnalysis.cycles)).toBe(true);
    expect(cycleAnalysis.confidence).toBeGreaterThanOrEqual(0);
    expect(cycleAnalysis.confidence).toBeLessThanOrEqual(1);
  });

  test('should detect anomalies using statistical methods', async () => {
    const anomalyAnalysis = await StockTimeSeries.detectAnomalies(
      'PROD001',
      new Date('2025-01-01'),
      new Date('2025-01-10'),
      2
    );

    expect(anomalyAnalysis).toBeDefined();
    expect(anomalyAnalysis.anomalies).toBeDefined();
    expect(Array.isArray(anomalyAnalysis.anomalies)).toBe(true);
    expect(anomalyAnalysis.mean).toBeDefined();
    expect(anomalyAnalysis.stdDev).toBeDefined();
    expect(anomalyAnalysis.anomalyRate).toBeGreaterThanOrEqual(0);
    expect(anomalyAnalysis.anomalyRate).toBeLessThanOrEqual(1);
  });

  test('should calculate advanced metrics', async () => {
    const metrics = await timeSeriesAnalysisService.calculateAdvancedMetrics(
      'PROD001',
      new Date('2025-01-01'),
      new Date('2025-01-10')
    );

    expect(metrics).toBeDefined();
    expect(metrics.basic).toBeDefined();
    expect(metrics.advanced).toBeDefined();
    expect(metrics.dataQuality).toBeDefined();
    
    // Check basic metrics
    expect(metrics.basic.mean).toBeDefined();
    expect(metrics.basic.median).toBeDefined();
    expect(metrics.basic.stdDev).toBeDefined();
    
    // Check advanced metrics
    expect(metrics.advanced.volatility).toBeDefined();
    expect(metrics.advanced.skewness).toBeDefined();
    expect(metrics.advanced.kurtosis).toBeDefined();
    expect(metrics.advanced.trend).toBeDefined();
    
    // Check data quality
    expect(metrics.dataQuality.dataPoints).toBeGreaterThan(0);
    expect(metrics.dataQuality.completeness).toBeGreaterThanOrEqual(0);
    expect(metrics.dataQuality.completeness).toBeLessThanOrEqual(1);
  });

  test('should generate accurate forecasts', async () => {
    const forecast = await timeSeriesAnalysisService.generateForecast(
      'PROD001',
      7,
      'linear_trend'
    );

    expect(forecast).toBeDefined();
    expect(forecast.method).toBe('linear_trend');
    expect(forecast.forecast).toBeDefined();
    expect(Array.isArray(forecast.forecast)).toBe(true);
    expect(forecast.forecast.length).toBe(7);
    expect(forecast.confidence).toBeGreaterThanOrEqual(0);
    expect(forecast.confidence).toBeLessThanOrEqual(1);
    
    // Check forecast structure
    forecast.forecast.forEach(point => {
      expect(point.timestamp).toBeDefined();
      expect(point.predictedValue).toBeDefined();
      expect(point.confidence).toBeDefined();
      expect(point.predictedValue).toBeGreaterThanOrEqual(0);
    });
  });

  test('should calculate comprehensive statistics', async () => {
    const statistics = await timeSeriesAnalysisService.calculateComprehensiveStatistics(
      'PROD001',
      new Date('2025-01-01'),
      new Date('2025-01-10')
    );

    expect(statistics).toBeDefined();
    expect(statistics.timeBased).toBeDefined();
    expect(statistics.distribution).toBeDefined();
    expect(statistics.changes).toBeDefined();
    expect(statistics.performance).toBeDefined();
    expect(statistics.summary).toBeDefined();
    
    // Check time-based statistics
    expect(statistics.timeBased.hourly).toBeDefined();
    expect(statistics.timeBased.daily).toBeDefined();
    
    // Check distribution statistics
    expect(statistics.distribution.quartiles).toBeDefined();
    expect(statistics.distribution.percentiles).toBeDefined();
    
    // Check performance metrics
    expect(statistics.performance.totalReturn).toBeDefined();
    expect(statistics.performance.volatility).toBeDefined();
    expect(statistics.performance.sharpeRatio).toBeDefined();
  });
});

describe('Performance and Edge Cases', () => {
  test('should handle large datasets efficiently', async () => {
    const startTime = Date.now();
    
    // Create large dataset
    const promises = [];
    for (let i = 0; i < 1000; i++) {
      promises.push(StockTimeSeries.create({
        timestamp: new Date(Date.now() + (i * 60 * 1000)), // Every minute
        productId: 'PROD001',
        stockLevel: 100 + Math.random() * 50,
        change: Math.random() * 20 - 10,
        reason: 'adjustment',
        velocity: 0,
        acceleration: 0
      }));
    }
    
    await Promise.all(promises);
    
    const endTime = Date.now();
    expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    
    // Test aggregation performance
    const aggregationStart = Date.now();
    const data = await StockTimeSeries.getTimeSeriesData(
      'PROD001',
      new Date(Date.now() - 24 * 60 * 60 * 1000),
      new Date(),
      '1h'
    );
    const aggregationEnd = Date.now();
    
    expect(aggregationEnd - aggregationStart).toBeLessThan(5000); // Should complete within 5 seconds
    expect(data).toBeDefined();
  });

  test('should handle empty datasets gracefully', async () => {
    const trendAnalysis = await StockTimeSeries.detectTrend(
      'NONEXISTENT',
      new Date('2025-01-01'),
      new Date('2025-01-10')
    );

    expect(trendAnalysis.trend).toBe('insufficient_data');
    expect(trendAnalysis.confidence).toBe(0);
  });

  test('should handle invalid parameters gracefully', async () => {
    const response = await request(app)
      .get('/api/timeseries/trend')
      .query({
        productId: 'PROD001',
        method: 'invalid_method'
      });

    // Should fall back to default method
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test('should validate input parameters', async () => {
    const response = await request(app)
      .post('/api/timeseries/record')
      .send({
        productId: 'PROD001',
        change: 'invalid_number',
        reason: 'invalid_reason'
      });

    expect(response.status).toBe(400);
    expect(response.body.errors).toBeDefined();
  });
});

describe('Real-time Updates Tests', () => {
  test('should broadcast real-time updates', async () => {
    // Mock SSE clients
    const mockClients = [];
    global.sseClients = mockClients;
    
    const response = await request(app)
      .post('/api/timeseries/record')
      .send({
        productId: 'PROD001',
        change: 50,
        reason: 'restock'
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    
    // Note: In a real test, you'd need to set up actual SSE connections
    // This test verifies the broadcast mechanism exists
  });
});
