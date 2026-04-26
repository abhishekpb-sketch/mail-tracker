const mongoose = require('mongoose');

const emailSchema = new mongoose.Schema(
  {
    trackingId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
    },
    recipient: {
      type: String,
      required: true,
    },
    senderEmail: {
      type: String,
      default: '',
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    opens: {
      type: Number,
      default: 0,
    },
    clicks: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['Sent', 'Opened'],
      default: 'Sent',
    },
    lastOpenedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Email', emailSchema);
