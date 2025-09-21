const StockHistory = require('../models/StockHistory');

class StockAnalysisService {
  
  /**
   * Get historical data aggregated by specified period
   */
  async getHistoricalData(productId, from, to, period = 'daily') {
    const matchStage = { productId };
    
    // Add date filters if provided
    if (from || to) {
      matchStage.timestamp = {};
      if (from) matchStage.timestamp.$gte = new Date(from);
      if (to) matchStage.timestamp.$lte = new Date(to);
    }

    const groupStage = this.getGroupStage(period);
    
    const pipeline = [
      { $match: matchStage },
      { $sort: { timestamp: 1 } },
      groupStage,
      { $sort: { _id: 1 } }
    ];

    return await StockHistory.aggregate(pipeline);
  }

  /**
   * Get trend analysis with moving average
   */
  async getTrendAnalysis(productId, period = 'daily', window = 7) {
    const historicalData = await this.getHistoricalData(productId, null, null, period);
    
    if (historicalData.length === 0) {
      return { data: [], movingAverage: [], trend: 'insufficient_data' };
    }

    const movingAverage = this.calculateMovingAverage(historicalData, window);
    const trend = this.determineTrend(historicalData, movingAverage);

    return {
      data: historicalData,
      movingAverage,
      trend,
      window
    };
  }

  /**
   * Analyze restocking patterns and predict next restock
   */
  async analyzeRestockPattern(productId) {
    const restockRecords = await StockHistory.find(
      { productId, reason: 'restock' },
      { timestamp: 1 },
      { sort: { timestamp: 1 } }
    );

    if (restockRecords.length < 2) {
      return {
        pattern: 'insufficient_data',
        averageInterval: null,
        nextPredictedRestock: null,
        confidence: 0
      };
    }

    const intervals = this.calculateRestockIntervals(restockRecords);
    const averageInterval = this.calculateAverageInterval(intervals);
    const nextPredictedRestock = this.predictNextRestock(restockRecords, averageInterval);
    const confidence = this.calculateConfidence(intervals, averageInterval);

    return {
      pattern: this.determinePatternType(intervals),
      averageInterval,
      nextPredictedRestock,
      confidence,
      intervals,
      totalRestocks: restockRecords.length
    };
  }

  /**
   * Get aggregation group stage based on period
   */
  getGroupStage(period) {
    const groupStages = {
      daily: {
        $group: {
          _id: {
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' },
            day: { $dayOfMonth: '$timestamp' }
          },
          date: { $first: '$timestamp' },
          avgStockLevel: { $avg: '$stockLevel' },
          minStockLevel: { $min: '$stockLevel' },
          maxStockLevel: { $max: '$stockLevel' },
          totalChange: { $sum: '$change' },
          recordCount: { $sum: 1 }
        }
      },
      weekly: {
        $group: {
          _id: {
            year: { $year: '$timestamp' },
            week: { $week: '$timestamp' }
          },
          date: { $first: '$timestamp' },
          avgStockLevel: { $avg: '$stockLevel' },
          minStockLevel: { $min: '$stockLevel' },
          maxStockLevel: { $max: '$stockLevel' },
          totalChange: { $sum: '$change' },
          recordCount: { $sum: 1 }
        }
      },
      monthly: {
        $group: {
          _id: {
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' }
          },
          date: { $first: '$timestamp' },
          avgStockLevel: { $avg: '$stockLevel' },
          minStockLevel: { $min: '$stockLevel' },
          maxStockLevel: { $max: '$stockLevel' },
          totalChange: { $sum: '$change' },
          recordCount: { $sum: 1 }
        }
      },
      quarterly: {
        $group: {
          _id: {
            year: { $year: '$timestamp' },
            quarter: {
              $switch: {
                branches: [
                  { case: { $lte: [{ $month: '$timestamp' }, 3] }, then: 1 },
                  { case: { $lte: [{ $month: '$timestamp' }, 6] }, then: 2 },
                  { case: { $lte: [{ $month: '$timestamp' }, 9] }, then: 3 }
                ],
                default: 4
              }
            }
          },
          date: { $first: '$timestamp' },
          avgStockLevel: { $avg: '$stockLevel' },
          minStockLevel: { $min: '$stockLevel' },
          maxStockLevel: { $max: '$stockLevel' },
          totalChange: { $sum: '$change' },
          recordCount: { $sum: 1 }
        }
      }
    };

    return groupStages[period] || groupStages.daily;
  }

  /**
   * Calculate moving average for trend analysis
   */
  calculateMovingAverage(data, window) {
    const movingAverage = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < window - 1) {
        movingAverage.push(null); // Not enough data points
      } else {
        const windowData = data.slice(i - window + 1, i + 1);
        const avg = windowData.reduce((sum, item) => sum + item.avgStockLevel, 0) / window;
        movingAverage.push(Math.round(avg * 100) / 100);
      }
    }
    
    return movingAverage;
  }

  /**
   * Determine trend direction
   */
  determineTrend(data, movingAverage) {
    if (movingAverage.length < 2) return 'insufficient_data';
    
    const recentValues = movingAverage.filter(val => val !== null);
    if (recentValues.length < 2) return 'insufficient_data';
    
    const firstHalf = recentValues.slice(0, Math.floor(recentValues.length / 2));
    const secondHalf = recentValues.slice(Math.floor(recentValues.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    if (changePercent > 5) return 'increasing';
    if (changePercent < -5) return 'decreasing';
    return 'stable';
  }

  /**
   * Calculate intervals between restock events
   */
  calculateRestockIntervals(restockRecords) {
    const intervals = [];
    
    for (let i = 1; i < restockRecords.length; i++) {
      const interval = restockRecords[i].timestamp - restockRecords[i - 1].timestamp;
      intervals.push(interval / (1000 * 60 * 60 * 24)); // Convert to days
    }
    
    return intervals;
  }

  /**
   * Calculate average interval between restocks
   */
  calculateAverageInterval(intervals) {
    return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  }

  /**
   * Predict next restock date
   */
  predictNextRestock(restockRecords, averageInterval) {
    const lastRestock = restockRecords[restockRecords.length - 1].timestamp;
    const nextRestock = new Date(lastRestock.getTime() + (averageInterval * 24 * 60 * 60 * 1000));
    return nextRestock;
  }

  /**
   * Calculate confidence in the pattern prediction
   */
  calculateConfidence(intervals, averageInterval) {
    if (intervals.length < 2) return 0;
    
    const variance = intervals.reduce((sum, interval) => {
      return sum + Math.pow(interval - averageInterval, 2);
    }, 0) / intervals.length;
    
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = standardDeviation / averageInterval;
    
    // Lower coefficient of variation = higher confidence
    return Math.max(0, Math.min(1, 1 - coefficientOfVariation));
  }

  /**
   * Determine the type of restocking pattern
   */
  determinePatternType(intervals) {
    if (intervals.length < 2) return 'insufficient_data';
    
    const avgInterval = this.calculateAverageInterval(intervals);
    const variance = intervals.reduce((sum, interval) => {
      return sum + Math.pow(interval - avgInterval, 2);
    }, 0) / intervals.length;
    
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = standardDeviation / avgInterval;
    
    if (coefficientOfVariation < 0.1) return 'highly_regular';
    if (coefficientOfVariation < 0.3) return 'regular';
    if (coefficientOfVariation < 0.5) return 'somewhat_irregular';
    return 'irregular';
  }
}

module.exports = new StockAnalysisService();
