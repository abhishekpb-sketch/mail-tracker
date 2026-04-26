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
    // ── Excluded recipients ──────────────────────────────
    // Emails that were in To/CC but are on the excluded list.
    // Opens/clicks from these addresses cannot be filtered server-side
    // (email tracking limitation), but the dashboard warns the user.
    excludedRecipients: {
      type: [String],
      default: [],
    },
    hasExcludedRecipients: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Email', emailSchema);
