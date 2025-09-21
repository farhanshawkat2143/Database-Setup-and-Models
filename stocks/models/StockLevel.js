const mongoose = require('mongoose');

const stockLevelSchema = new mongoose.Schema({
  shelfId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shelf',
    required: true,
    index: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  stockPercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  stockCount: {
    type: Number,
    min: 0
  },
  detectionMethod: {
    type: String,
    enum: ['computer_vision', 'manual', 'rfid', 'barcode', 'api'],
    default: 'computer_vision'
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 1
  },
  imageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Image',
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  tags: [String],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: false // We use our own timestamp field
});

// Compound indexes for efficient queries
stockLevelSchema.index({ shelfId: 1, productId: 1, timestamp: -1 });
stockLevelSchema.index({ productId: 1, timestamp: -1 });
stockLevelSchema.index({ timestamp: -1 });
stockLevelSchema.index({ detectionMethod: 1 });
stockLevelSchema.index({ confidence: 1 });

// Virtual for populated shelf info
stockLevelSchema.virtual('shelf', {
  ref: 'Shelf',
  localField: 'shelfId',
  foreignField: '_id',
  justOne: true
});

// Virtual for populated product info
stockLevelSchema.virtual('product', {
  ref: 'Product',
  localField: 'productId',
  foreignField: '_id',
  justOne: true
});

// Virtual for populated image info
stockLevelSchema.virtual('image', {
  ref: 'Image',
  localField: 'imageId',
  foreignField: '_id',
  justOne: true
});

// Instance method to get stock info
stockLevelSchema.methods.getStockInfo = function() {
  return {
    stockId: this._id,
    shelfId: this.shelfId,
    productId: this.productId,
    stockPercentage: this.stockPercentage,
    stockCount: this.stockCount,
    detectionMethod: this.detectionMethod,
    confidence: this.confidence,
    imageId: this.imageId,
    timestamp: this.timestamp,
    tags: this.tags,
    isActive: this.isActive
  };
};

// Static method to get latest stock level for shelf and product
stockLevelSchema.statics.getLatestStockLevel = async function(shelfId, productId) {
  const latestRecord = await this.findOne(
    { shelfId, productId, isActive: true },
    {},
    { sort: { timestamp: -1 } }
  );
  return latestRecord ? latestRecord.stockPercentage : 0;
};

// Static method to get time-series data
stockLevelSchema.statics.getTimeSeriesData = async function(shelfId, productId, startTime, endTime, granularity = '1h') {
  const matchStage = { shelfId, productId, isActive: true };
  
  // Add date filters if provided
  if (startTime || endTime) {
    matchStage.timestamp = {};
    if (startTime) matchStage.timestamp.$gte = new Date(startTime);
    if (endTime) matchStage.timestamp.$lte = new Date(endTime);
  }

  const groupStage = this.getGroupStage(granularity);
  
  const pipeline = [
    { $match: matchStage },
    { $sort: { timestamp: 1 } },
    groupStage,
    { $sort: { _id: 1 } }
  ];

  return await this.aggregate(pipeline);
};

