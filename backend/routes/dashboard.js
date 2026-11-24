const express = require('express');
const { Report, CarbonLog, User, STATUSES, CATEGORIES } = require('../models');
const { wrap, round3 } = require('../middleware');

const router = express.Router();

// GET /dashboard/stats (also /dashboard/stat) - public, aggregates only, no personal data.
// Rejected reports are left out of the per-barangay counts so they do not inflate them.
const stats = wrap(async (_req, res) => {
  const [byBarangay, byStatus, byCategory, carbon, byType, reportTotal, userTotal] = await Promise.all([
    Report.aggregate([{ $match: { status: { $ne: 'rejected' } } }, { $group: { _id: '$barangay', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }]),
    Report.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Report.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
    CarbonLog.aggregate([{ $group: { _id: null, kg: { $sum: '$emissionsKg' }, logs: { $sum: 1 }, users: { $addToSet: '$user' } } }]),
    CarbonLog.aggregate([{ $group: { _id: '$type', kg: { $sum: '$emissionsKg' } } }]),
    Report.countDocuments(),
    User.countDocuments()
  ]);
  const zeroFill = (keys, rows) => Object.fromEntries(keys.map((k) => [k, (rows.find((r) => r._id === k) || {}).count || 0]));
  const c = carbon[0] || { kg: 0, logs: 0, users: [] };
  res.json({
    reports: { total: reportTotal, byStatus: zeroFill(STATUSES, byStatus), byCategory: zeroFill(CATEGORIES, byCategory), byBarangay: byBarangay.map((b) => ({ barangay: b._id, count: b.count })) },
    carbon: { totalKg: round3(c.kg), logCount: c.logs, contributors: c.users.length, byType: Object.fromEntries(byType.map((t) => [t._id, round3(t.kg)])) },
    users: { total: userTotal }
  });
});
router.get('/stats', stats);
router.get('/stat', stats);

module.exports = router;
