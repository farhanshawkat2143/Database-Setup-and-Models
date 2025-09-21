const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  shelfId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shelf',
    required: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  filename: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255
  },
  originalFilename: {
    type: String,
    trim: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    min: 0
  },
  mimeType: {
    type: String,
    required: true
  },
  dimensions: {
    width: { type: Number },
    height: { type: Number }
  },
  uploadTime: {
    type: Date,
    default: Date.now
  },
  processed: {
    type: Boolean,
    default: false
  },
  processingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  processingResults: {
    detectedStockLevel: { type: Number },
    confidence: { type: Number, min: 0, max: 1 },
    boundingBoxes: [{
      x: Number,
      y: Number,
      width: Number,
      height: Number,
      confidence: Number
    }],
    annotations: [String]
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  tags: [String],
  isActive: {
    type: Boolean,
    default: true
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
imageSchema.index({ shelfId: 1 });
imageSchema.index({ productId: 1 });
imageSchema.index({ filename: 1 });
imageSchema.index({ uploadTime: -1 });
imageSchema.index({ processed: 1 });
imageSchema.index({ processingStatus: 1 });
imageSchema.index({ isActive: 1 });

// Update updatedAt on save
imageSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for populated shelf info
imageSchema.virtual('shelf', {
  ref: 'Shelf',
  localField: 'shelfId',
  foreignField: '_id',
  justOne: true
});

// Virtual for populated product info
imageSchema.virtual('product', {
  ref: 'Product',
  localField: 'productId',
  foreignField: '_id',
  justOne: true
});

// Instance method to get image info
imageSchema.methods.getImageInfo = function() {
  return {
    assetId: this._id,
    shelfId: this.shelfId,
    productId: this.productId,
    filename: this.filename,
    originalFilename: this.originalFilename,
    filePath: this.filePath,
    fileSize: this.fileSize,
    mimeType: this.mimeType,
    dimensions: this.dimensions,
    uploadTime: this.uploadTime,
    processed: this.processed,
    processingStatus: this.processingStatus,
    processingResults: this.processingResults,
    tags: this.tags,
    isActive: this.isActive,
    createdAt: this.createdAt
  };
};

// Static method to find unprocessed images
imageSchema.statics.findUnprocessedImages = function() {
  return this.find({ processed: false, isActive: true }).populate('shelfId productId');
};

// Static method to find by shelf and product
imageSchema.statics.findByShelfAndProduct = function(shelfId, productId) {
  return this.find({ shelfId: shelfId, productId: productId, isActive: true })
    .sort({ uploadTime: -1 });
};

// Static method to update processing status
imageSchema.statics.updateProcessingStatus = async function(imageId, status, results = null) {
  const updateData = { 
    processingStatus: status, 
    updatedAt: Date.now() 
  };
  
  if (status === 'completed') {
    updateData.processed = true;
    if (results) {
      updateData.processingResults = results;
    }
  }
  
  return await this.findByIdAndUpdate(imageId, updateData, { new: true });
};

module.exports = mongoose.model('Image', imageSchema);
