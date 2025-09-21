const mongoose = require('mongoose');

// Time-series schema optimized for stock tracking
const stockTimeSeriesSchema = new mongoose.Schema({
  // Time-series metadata
  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  
  // Dimensions (for grouping/filtering)
  productId: {
    type: String,
    required: true,
    index: true
  },
  location: {
    type: String,
    default: 'warehouse',
    index: true
  },
  
  // Measurements (the actual time-series data)
  stockLevel: {
    type: Number,
    required: true
  },
  change: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    enum: ['restock', 'sale', 'adjustment', 'return', 'damage'],
    required: true
  },
  
  // Additional metrics for analysis
  velocity: {
    type: Number, // Rate of change
    default: 0
  },
  acceleration: {
    type: Number, // Rate of change of velocity
    default: 0
  },
  
  // Metadata for analysis
  seasonality: {
    type: Number, // Seasonal component
    default: 0
  },
  trend: {
    type: Number, // Trend component
    default: 0
  },
  residual: {
    type: Number, // Residual component
    default: 0
  },
  
  // Quality metrics
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 1
  },
  
  // Tags for advanced filtering
  tags: [{
    type: String
  }]
}, {
  timestamps: false // We use our own timestamp field
});

// Compound indexes for efficient queries
stockTimeSeriesSchema.index({ productId: 1, timestamp: -1 });
stockTimeSeriesSchema.index({ timestamp: -1, productId: 1 });
stockTimeSeriesSchema.index({ reason: 1, timestamp: -1 });

// Static methods for time-series operations
stockTimeSeriesSchema.statics.getTimeSeriesData = async function(productId, startTime, endTime, granularity = '1h') {
  const pipeline = [
    {
      $match: {
        productId: productId,
        timestamp: {
          $gte: new Date(startTime),
          $lte: new Date(endTime)
        }
      }
    },
    {
      $group: {
        _id: {
          $dateTrunc: {
            date: '$timestamp',
            unit: granularity === '1h' ? 'hour' : 
                  granularity === '1d' ? 'day' : 
                  granularity === '1w' ? 'week' : 'month'
          }
        },
        avgStockLevel: { $avg: '$stockLevel' },
        minStockLevel: { $min: '$stockLevel' },
        maxStockLevel: { $max: '$stockLevel' },
        totalChange: { $sum: '$change' },
        recordCount: { $sum: 1 },
        avgVelocity: { $avg: '$velocity' },
        avgAcceleration: { $avg: '$acceleration' }
      }
    },
    {
      $sort: { '_id': 1 }
    }
  ];
  
  return await this.aggregate(pipeline);
};

// Method to calculate moving averages
stockTimeSeriesSchema.statics.calculateMovingAverage = async function(productId, window, startTime, endTime) {
  const pipeline = [
    {
      $match: {
        productId: productId,
        timestamp: {
          $gte: new Date(startTime),
          $lte: new Date(endTime)
        }
      }
    },
    {
      $sort: { timestamp: 1 }
    },
    {
      $group: {
        _id: null,
        data: { $push: '$$ROOT' }
      }
    },
    {
      $project: {
        movingAverage: {
          $map: {
            input: { $range: [0, { $size: '$data' }] },
            as: 'index',
            in: {
              timestamp: { $arrayElemAt: ['$data.timestamp', '$$index'] },
              stockLevel: { $arrayElemAt: ['$data.stockLevel', '$$index'] },
              movingAvg: {
                $avg: {
                  $slice: [
                    '$data.stockLevel',
                    { $max: [0, { $subtract: ['$$index', Math.floor(window / 2)] }] },
                    window
                  ]
                }
              }
            }
          }
        }
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  return result[0]?.movingAverage || [];
};

// Method to detect trends using linear regression
stockTimeSeriesSchema.statics.detectTrend = async function(productId, startTime, endTime) {
  const data = await this.find({
    productId: productId,
    timestamp: {
      $gte: new Date(startTime),
      $lte: new Date(endTime)
    }
  }).sort({ timestamp: 1 });

  if (data.length < 2) {
    return { slope: 0, r2: 0, trend: 'insufficient_data' };
  }

  // Linear regression calculation
  const n = data.length;
  const xValues = data.map((_, index) => index);
  const yValues = data.map(d => d.stockLevel);
  
  const sumX = xValues.reduce((a, b) => a + b, 0);
  const sumY = yValues.reduce((a, b) => a + b, 0);
  const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
  const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);
  const sumYY = yValues.reduce((sum, y) => sum + y * y, 0);
  
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
  
  // Determine trend direction
  let trend = 'stable';
  if (Math.abs(slope) > 0.1) {
    trend = slope > 0 ? 'increasing' : 'decreasing';
  }
  
  return {
    slope: slope,
    intercept: intercept,
    r2: r2,
    trend: trend,
    confidence: Math.min(r2, 1),
    dataPoints: n
  };
};

// Method to detect cycles using autocorrelation
stockTimeSeriesSchema.statics.detectCycles = async function(productId, startTime, endTime, maxPeriod = 30) {
  const data = await this.find({
    productId: productId,
    timestamp: {
      $gte: new Date(startTime),
      $lte: new Date(endTime)
    }
  }).sort({ timestamp: 1 });

  if (data.length < maxPeriod * 2) {
    return { cycles: [], confidence: 0 };
  }

  const values = data.map(d => d.stockLevel);
  const cycles = [];
  
  // Calculate autocorrelation for different periods
  for (let period = 1; period <= maxPeriod; period++) {
    let correlation = 0;
    let count = 0;
    
    for (let i = 0; i < values.length - period; i++) {
      correlation += values[i] * values[i + period];
      count++;
    }
    
    if (count > 0) {
      correlation /= count;
      cycles.push({
        period: period,
        correlation: correlation,
        strength: Math.abs(correlation)
      });
    }
  }
  
  // Sort by strength and return top cycles
  cycles.sort((a, b) => b.strength - a.strength);
  
  return {
    cycles: cycles.slice(0, 5), // Top 5 cycles
    confidence: cycles.length > 0 ? cycles[0].strength : 0,
    dataPoints: data.length
  };
};

// Method to detect anomalies using statistical methods
stockTimeSeriesSchema.statics.detectAnomalies = async function(productId, startTime, endTime, threshold = 2) {
  const data = await this.find({
    productId: productId,
    timestamp: {
      $gte: new Date(startTime),
      $lte: new Date(endTime)
    }
  }).sort({ timestamp: 1 });

  if (data.length < 10) {
    return { anomalies: [], mean: 0, stdDev: 0 };
  }

  const values = data.map(d => d.stockLevel);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  const anomalies = data.filter((d, index) => {
    const zScore = Math.abs(d.stockLevel - mean) / stdDev;
    return zScore > threshold;
  }).map(d => ({
    timestamp: d.timestamp,
    stockLevel: d.stockLevel,
    zScore: Math.abs(d.stockLevel - mean) / stdDev,
    reason: d.reason
  }));
  
  return {
    anomalies: anomalies,
    mean: mean,
    stdDev: stdDev,
    threshold: threshold,
    anomalyRate: anomalies.length / data.length
  };
};

module.exports = mongoose.model('StockTimeSeries', stockTimeSeriesSchema);
