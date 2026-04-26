const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Email = require('../models/Email');

/**
 * POST /api/emails
 * Called by the Chrome extension when an email is sent with tracking.
 * Body: { subject, recipient, senderEmail }
 * Returns: { trackingId, pixelUrl }
 */
router.post('/', async (req, res) => {
  try {
    const { subject, recipient, senderEmail, trackingId } = req.body;

    if (!subject || !recipient) {
      return res.status(400).json({ error: 'subject and recipient are required' });
    }

    // Use provided trackingId or generate one (fallback for old clients)
    const finalTrackingId = trackingId || uuidv4();
    const baseUrl = process.env.BASE_URL || `https://${req.get('host')}`;
    const pixelUrl = `${baseUrl}/track/${finalTrackingId}.gif`;

    const email = await Email.create({
      trackingId: finalTrackingId,
      subject,
      recipient,
      senderEmail: senderEmail || '',
      sentAt: new Date(),
    });

    res.status(201).json({
      trackingId: finalTrackingId,
      pixelUrl,
      email,
    });
  } catch (err) {
    console.error('Create email error:', err.message);
    res.status(500).json({ error: 'Failed to create tracked email' });
  }
});

/**
 * GET /api/emails
 * Returns paginated list of tracked emails.
 * Query params: page, limit, status, search, sort
 */
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (req.query.status && req.query.status !== 'all') {
      filter.status = req.query.status;
    }
    if (req.query.search) {
      const search = req.query.search;
      filter.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { recipient: { $regex: search, $options: 'i' } },
      ];
    }

    // Sort
    const sortOptions = {
      newest: { sentAt: -1 },
      oldest: { sentAt: 1 },
      most_opens: { opens: -1 },
    };
    const sort = sortOptions[req.query.sort] || { sentAt: -1 };

    const [emails, total] = await Promise.all([
      Email.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Email.countDocuments(filter),
    ]);

    res.json({
      emails,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('List emails error:', err.message);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

/**
 * PATCH /api/emails/:trackingId
 * Updates subject and recipient after pre-registration.
 * Called by the extension at send time.
 */
router.patch('/:trackingId', async (req, res) => {
  try {
    const { subject, recipient } = req.body;
    const update = {};
    if (subject) update.subject = subject;
    if (recipient) update.recipient = recipient;

    const email = await Email.findOneAndUpdate(
      { trackingId: req.params.trackingId },
      { $set: update },
      { new: true }
    );
    if (!email) return res.status(404).json({ error: 'Email not found' });
    res.json(email);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update email' });
  }
});

/**
 * GET /api/emails/:trackingId
 * Returns a single email with its events.
 */
router.get('/:trackingId', async (req, res) => {
  try {
    const email = await Email.findOne({ trackingId: req.params.trackingId }).lean();
    if (!email) return res.status(404).json({ error: 'Email not found' });
    res.json(email);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch email' });
  }
});

/**
 * DELETE /api/emails/:trackingId
 * Deletes a tracked email.
 */
router.delete('/:trackingId', async (req, res) => {
  try {
    await Email.findOneAndDelete({ trackingId: req.params.trackingId });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete email' });
  }
});

module.exports = router;
