const express = require('express');
const { Report, CATEGORIES, STATUSES } = require('../models');
const { wrap, requireLogin, requireAdmin, idParam, paging, toNum, isHttpUrl } = require('../middleware');
const { notifyStatus } = require('../notify');

const router = express.Router();
router.use(requireLogin);
router.param('id', idParam);

// Validates the fields of a report. With partial=true only the fields that were sent are checked.
function parseReport(b, partial) {
  b = b || {};
  const out = {};
  const bad = (message) => ({ error: message });
  if (!partial || b.category !== undefined) {
    if (!CATEGORIES.includes(b.category)) return bad('Choose a valid category.');
    out.category = b.category;
  }
  if (!partial || b.description !== undefined) {
    const d = typeof b.description === 'string' ? b.description.trim() : '';
    if (d.length < 10 || d.length > 1000) return bad('Description must be 10 to 1000 characters.');
    out.description = d;
  }
  if (!partial || b.barangay !== undefined) {
    const g = typeof b.barangay === 'string' ? b.barangay.trim() : '';
    if (!g || g.length > 80) return bad('Choose a barangay.');
    out.barangay = g;
  }
  if (!partial || b.location !== undefined) {
    const lat = toNum(b.location && b.location.latitude), lng = toNum(b.location && b.location.longitude);
    if (!(lat >= -90 && lat <= 90) || !(lng >= -180 && lng <= 180)) return bad('A valid latitude and longitude are required.');
    out.location = { latitude: lat, longitude: lng };
  }
  if (b.photoUrl !== undefined) {
    if (b.photoUrl === null || b.photoUrl === '') out.photoUrl = null;
    else if (typeof b.photoUrl !== 'string' || !isHttpUrl(b.photoUrl)) return bad('Photo link must start with http:// or https://.');
    else out.photoUrl = b.photoUrl.trim();
  }
  if (!Object.keys(out).length) return bad('Nothing to update.');
  return { data: out };
}

const isOwner = (report, user) => report.reporter && String(report.reporter) === user.id;

// GET /reports - users see their own, admins see all. Filters: status, barangay, category.
router.get('/', wrap(async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const q = req.user.role === 'admin' ? {} : { reporter: req.user.id };
  if (STATUSES.includes(req.query.status)) q.status = req.query.status;
  if (CATEGORIES.includes(req.query.category)) q.category = req.query.category;
  if (typeof req.query.barangay === 'string' && req.query.barangay) q.barangay = req.query.barangay;
  let find = Report.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit);
  if (req.user.role === 'admin') find = find.populate('reporter', 'name email');
  const [reports, total] = await Promise.all([find, Report.countDocuments(q)]);
  res.json({ reports, page, limit, total });
}));

// POST /reports - status is never taken from the client; new reports start as pending.
router.post('/', wrap(async (req, res) => {
  const { data, error } = parseReport(req.body, false);
  if (error) return res.status(400).json({ message: error });
  if (data.photoUrl == null) delete data.photoUrl;
  res.status(201).json(await Report.create({ ...data, reporter: req.user.id }));
}));

// GET /reports/:id - owner or admin
router.get('/:id', wrap(async (req, res) => {
  const report = await Report.findById(req.params.id);
  if (!report || !(isOwner(report, req.user) || req.user.role === 'admin')) return res.status(404).json({ message: 'Report not found.' });
  res.json(report);
}));

// PUT /reports/:id - owner edits. Editing a reviewed report sends it back to pending for re-review.
router.put('/:id', wrap(async (req, res) => {
  const report = await Report.findById(req.params.id);
  if (!report) return res.status(404).json({ message: 'Report not found.' });
  if (!isOwner(report, req.user)) return res.status(403).json({ message: 'You can only edit your own reports.' });
  const { data, error } = parseReport(req.body, true);
  if (error) return res.status(400).json({ message: error });
  report.set(data);
  if (report.status !== 'pending') { report.status = 'pending'; report.statusReason = null; }
  res.json(await report.save());
}));

// PATCH /reports/:id/status - admin: verify, resolve, reject (a reason is required to reject)
router.patch('/:id/status', requireAdmin, wrap(async (req, res) => {
  const { status, statusReason } = req.body || {};
  if (!STATUSES.includes(status)) return res.status(400).json({ message: 'Invalid status.' });
  const reason = typeof statusReason === 'string' ? statusReason.trim() : '';
  if (status === 'rejected' && !reason) return res.status(400).json({ message: 'Give a reason when rejecting a report.' });
  const report = await Report.findById(req.params.id);
  if (!report) return res.status(404).json({ message: 'Report not found.' });
  report.status = status;
  report.statusReason = reason || null;
  await report.save();
  await report.populate('reporter', 'name email');
  notifyStatus(report, report.reporter); // fire and forget
  res.json(report);
}));

// DELETE /reports/:id - owner or admin
router.delete('/:id', wrap(async (req, res) => {
  const report = await Report.findById(req.params.id);
  if (!report) return res.status(404).json({ message: 'Report not found.' });
  if (!isOwner(report, req.user) && req.user.role !== 'admin') return res.status(403).json({ message: 'You can only delete your own reports.' });
  await report.deleteOne();
  res.status(204).end();
}));

module.exports = router;
