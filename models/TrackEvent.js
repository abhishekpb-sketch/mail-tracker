const mongoose = require('mongoose');

const trackEventSchema = new mongoose.Schema(
  {
    emailId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['open', 'click'],
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    userAgent: {
      type: String,
      default: '',
    },
    ip: {
      type: String,
      default: '',
    },
    // ── Link tracking fields (populated for type='click') ──
    targetUrl: {
      type: String,
      default: '',   // The original destination URL
    },
    linkIndex: {
      type: Number,
      default: null, // Which link (0-based) was clicked
    },
    linkLabel: {
      type: String,
      default: '', // Visible link text
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TrackEvent', trackEventSchema);
