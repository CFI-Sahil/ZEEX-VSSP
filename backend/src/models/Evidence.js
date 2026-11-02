const mongoose = require('mongoose');

const evidenceSchema = new mongoose.Schema(
  {
    evidenceCode: {
      type: String,
      required: [true, 'Evidence code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    alert: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Alert',
      required: [true, 'Associated alert reference is required'],
      index: true,
    },
    alertCode: {
      type: String,
      required: [true, 'Alert code reference is required'],
      uppercase: true,
      trim: true,
      index: true,
    },
    camera: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Camera',
      required: [true, 'Associated camera reference is required'],
      index: true,
    },
    cameraCode: {
      type: String,
      required: [true, 'Camera code reference is required'],
      uppercase: true,
      trim: true,
      index: true,
    },
    fileName: {
      type: String,
      required: [true, 'File name is required'],
      trim: true,
    },
    filePath: {
      type: String,
      required: [true, 'File storage path is required'],
      trim: true,
    },
    fileType: {
      type: String,
      required: [true, 'File MIME type is required'],
      enum: {
        values: ['image/jpeg', 'image/png', 'image/webp'],
        message: 'File type must be image/jpeg, image/png, or image/webp',
      },
    },
    fileSize: {
      type: Number,
      required: [true, 'File size in bytes is required'],
      min: [1, 'File size must be greater than 0'],
      max: [5 * 1024 * 1024, 'File size cannot exceed 5 MB (5,242,880 bytes)'],
    },
    capturedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [300, 'Description cannot exceed 300 characters'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

evidenceSchema.index({ cameraCode: 1, capturedAt: -1 });

module.exports = mongoose.model('Evidence', evidenceSchema);