// Static method to get aggregation group stage
stockLevelSchema.statics.getGroupStage = function(period) {
  const groupStages = {
    '1m': {
      $group: {
        _id: {
          year: { $year: '$timestamp' },
          month: { $month: '$timestamp' },
          day: { $dayOfMonth: '$timestamp' },
          hour: { $hour: '$timestamp' },
          minute: { $minute: '$timestamp' }
        },
        timestamp: { $first: '$timestamp' },
        avgStockPercentage: { $avg: '$stockPercentage' },
        minStockPercentage: { $min: '$stockPercentage' },
        maxStockPercentage: { $max: '$stockPercentage' },
        avgConfidence: { $avg: '$confidence' },
        recordCount: { $sum: 1 }
      }
    },
    '5m': {
      $group: {
        _id: {
          year: { $year: '$timestamp' },
          month: { $month: '$timestamp' },
          day: { $dayOfMonth: '$timestamp' },
          hour: { $hour: '$timestamp' },
          minute: { $subtract: [{ $minute: '$timestamp' }, { $mod: [{ $minute: '$timestamp' }, 5] }] }
        },
        timestamp: { $first: '$timestamp' },
        avgStockPercentage: { $avg: '$stockPercentage' },
        minStockPercentage: { $min: '$stockPercentage' },
        maxStockPercentage: { $max: '$stockPercentage' },
        avgConfidence: { $avg: '$confidence' },
        recordCount: { $sum: 1 }
      }
    },
    '15m': {
      $group: {
        _id: {
          year: { $year: '$timestamp' },
          month: { $month: '$timestamp' },
          day: { $dayOfMonth: '$timestamp' },
          hour: { $hour: '$timestamp' },
          minute: { $subtract: [{ $minute: '$timestamp' }, { $mod: [{ $minute: '$timestamp' }, 15] }] }
        },
        timestamp: { $first: '$timestamp' },
        avgStockPercentage: { $avg: '$stockPercentage' },
        minStockPercentage: { $min: '$stockPercentage' },
        maxStockPercentage: { $max: '$stockPercentage' },
        avgConfidence: { $avg: '$confidence' },
        recordCount: { $sum: 1 }
      }
    },
    '1h': {
      $group: {
        _id: {
          year: { $year: '$timestamp' },
          month: { $month: '$timestamp' },
          day: { $dayOfMonth: '$timestamp' },
          hour: { $hour: '$timestamp' }
        },
        timestamp: { $first: '$timestamp' },
        avgStockPercentage: { $avg: '$stockPercentage' },
        minStockPercentage: { $min: '$stockPercentage' },
        maxStockPercentage: { $max: '$stockPercentage' },
        avgConfidence: { $avg: '$confidence' },
        recordCount: { $sum: 1 }
      }
    },
    '1d': {
      $group: {
        _id: {
          year: { $year: '$timestamp' },
          month: { $month: '$timestamp' },
          day: { $dayOfMonth: '$timestamp' }
        },
        timestamp: { $first: '$timestamp' },
        avgStockPercentage: { $avg: '$stockPercentage' },
        minStockPercentage: { $min: '$stockPercentage' },
        maxStockPercentage: { $max: '$stockPercentage' },
        avgConfidence: { $avg: '$confidence' },
        recordCount: { $sum: 1 }
      }
    },
    '1w': {
      $group: {
        _id: {
          year: { $year: '$timestamp' },
          week: { $week: '$timestamp' }
        },
        timestamp: { $first: '$timestamp' },
        avgStockPercentage: { $avg: '$stockPercentage' },
        minStockPercentage: { $min: '$stockPercentage' },
        maxStockPercentage: { $max: '$stockPercentage' },
        avgConfidence: { $avg: '$confidence' },
        recordCount: { $sum: 1 }
      }
    },
    '1M': {
      $group: {
        _id: {
          year: { $year: '$timestamp' },
          month: { $month: '$timestamp' }
        },
        timestamp: { $first: '$timestamp' },
        avgStockPercentage: { $avg: '$stockPercentage' },
        minStockPercentage: { $min: '$stockPercentage' },
        maxStockPercentage: { $max: '$stockPercentage' },
        avgConfidence: { $avg: '$confidence' },
        recordCount: { $sum: 1 }
      }
    }
  };

  return groupStages[period] || groupStages['1h'];
};

// Static method to detect low stock levels
stockLevelSchema.statics.detectLowStock = async function(threshold = 20) {
  const pipeline = [
    {
      $match: { isActive: true }
    },
    {
      $sort: { shelfId: 1, productId: 1, timestamp: -1 }
    },
    {
      $group: {
        _id: { shelfId: '$shelfId', productId: '$productId' },
        latestStock: { $first: '$stockPercentage' },
        latestTimestamp: { $first: '$timestamp' },
        shelfId: { $first: '$shelfId' },
        productId: { $first: '$productId' }
      }
    },
    {
      $match: { latestStock: { $lt: threshold } }
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
    }
  ];

  return await this.aggregate(pipeline);
};

// Static method to get stock trends
stockLevelSchema.statics.getStockTrends = async function(shelfId, productId, startTime, endTime) {
  const data = await this.find({
    shelfId,
    productId,
    isActive: true,
    timestamp: {
      $gte: new Date(startTime),
      $lte: new Date(endTime)
    }
  }).sort({ timestamp: 1 });

  if (data.length < 2) {
    return { trend: 'insufficient_data', slope: 0, confidence: 0 };
  }

  // Calculate trend using linear regression
  const n = data.length;
  const xValues = data.map((_, index) => index);
  const yValues = data.map(d => d.stockPercentage);
  
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
  
  return {
    trend,
    slope,
    intercept,
    r2,
    confidence: Math.min(r2, 1),
    dataPoints: n
  };
};

module.exports = mongoose.model('StockLevel', stockLevelSchema);
