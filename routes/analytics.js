const express = require('express');
const router = express.Router();
const Email = require('../models/Email');
const TrackEvent = require('../models/TrackEvent');

/**
 * GET /api/analytics
 * Returns all analytics data for the dashboard:
 * - Summary stats (total, opens, clicks, open rate)
 * - Top performing emails
 * - Activity trend (last 30 days)
 * - Engagement rates
 */
router.get('/', async (req, res) => {
  try {
    // ── Summary Stats ──────────────────────────────────────
    const [totalEmails, openedEmails, totalOpensAgg, totalClicksAgg] =
      await Promise.all([
        Email.countDocuments(),
        Email.countDocuments({ status: 'Opened' }),
        Email.aggregate([{ $group: { _id: null, total: { $sum: '$opens' } } }]),
        Email.aggregate([{ $group: { _id: null, total: { $sum: '$clicks' } } }]),
      ]);

    const totalOpens = totalOpensAgg[0]?.total || 0;
    const totalClicks = totalClicksAgg[0]?.total || 0;
    const openRate =
      totalEmails > 0
        ? ((openedEmails / totalEmails) * 100).toFixed(1)
        : '0.0';
    const clickRate =
      totalEmails > 0
        ? ((totalClicks / totalEmails) * 100).toFixed(1)
        : '0.0';

    // ── Top Performing Emails (by opens) ───────────────────
    const topEmails = await Email.find({ opens: { $gt: 0 } })
      .sort({ opens: -1 })
      .limit(10)
      .select('subject recipient opens clicks sentAt status')
      .lean();

    // ── Activity Trend — last 30 days ─────────────────────
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const trendData = await TrackEvent.aggregate([
      {
        $match: {
          timestamp: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: '%Y-%m-%d', date: '$timestamp' },
            },
            type: '$type',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);

    // Reshape trend data into { date, opens, clicks }[]
    const trendMap = {};
    trendData.forEach(({ _id, count }) => {
      if (!trendMap[_id.date]) trendMap[_id.date] = { date: _id.date, opens: 0, clicks: 0 };
      trendMap[_id.date][_id.type === 'open' ? 'opens' : 'clicks'] = count;
    });
    const trend = Object.values(trendMap).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // ── Recent Activity ────────────────────────────────────
    const recentActivity = await TrackEvent.find({ type: 'open' })
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    // Enrich with email details
    const recentActivityIds = [...new Set(recentActivity.map((e) => e.emailId))];
    const recentEmails = await Email.find({ trackingId: { $in: recentActivityIds } })
      .select('trackingId subject recipient status')
      .lean();
    const recentEmailMap = Object.fromEntries(
      recentEmails.map((e) => [e.trackingId, e])
    );

    const enrichedActivity = recentActivity.map((event) => ({
      ...event,
      email: recentEmailMap[event.emailId] || null,
    }));

    res.json({
      summary: {
        totalEmails,
        totalOpens,
        totalClicks,
        openRate: parseFloat(openRate),
        clickRate: parseFloat(clickRate),
        openedEmails,
      },
      topEmails,
      trend,
      recentActivity: enrichedActivity,
    });
  } catch (err) {
    console.error('Analytics error:', err.message);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;
