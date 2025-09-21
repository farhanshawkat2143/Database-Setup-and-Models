const StockTimeSeries = require('../models/StockTimeSeries');

class TimeSeriesAnalysisService {
  
  /**
   * Calculate advanced metrics for time-series data
   */
  async calculateAdvancedMetrics(productId, startTime, endTime) {
    const data = await StockTimeSeries.find({
      productId: productId,
      timestamp: {
        $gte: new Date(startTime),
        $lte: new Date(endTime)
      }
    }).sort({ timestamp: 1 });

    if (data.length < 2) {
      return null;
    }

    const values = data.map(d => d.stockLevel);
    const changes = data.map(d => d.change);
    
    // Basic statistics
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // Advanced metrics
    const volatility = this.calculateVolatility(changes);
    const skewness = this.calculateSkewness(values, mean, stdDev);
    const kurtosis = this.calculateKurtosis(values, mean, stdDev);
    const autocorrelation = this.calculateAutocorrelation(values);
    
    // Trend metrics
    const trend = await StockTimeSeries.detectTrend(productId, startTime, endTime);
    
    // Seasonality detection
    const seasonality = this.detectSeasonality(values);
    
    return {
      basic: {
        mean: mean,
        median: this.calculateMedian(values),
        mode: this.calculateMode(values),
        stdDev: stdDev,
        variance: variance,
        min: Math.min(...values),
        max: Math.max(...values),
        range: Math.max(...values) - Math.min(...values)
      },
      advanced: {
        volatility: volatility,
        skewness: skewness,
        kurtosis: kurtosis,
        autocorrelation: autocorrelation,
        trend: trend,
        seasonality: seasonality
      },
      dataQuality: {
        dataPoints: data.length,
        completeness: this.calculateCompleteness(data),
        consistency: this.calculateConsistency(values)
      }
    };
  }

  /**
   * Analyze trend using multiple methods
   */
  async analyzeTrend(productId, startTime, endTime, method = 'linear') {
    const data = await StockTimeSeries.find({
      productId: productId,
      timestamp: {
        $gte: new Date(startTime),
        $lte: new Date(endTime)
      }
    }).sort({ timestamp: 1 });

    if (data.length < 2) {
      return { method, trend: 'insufficient_data', confidence: 0 };
    }

    const values = data.map(d => d.stockLevel);
    const timestamps = data.map(d => d.timestamp.getTime());
    
    switch (method) {
      case 'linear':
        return this.linearTrendAnalysis(values, timestamps);
      case 'polynomial':
        return this.polynomialTrendAnalysis(values, timestamps);
      case 'exponential':
        return this.exponentialTrendAnalysis(values, timestamps);
      case 'moving_average':
        return this.movingAverageTrendAnalysis(values, timestamps);
      default:
        return this.linearTrendAnalysis(values, timestamps);
    }
  }

  /**
   * Generate forecast using various methods
   */
  async generateForecast(productId, horizon, method = 'linear_trend') {
    const data = await StockTimeSeries.find({
      productId: productId
    }).sort({ timestamp: -1 }).limit(100); // Last 100 points

    if (data.length < 10) {
      return { method, forecast: [], confidence: 0, error: 'Insufficient data' };
    }

    const values = data.reverse().map(d => d.stockLevel);
    const timestamps = data.map(d => d.timestamp.getTime());
    
    switch (method) {
      case 'linear_trend':
        return this.linearTrendForecast(values, timestamps, horizon);
      case 'exponential_smoothing':
        return this.exponentialSmoothingForecast(values, horizon);
      case 'arima':
        return this.arimaForecast(values, horizon);
      default:
        return this.linearTrendForecast(values, timestamps, horizon);
    }
  }

