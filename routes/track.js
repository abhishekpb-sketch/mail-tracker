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

    const emailInfo = await Email.findOne({ trackingId });
    if (!emailInfo) return; // silently ignore if not found

    // Prevent immediate self-opens!
    // If the open happens within 10 seconds of the email being sent, it is the sender's own browser.
    const timeSinceSent = now.getTime() - new Date(emailInfo.sentAt).getTime();
    if (timeSinceSent < 10000) {
      console.log(`[MailTracker] Ignoring immediate self-open (too soon) for ${trackingId}`);
      return;
    }

    // Ignore opens from the exact same IP address that sent the email
    if (emailInfo.senderIp && emailInfo.senderIp !== 'unknown' && emailInfo.senderIp === ip) {
      console.log(`[MailTracker] Ignoring self-open from sender IP ${ip} for ${trackingId}`);
      return;
    }

    // Ignore Google's image proxy pre-fetch (Gmail routes pixels through their servers
    // before delivering to recipients — these show up as GoogleImageProxy user-agents)
    const uaLower = userAgent.toLowerCase();
    const isGoogleProxy = uaLower.includes('googleimageproxy') ||
                          uaLower.includes('google image proxy') ||
                          (uaLower.includes('googlebot') && !uaLower.includes('chrome'));
    if (isGoogleProxy) {
      console.log(`[MailTracker] Skipping Google proxy open for ${trackingId}`);
      return;
    }

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
 * Usage: /track/click/:id?url=https://example.com&lid=0&lbl=ClickHere
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

    // Decode parameters safely
    const originalUrl = targetUrl !== 'https://google.com' ? targetUrl : '';
    const linkIndex = req.query.lid ? parseInt(req.query.lid, 10) : null;
    const linkLabel = req.query.lbl ? req.query.lbl : '';

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
      targetUrl: originalUrl,
      linkIndex: isNaN(linkIndex) ? null : linkIndex,
      linkLabel: linkLabel.substring(0, 100), // truncate if too long
    });
  } catch (err) {
    console.error('Click track error:', err.message);
  }
});

module.exports = router;
