const mongoose = require('mongoose');

const stockHistorySchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  change: {
    type: Number,
    required: true
  },
  stockLevel: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    required: true,
    enum: ['restock', 'sale', 'adjustment']
  }
}, {
  timestamps: false // We're using our own timestamp field
});

// Compound index for efficient queries
stockHistorySchema.index({ productId: 1, timestamp: -1 });

// Static method to get the latest stock level for a product
stockHistorySchema.statics.getLatestStockLevel = async function(productId) {
  const latestRecord = await this.findOne(
    { productId },
    {},
    { sort: { timestamp: -1 } }
  );
  return latestRecord ? latestRecord.stockLevel : 0;
};

// Static method to record a stock change
stockHistorySchema.statics.recordStockChange = async function(productId, change, reason) {
  const currentStockLevel = await this.getLatestStockLevel(productId);
  const newStockLevel = currentStockLevel + change;
  
  if (newStockLevel < 0) {
    throw new Error('Stock level cannot be negative');
  }
  
  const stockRecord = new this({
    productId,
    change,
    stockLevel: newStockLevel,
    reason
  });
  
  return await stockRecord.save();
};

module.exports = mongoose.model('StockHistory', stockHistorySchema);