  /**
   * Calculate comprehensive statistics
   */
  async calculateComprehensiveStatistics(productId, startTime, endTime) {
    const data = await StockTimeSeries.find({
      productId: productId,
      timestamp: {
        $gte: new Date(startTime),
        $lte: new Date(endTime)
      }
    }).sort({ timestamp: 1 });

    if (data.length < 2) {
      return null;
    }

    const values = data.map(d => d.stockLevel);
    const changes = data.map(d => d.change);
    
    // Time-based statistics
    const timeStats = this.calculateTimeBasedStatistics(data);
    
    // Distribution statistics
    const distributionStats = this.calculateDistributionStatistics(values);
    
    // Change statistics
    const changeStats = this.calculateChangeStatistics(changes);
    
    // Performance metrics
    const performanceMetrics = this.calculatePerformanceMetrics(values);
    
    return {
      timeBased: timeStats,
      distribution: distributionStats,
      changes: changeStats,
      performance: performanceMetrics,
      summary: {
        totalDataPoints: data.length,
        timeSpan: {
          start: data[0].timestamp,
          end: data[data.length - 1].timestamp,
          duration: data[data.length - 1].timestamp - data[0].timestamp
        }
      }
    };
  }

  // Helper methods for statistical calculations

  calculateVolatility(changes) {
    if (changes.length < 2) return 0;
    const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
    const variance = changes.reduce((sum, change) => sum + Math.pow(change - mean, 2), 0) / changes.length;
    return Math.sqrt(variance);
  }

  calculateSkewness(values, mean, stdDev) {
    if (values.length < 3 || stdDev === 0) return 0;
    const n = values.length;
    const skewness = values.reduce((sum, val) => {
      return sum + Math.pow((val - mean) / stdDev, 3);
    }, 0) / n;
    return skewness;
  }

  calculateKurtosis(values, mean, stdDev) {
    if (values.length < 4 || stdDev === 0) return 0;
    const n = values.length;
    const kurtosis = values.reduce((sum, val) => {
      return sum + Math.pow((val - mean) / stdDev, 4);
    }, 0) / n - 3; // Excess kurtosis
    return kurtosis;
  }

  calculateAutocorrelation(values, lag = 1) {
    if (values.length < lag + 1) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < values.length - lag; i++) {
      numerator += (values[i] - mean) * (values[i + lag] - mean);
    }
    
    for (let i = 0; i < values.length; i++) {
      denominator += Math.pow(values[i] - mean, 2);
    }
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  calculateMode(values) {
    const frequency = {};
    values.forEach(val => {
      frequency[val] = (frequency[val] || 0) + 1;
    });
    
    let maxFreq = 0;
    let mode = values[0];
    
    for (const [value, freq] of Object.entries(frequency)) {
      if (freq > maxFreq) {
        maxFreq = freq;
        mode = parseFloat(value);
      }
    }
    
    return mode;
  }

  calculateCompleteness(data) {
    // Calculate percentage of expected data points
    const expectedPoints = Math.ceil((data[data.length - 1].timestamp - data[0].timestamp) / (60 * 60 * 1000)); // Hourly
    return Math.min(data.length / expectedPoints, 1);
  }

  calculateConsistency(values) {
    // Calculate coefficient of variation
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
    return mean === 0 ? 0 : stdDev / mean;
  }

  detectSeasonality(values) {
    // Simple seasonality detection using autocorrelation at different lags
    const lags = [24, 168, 720]; // Daily, weekly, monthly (assuming hourly data)
    const seasonality = {};
    
    lags.forEach(lag => {
      if (values.length > lag) {
        seasonality[`lag_${lag}`] = this.calculateAutocorrelation(values, lag);
      }
    });
    
    return seasonality;
  }

