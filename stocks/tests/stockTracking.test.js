const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const StockHistory = require('../models/StockHistory');
const stockAnalysisService = require('../services/stockAnalysisService');

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
  await StockHistory.deleteMany({});
});

describe('StockHistory Model Tests', () => {
  test('should create a stock history record', async () => {
    const stockRecord = new StockHistory({
      productId: 'PROD001',
      change: 50,
      stockLevel: 100,
      reason: 'restock'
    });

    const savedRecord = await stockRecord.save();
    expect(savedRecord._id).toBeDefined();
    expect(savedRecord.productId).toBe('PROD001');
    expect(savedRecord.change).toBe(50);
    expect(savedRecord.stockLevel).toBe(100);
    expect(savedRecord.reason).toBe('restock');
  });

  test('should get latest stock level for a product', async () => {
    // Create multiple records for the same product
    await StockHistory.create({
      productId: 'PROD001',
      change: 50,
      stockLevel: 100,
      reason: 'restock'
    });

    await StockHistory.create({
      productId: 'PROD001',
      change: -10,
      stockLevel: 90,
      reason: 'sale'
    });

    const latestStock = await StockHistory.getLatestStockLevel('PROD001');
    expect(latestStock).toBe(90);
  });

  test('should record stock change correctly', async () => {
    const record = await StockHistory.recordStockChange('PROD001', 50, 'restock');
    expect(record.stockLevel).toBe(50);
    expect(record.change).toBe(50);
    expect(record.reason).toBe('restock');

    // Record another change
    const record2 = await StockHistory.recordStockChange('PROD001', -10, 'sale');
    expect(record2.stockLevel).toBe(40);
    expect(record2.change).toBe(-10);
    expect(record2.reason).toBe('sale');
  });

  test('should prevent negative stock levels', async () => {
    await StockHistory.recordStockChange('PROD001', 10, 'restock');
    
    await expect(
      StockHistory.recordStockChange('PROD001', -20, 'sale')
    ).rejects.toThrow('Stock level cannot be negative');
  });
});

