const express = require('express');
const router = express.Router();
const Email = require('../models/Email');
const TrackEvent = require('../models/TrackEvent');

// 1x1 transparent GIF pixel
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

/**
 * GET /track/:trackingId.gif
 * Public endpoint — no API key required.
 * Serves the tracking pixel and records an open event.
 */
router.get('/:trackingId.gif', async (req, res) => {
  // Always respond with the pixel immediately (never fail the image load)
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': PIXEL.length,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  res.end(PIXEL);

  // Process tracking asynchronously (so we don't slow down the email client)
  try {
    const { trackingId } = req.params;
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const now = new Date();

    // Update email record
    await Email.findOneAndUpdate(
      { trackingId },
      {
        $inc: { opens: 1 },
        $set: { status: 'Opened', lastOpenedAt: now },
      }
    );

    // Save the event
    await TrackEvent.create({
      emailId: trackingId,
      type: 'open',
      timestamp: now,
      userAgent,
      ip,
    });
  } catch (err) {
    // Silently ignore — pixel was already served
    console.error('Track event error:', err.message);
  }
});

/**
 * GET /track/click/:trackingId
 * Records a link click and redirects to the target URL.
 * Usage: /track/click/:id?url=https://example.com
 */
router.get('/click/:trackingId', async (req, res) => {
  const { trackingId } = req.params;
  const targetUrl = req.query.url || 'https://google.com';

  // Redirect immediately
  res.redirect(302, targetUrl);

  // Record click asynchronously
  try {
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    await Email.findOneAndUpdate(
      { trackingId },
      { $inc: { clicks: 1 } }
    );

    await TrackEvent.create({
      emailId: trackingId,
      type: 'click',
      timestamp: new Date(),
      userAgent,
      ip,
    });
  } catch (err) {
    console.error('Click track error:', err.message);
  }
});

module.exports = router;
