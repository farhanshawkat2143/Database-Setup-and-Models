const mongoose = require('mongoose');

const shelfSchema = new mongoose.Schema({
  shelfName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  cameraId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Camera',
    default: null
  },
  locationDescription: {
    type: String,
    trim: true
  },
  coordinates: {
    x: { type: Number },
    y: { type: Number },
    z: { type: Number }
  },
  dimensions: {
    width: { type: Number },
    height: { type: Number },
    depth: { type: Number }
  },
  capacity: {
    type: Number,
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
shelfSchema.index({ shelfName: 1 });
shelfSchema.index({ cameraId: 1 });
shelfSchema.index({ isActive: 1 });

// Update updatedAt on save
shelfSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for populated camera info
shelfSchema.virtual('camera', {
  ref: 'Camera',
  localField: 'cameraId',
  foreignField: '_id',
  justOne: true
});

// Instance method to get shelf info
shelfSchema.methods.getShelfInfo = function() {
  return {
    shelfId: this._id,
    shelfName: this.shelfName,
    cameraId: this.cameraId,
    locationDescription: this.locationDescription,
    coordinates: this.coordinates,
    dimensions: this.dimensions,
    capacity: this.capacity,
    isActive: this.isActive,
    createdAt: this.createdAt
  };
};

// Static method to find shelves by camera
shelfSchema.statics.findByCamera = function(cameraId) {
  return this.find({ cameraId: cameraId, isActive: true });
};

// Static method to find active shelves
shelfSchema.statics.findActiveShelves = function() {
  return this.find({ isActive: true }).populate('cameraId', 'name location status');
};

module.exports = mongoose.model('Shelf', shelfSchema);
