const mongoose = require('mongoose');

const cameraSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  location: {
    type: String,
    trim: true,
    maxlength: 100
  },
  rtspUrl: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || /^rtsp:\/\//.test(v);
      },
      message: 'RTSP URL must start with rtsp://'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'maintenance'],
    default: 'offline'
  },
  resolution: {
    width: { type: Number, default: 1920 },
    height: { type: Number, default: 1080 }
  },
  fps: {
    type: Number,
    default: 30,
    min: 1,
    max: 60
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
cameraSchema.index({ name: 1 });
cameraSchema.index({ location: 1 });
cameraSchema.index({ isActive: 1 });
cameraSchema.index({ status: 1 });

// Update updatedAt on save
cameraSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Instance method to get camera info
cameraSchema.methods.getCameraInfo = function() {
  return {
    cameraId: this._id,
    name: this.name,
    location: this.location,
    rtspUrl: this.rtspUrl,
    isActive: this.isActive,
    status: this.status,
    resolution: this.resolution,
    fps: this.fps,
    createdAt: this.createdAt
  };
};

// Static method to find active cameras
cameraSchema.statics.findActiveCameras = function() {
  return this.find({ isActive: true, status: 'online' });
};

// Static method to update camera status
cameraSchema.statics.updateStatus = async function(cameraId, status) {
  return await this.findByIdAndUpdate(
    cameraId,
    { status: status, updatedAt: Date.now() },
    { new: true }
  );
};

module.exports = mongoose.model('Camera', cameraSchema);
