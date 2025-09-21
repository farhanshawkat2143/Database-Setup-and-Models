const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  stockId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StockLevel',
    required: false, // Allow null for system alerts
    default: null
  },
  alertType: {
    type: String,
    required: true,
    enum: ['low_stock', 'out_of_stock', 'high_stock', 'anomaly', 'system_error', 'camera_offline'],
    index: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },
  acknowledged: {
    type: Boolean,
    default: false,
    index: true
  },
  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  acknowledgedAt: {
    type: Date,
    default: null
  },
  resolved: {
    type: Boolean,
    default: false,
    index: true
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  tags: [String],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false // We use our own timestamp fields
});

// Indexes
alertSchema.index({ stockId: 1 });
alertSchema.index({ resolved: 1 });
alertSchema.index({ createdAt: -1 });
alertSchema.index({ acknowledgedBy: 1 });
alertSchema.index({ resolvedBy: 1 });

// Update updatedAt on save
alertSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for populated stock info
alertSchema.virtual('stock', {
  ref: 'StockLevel',
  localField: 'stockId',
  foreignField: '_id',
  justOne: true
});

// Virtual for populated acknowledged by user
alertSchema.virtual('acknowledgedByUser', {
  ref: 'User',
  localField: 'acknowledgedBy',
  foreignField: '_id',
  justOne: true
});

// Virtual for populated resolved by user
alertSchema.virtual('resolvedByUser', {
  ref: 'User',
  localField: 'resolvedBy',
  foreignField: '_id',
  justOne: true
});

// Instance method to get alert info
alertSchema.methods.getAlertInfo = function() {
  return {
    alertId: this._id,
    stockId: this.stockId,
    alertType: this.alertType,
    message: this.message,
    severity: this.severity,
    acknowledged: this.acknowledged,
    acknowledgedBy: this.acknowledgedBy,
    acknowledgedAt: this.acknowledgedAt,
    resolved: this.resolved,
    resolvedAt: this.resolvedAt,
    resolvedBy: this.resolvedBy,
    tags: this.tags,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

// Instance method to acknowledge alert
alertSchema.methods.acknowledge = async function(userId) {
  this.acknowledged = true;
  this.acknowledgedBy = userId;
  this.acknowledgedAt = new Date();
  return await this.save();
};

// Instance method to resolve alert
alertSchema.methods.resolve = async function(userId) {
  this.resolved = true;
  this.resolvedBy = userId;
  this.resolvedAt = new Date();
  return await this.save();
};

// Static method to create alert
alertSchema.statics.createAlert = async function(alertData) {
  const alert = new this(alertData);
  return await alert.save();
};

// Static method to find unacknowledged alerts
alertSchema.statics.findUnacknowledgedAlerts = function() {
  return this.find({ acknowledged: false, resolved: false })
    .populate('stockId', 'shelfId productId stockPercentage timestamp')
    .populate('acknowledgedBy', 'username email')
    .sort({ createdAt: -1 });
};

// Static method to find alerts by type
alertSchema.statics.findByType = function(alertType) {
  return this.find({ alertType: alertType })
    .populate('stockId', 'shelfId productId stockPercentage timestamp')
    .sort({ createdAt: -1 });
};

// Static method to find critical alerts
alertSchema.statics.findCriticalAlerts = function() {
  return this.find({ severity: 'critical', resolved: false })
    .populate('stockId', 'shelfId productId stockPercentage timestamp')
    .sort({ createdAt: -1 });
};

// Static method to get alert statistics
alertSchema.statics.getAlertStatistics = async function(startDate, endDate) {
  const matchStage = {};
  
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: '$alertType',
        count: { $sum: 1 },
        acknowledged: { $sum: { $cond: ['$acknowledged', 1, 0] } },
        resolved: { $sum: { $cond: ['$resolved', 1, 0] } },
        critical: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } }
      }
    },
    {
      $sort: { count: -1 }
    }
  ];

  return await this.aggregate(pipeline);
};

module.exports = mongoose.model('Alert', alertSchema);