describe('API Endpoints Tests', () => {
  test('POST /api/stocks/update - should record stock change', async () => {
    const response = await request(app)
      .post('/api/stocks/update')
      .send({
        productId: 'PROD001',
        change: 50,
        reason: 'restock'
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.stockLevel).toBe(50);
    expect(response.body.data.productId).toBe('PROD001');
  });

  test('POST /api/stocks/update - should validate required fields', async () => {
    const response = await request(app)
      .post('/api/stocks/update')
      .send({
        productId: 'PROD001',
        change: 'invalid',
        reason: 'invalid_reason'
      });

    expect(response.status).toBe(400);
    expect(response.body.errors).toBeDefined();
  });

  test('GET /api/stocks/current - should get current stock level', async () => {
    await StockHistory.recordStockChange('PROD001', 100, 'restock');
    await StockHistory.recordStockChange('PROD001', -20, 'sale');

    const response = await request(app)
      .get('/api/stocks/current')
      .query({ productId: 'PROD001' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.currentStockLevel).toBe(80);
  });

  test('GET /api/stocks/history - should get historical data', async () => {
    // Create test data
    const baseDate = new Date('2025-01-01');
    for (let i = 0; i < 5; i++) {
      await StockHistory.create({
        productId: 'PROD001',
        change: 10,
        stockLevel: 50 + (i * 10),
        reason: 'restock',
        timestamp: new Date(baseDate.getTime() + (i * 24 * 60 * 60 * 1000))
      });
    }

    const response = await request(app)
      .get('/api/stocks/history')
      .query({
        productId: 'PROD001',
        from: '2025-01-01',
        to: '2025-01-10',
        period: 'daily'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});

describe('Stock Analysis Service Tests', () => {
  beforeEach(async () => {
    // Create test data for analysis
    const baseDate = new Date('2025-01-01');
    
    // Create daily records for trend analysis
    for (let i = 0; i < 10; i++) {
      await StockHistory.create({
        productId: 'PROD001',
        change: i % 2 === 0 ? 10 : -5,
        stockLevel: 100 + (i * 5),
        reason: i % 2 === 0 ? 'restock' : 'sale',
        timestamp: new Date(baseDate.getTime() + (i * 24 * 60 * 60 * 1000))
      });
    }
  });

  test('should get historical data with daily aggregation', async () => {
    const data = await stockAnalysisService.getHistoricalData('PROD001', null, null, 'daily');
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  test('should calculate moving average correctly', async () => {
    const data = await stockAnalysisService.getHistoricalData('PROD001', null, null, 'daily');
    const trend = await stockAnalysisService.getTrendAnalysis('PROD001', 'daily', 3);
    
    expect(trend.movingAverage).toBeDefined();
    expect(Array.isArray(trend.movingAverage)).toBe(true);
    expect(trend.trend).toBeDefined();
  });

  test('should analyze restock patterns', async () => {
    const pattern = await stockAnalysisService.analyzeRestockPattern('PROD001');
    
    expect(pattern).toBeDefined();
    expect(pattern.pattern).toBeDefined();
    expect(pattern.totalRestocks).toBeGreaterThan(0);
  });

  test('should determine trend direction', async () => {
    const trend = await stockAnalysisService.getTrendAnalysis('PROD001', 'daily', 5);
    
    expect(['increasing', 'decreasing', 'stable', 'insufficient_data']).toContain(trend.trend);
  });
});

describe('Data Aggregation Tests', () => {
  beforeEach(async () => {
    // Create comprehensive test data
    const baseDate = new Date('2025-01-01');
    
    // Create records spanning multiple periods
    for (let i = 0; i < 30; i++) {
      await StockHistory.create({
        productId: 'PROD001',
        change: Math.random() > 0.5 ? 10 : -5,
        stockLevel: 100 + (i * 2),
        reason: Math.random() > 0.5 ? 'restock' : 'sale',
        timestamp: new Date(baseDate.getTime() + (i * 24 * 60 * 60 * 1000))
      });
    }
  });

  test('should aggregate data by different periods', async () => {
    const periods = ['daily', 'weekly', 'monthly', 'quarterly'];
    
    for (const period of periods) {
      const data = await stockAnalysisService.getHistoricalData('PROD001', null, null, period);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      
      // Check that aggregation fields exist
      if (data.length > 0) {
        expect(data[0]).toHaveProperty('avgStockLevel');
        expect(data[0]).toHaveProperty('minStockLevel');
        expect(data[0]).toHaveProperty('maxStockLevel');
        expect(data[0]).toHaveProperty('totalChange');
      }
    }
  });

  test('should filter data by date range', async () => {
    const data = await stockAnalysisService.getHistoricalData(
      'PROD001',
      '2025-01-10',
      '2025-01-20',
      'daily'
    );
    
    expect(Array.isArray(data)).toBe(true);
    // Should have records within the date range
    expect(data.length).toBeGreaterThan(0);
  });
});

describe('Pattern Recognition Tests', () => {
  test('should detect regular restocking patterns', async () => {
    const baseDate = new Date('2025-01-01');
    
    // Create regular restocking pattern (every 7 days)
    for (let i = 0; i < 5; i++) {
      await StockHistory.create({
        productId: 'PROD001',
        change: 100,
        stockLevel: 100,
        reason: 'restock',
        timestamp: new Date(baseDate.getTime() + (i * 7 * 24 * 60 * 60 * 1000))
      });
    }

    const pattern = await stockAnalysisService.analyzeRestockPattern('PROD001');
    
    expect(pattern.pattern).toBe('regular');
    expect(pattern.averageInterval).toBeCloseTo(7, 1);
    expect(pattern.confidence).toBeGreaterThan(0.5);
    expect(pattern.nextPredictedRestock).toBeDefined();
  });

  test('should handle insufficient data gracefully', async () => {
    const pattern = await stockAnalysisService.analyzeRestockPattern('NONEXISTENT');
    
    expect(pattern.pattern).toBe('insufficient_data');
    expect(pattern.averageInterval).toBeNull();
    expect(pattern.nextPredictedRestock).toBeNull();
    expect(pattern.confidence).toBe(0);
  });
});

describe('Edge Cases and Error Handling', () => {
  test('should handle empty database gracefully', async () => {
    const data = await stockAnalysisService.getHistoricalData('NONEXISTENT', null, null, 'daily');
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(0);
  });

  test('should validate date formats', async () => {
    const response = await request(app)
      .get('/api/stocks/history')
      .query({
        productId: 'PROD001',
        from: 'invalid-date',
        to: '2025-01-10'
      });

    expect(response.status).toBe(400);
  });

  test('should handle large datasets efficiently', async () => {
    // Create a large dataset
    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(StockHistory.create({
        productId: 'PROD001',
        change: Math.random() > 0.5 ? 10 : -5,
        stockLevel: 100 + i,
        reason: Math.random() > 0.5 ? 'restock' : 'sale',
        timestamp: new Date(Date.now() + (i * 60 * 60 * 1000)) // Hourly intervals
      }));
    }
    
    await Promise.all(promises);
    
    const startTime = Date.now();
    const data = await stockAnalysisService.getHistoricalData('PROD001', null, null, 'daily');
    const endTime = Date.now();
    
    expect(data).toBeDefined();
    expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
  });
});
