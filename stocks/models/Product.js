const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  category: {
    type: String,
    trim: true,
    maxlength: 50
  },
  imageUrl: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  sku: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    index: true
  },
  barcode: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    index: true
  },
  unit: {
    type: String,
    enum: ['piece', 'kg', 'g', 'liter', 'ml', 'box', 'pack'],
    default: 'piece'
  },
  minStockLevel: {
    type: Number,
    default: 10,
    min: 0
  },
  maxStockLevel: {
    type: Number,
    default: 100,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
productSchema.index({ name: 1 });
productSchema.index({ category: 1 });
productSchema.index({ isActive: 1 });

// Update updatedAt on save
productSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Instance method to get product info
productSchema.methods.getProductInfo = function() {
  return {
    productId: this._id,
    name: this.name,
    category: this.category,
    imageUrl: this.imageUrl,
    description: this.description,
    sku: this.sku,
    barcode: this.barcode,
    unit: this.unit,
    minStockLevel: this.minStockLevel,
    maxStockLevel: this.maxStockLevel,
    isActive: this.isActive,
    createdAt: this.createdAt
  };
};

// Static method to find by category
productSchema.statics.findByCategory = function(category) {
  return this.find({ category: category, isActive: true });
};

// Static method to search products
productSchema.statics.searchProducts = function(query) {
  return this.find({
    $and: [
      { isActive: true },
      {
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { category: { $regex: query, $options: 'i' } },
          { sku: { $regex: query, $options: 'i' } },
          { barcode: { $regex: query, $options: 'i' } }
        ]
      }
    ]
  });
};

module.exports = mongoose.model('Product', productSchema);