  linearTrendAnalysis(values, timestamps) {
    const n = values.length;
    const sumX = timestamps.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = timestamps.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumXX = timestamps.reduce((sum, x) => sum + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared
    const yMean = sumY / n;
    const ssRes = values.reduce((sum, y, i) => {
      const predicted = slope * timestamps[i] + intercept;
      return sum + Math.pow(y - predicted, 2);
    }, 0);
    const ssTot = values.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
    const r2 = 1 - (ssRes / ssTot);
    
    return {
      method: 'linear',
      slope: slope,
      intercept: intercept,
      r2: r2,
      trend: slope > 0.001 ? 'increasing' : slope < -0.001 ? 'decreasing' : 'stable',
      confidence: Math.min(r2, 1),
      dataPoints: n
    };
  }

  polynomialTrendAnalysis(values, timestamps) {
    // Simplified polynomial trend (quadratic)
    const n = values.length;
    const x = timestamps.map(t => (t - timestamps[0]) / (timestamps[n-1] - timestamps[0])); // Normalize
    
    // Calculate coefficients for y = ax² + bx + c
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    const sumX3 = x.reduce((sum, val) => sum + val * val * val, 0);
    const sumX4 = x.reduce((sum, val) => sum + val * val * val * val, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * values[i], 0);
    const sumX2Y = x.reduce((sum, val, i) => sum + val * val * values[i], 0);
    
    // Solve system of equations (simplified)
    const a = (sumX2Y - sumY * sumX2 / n) / (sumX4 - sumX2 * sumX2 / n);
    const b = (sumXY - sumY * sumX / n) / (sumX2 - sumX * sumX / n);
    const c = (sumY - a * sumX2 - b * sumX) / n;
    
    return {
      method: 'polynomial',
      coefficients: { a, b, c },
      trend: a > 0 ? 'accelerating_up' : a < 0 ? 'accelerating_down' : 'linear',
      confidence: 0.8, // Simplified
      dataPoints: n
    };
  }

  exponentialTrendAnalysis(values, timestamps) {
    // Simplified exponential trend
    const logValues = values.map(v => Math.log(Math.max(v, 0.001))); // Avoid log(0)
    const linearResult = this.linearTrendAnalysis(logValues, timestamps);
    
    return {
      method: 'exponential',
      growthRate: linearResult.slope,
      r2: linearResult.r2,
      trend: linearResult.slope > 0 ? 'exponential_growth' : 'exponential_decay',
      confidence: linearResult.r2,
      dataPoints: values.length
    };
  }

  movingAverageTrendAnalysis(values, timestamps, window = 7) {
    const movingAverages = [];
    for (let i = window - 1; i < values.length; i++) {
      const windowValues = values.slice(i - window + 1, i + 1);
      const avg = windowValues.reduce((a, b) => a + b, 0) / windowValues.length;
      movingAverages.push(avg);
    }
    
    const trend = movingAverages.length > 1 ? 
      (movingAverages[movingAverages.length - 1] > movingAverages[0] ? 'increasing' : 'decreasing') : 
      'stable';
    
    return {
      method: 'moving_average',
      window: window,
      trend: trend,
      confidence: 0.7, // Simplified
      dataPoints: movingAverages.length
    };
  }

  linearTrendForecast(values, timestamps, horizon) {
    const trend = this.linearTrendAnalysis(values, timestamps);
    const lastTimestamp = timestamps[timestamps.length - 1];
    const timeStep = timestamps[1] - timestamps[0];
    
    const forecast = [];
    for (let i = 1; i <= horizon; i++) {
      const futureTimestamp = lastTimestamp + (i * timeStep);
      const predictedValue = trend.slope * futureTimestamp + trend.intercept;
      forecast.push({
        timestamp: new Date(futureTimestamp),
        predictedValue: Math.max(predictedValue, 0), // Ensure non-negative
        confidence: trend.confidence * Math.exp(-i * 0.1) // Decreasing confidence
      });
    }
    
    return {
      method: 'linear_trend',
      forecast: forecast,
      confidence: trend.confidence,
      trend: trend.trend
    };
  }

  exponentialSmoothingForecast(values, horizon, alpha = 0.3) {
    if (values.length < 2) {
      return { method: 'exponential_smoothing', forecast: [], confidence: 0 };
    }
    
    let smoothed = values[0];
    const forecast = [];
    
    for (let i = 1; i <= horizon; i++) {
      smoothed = alpha * values[values.length - 1] + (1 - alpha) * smoothed;
      forecast.push({
        timestamp: new Date(Date.now() + i * 24 * 60 * 60 * 1000), // Daily forecast
        predictedValue: Math.max(smoothed, 0),
        confidence: Math.max(0.5 - i * 0.05, 0.1)
      });
    }
    
    return {
      method: 'exponential_smoothing',
      forecast: forecast,
      confidence: 0.6,
      alpha: alpha
    };
  }

  arimaForecast(values, horizon) {
    // Simplified ARIMA (AutoRegressive Integrated Moving Average)
    // This is a basic implementation - in production, use a proper ARIMA library
    
    if (values.length < 10) {
      return { method: 'arima', forecast: [], confidence: 0, error: 'Insufficient data for ARIMA' };
    }
    
    // Simple autoregressive model: AR(1)
    const lag1Values = values.slice(0, -1);
    const currentValues = values.slice(1);
    
    const trend = this.linearTrendAnalysis(currentValues, lag1Values.map((_, i) => i));
    
    const forecast = [];
    let lastValue = values[values.length - 1];
    
    for (let i = 1; i <= horizon; i++) {
      const predictedValue = trend.slope * lastValue + trend.intercept;
      forecast.push({
        timestamp: new Date(Date.now() + i * 24 * 60 * 60 * 1000),
        predictedValue: Math.max(predictedValue, 0),
        confidence: Math.max(0.4 - i * 0.05, 0.1)
      });
      lastValue = predictedValue;
    }
    
    return {
      method: 'arima',
      forecast: forecast,
      confidence: trend.confidence * 0.8,
      parameters: { p: 1, d: 0, q: 0 } // ARIMA(1,0,0)
    };
  }

  calculateTimeBasedStatistics(data) {
    const hourlyStats = {};
    const dailyStats = {};
    
    data.forEach(record => {
      const hour = record.timestamp.getHours();
      const day = record.timestamp.getDay();
      
      if (!hourlyStats[hour]) hourlyStats[hour] = [];
      if (!dailyStats[day]) dailyStats[day] = [];
      
      hourlyStats[hour].push(record.stockLevel);
      dailyStats[day].push(record.stockLevel);
    });
    
    return {
      hourly: Object.keys(hourlyStats).reduce((acc, hour) => {
        const values = hourlyStats[hour];
        acc[hour] = {
          mean: values.reduce((a, b) => a + b, 0) / values.length,
          count: values.length
        };
        return acc;
      }, {}),
      daily: Object.keys(dailyStats).reduce((acc, day) => {
        const values = dailyStats[day];
        acc[day] = {
          mean: values.reduce((a, b) => a + b, 0) / values.length,
          count: values.length
        };
        return acc;
      }, {})
    };
  }

  calculateDistributionStatistics(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const n = values.length;
    
    return {
      quartiles: {
        q1: sorted[Math.floor(n * 0.25)],
        q2: sorted[Math.floor(n * 0.5)],
        q3: sorted[Math.floor(n * 0.75)]
      },
      percentiles: {
        p10: sorted[Math.floor(n * 0.1)],
        p90: sorted[Math.floor(n * 0.9)],
        p95: sorted[Math.floor(n * 0.95)],
        p99: sorted[Math.floor(n * 0.99)]
      },
      iqr: sorted[Math.floor(n * 0.75)] - sorted[Math.floor(n * 0.25)]
    };
  }

  calculateChangeStatistics(changes) {
    const positiveChanges = changes.filter(c => c > 0);
    const negativeChanges = changes.filter(c => c < 0);
    
    return {
      totalChanges: changes.length,
      positiveChanges: positiveChanges.length,
      negativeChanges: negativeChanges.length,
      averagePositiveChange: positiveChanges.length > 0 ? 
        positiveChanges.reduce((a, b) => a + b, 0) / positiveChanges.length : 0,
      averageNegativeChange: negativeChanges.length > 0 ? 
        negativeChanges.reduce((a, b) => a + b, 0) / negativeChanges.length : 0,
      changeRate: changes.length > 0 ? 
        (positiveChanges.length - negativeChanges.length) / changes.length : 0
    };
  }

  calculatePerformanceMetrics(values) {
    const returns = [];
    for (let i = 1; i < values.length; i++) {
      if (values[i-1] !== 0) {
        returns.push((values[i] - values[i-1]) / values[i-1]);
      }
    }
    
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const volatility = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length);
    
    return {
      totalReturn: values.length > 1 ? (values[values.length - 1] - values[0]) / values[0] : 0,
      meanReturn: meanReturn,
      volatility: volatility,
      sharpeRatio: volatility !== 0 ? meanReturn / volatility : 0,
      maxDrawdown: this.calculateMaxDrawdown(values)
    };
  }

  calculateMaxDrawdown(values) {
    let maxDrawdown = 0;
    let peak = values[0];
    
    for (let i = 1; i < values.length; i++) {
      if (values[i] > peak) {
        peak = values[i];
      } else {
        const drawdown = (peak - values[i]) / peak;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }
    }
    
    return maxDrawdown;
  }
}

module.exports = new TimeSeriesAnalysisService();
