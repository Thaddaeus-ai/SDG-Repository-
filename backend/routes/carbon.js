const express = require('express');
const mongoose = require('mongoose');
const { CarbonLog, EmissionFactor, ACTIVITY_TYPES } = require('../models');
const { wrap, requireLogin, idParam, paging, toNum, round3 } = require('../middleware');

const router = express.Router();
router.use(requireLogin);
router.param('id', idParam);

// Looks up the factor in the database and works out the emissions for a quantity.
async function price(type, factorKey, quantity) {
  if (!ACTIVITY_TYPES.includes(type)) return { error: 'Type must be commute or electricity.' };
  const qty = toNum(quantity);
  if (!(qty > 0 && qty <= 100000)) return { error: 'Quantity must be a number greater than 0.' };
  const factor = typeof factorKey === 'string' && (await EmissionFactor.findOne({ key: factorKey, type }));
  if (!factor) return { error: 'Unknown mode or appliance for that type. See GET /carbon-logs/factors.' };
  return { quantity: qty, unit: factor.unit, emissionsKg: round3(qty * factor.kgCO2ePerUnit) };
}
const parseDate = (v) => { const d = new Date(v); return isNaN(d) ? null : d; };

// GET /carbon-logs/factors - the choices for the logging form
router.get('/factors', wrap(async (_req, res) => {
  res.json({ factors: await EmissionFactor.find().sort({ type: 1, label: 1 }) });
}));

// GET /carbon-logs/summary - this user's totals
router.get('/summary', wrap(async (req, res) => {
  const uid = new mongoose.Types.ObjectId(req.user.id);
  const since = new Date(Date.now() - 30 * 864e5);
  const [r] = await CarbonLog.aggregate([
    { $match: { user: uid } },
    { $facet: {
      total: [{ $group: { _id: null, kg: { $sum: '$emissionsKg' }, logs: { $sum: 1 } } }],
      byType: [{ $group: { _id: '$type', kg: { $sum: '$emissionsKg' }, logs: { $sum: 1 } } }],
      byMonth: [{ $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date' } }, kg: { $sum: '$emissionsKg' } } }, { $sort: { _id: 1 } }],
      last30: [{ $match: { date: { $gte: since } } }, { $group: { _id: null, kg: { $sum: '$emissionsKg' } } }]
    } }
  ]);
  res.json({
    totalKg: round3((r.total[0] || {}).kg || 0),
    logCount: (r.total[0] || {}).logs || 0,
    last30DaysKg: round3((r.last30[0] || {}).kg || 0),
    byType: r.byType.map((t) => ({ type: t._id, kg: round3(t.kg), logs: t.logs })),
    byMonth: r.byMonth.map((m) => ({ month: m._id, kg: round3(m.kg) }))
  });
}));

// GET /carbon-logs?from=&to=&type=
router.get('/', wrap(async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const q = { user: req.user.id };
  if (ACTIVITY_TYPES.includes(req.query.type)) q.type = req.query.type;
  const from = req.query.from && parseDate(req.query.from), to = req.query.to && parseDate(req.query.to);
  if (from || to) q.date = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
  const [logs, total] = await Promise.all([
    CarbonLog.find(q).sort({ date: -1 }).skip(skip).limit(limit),
    CarbonLog.countDocuments(q)
  ]);
  res.json({ logs, page, limit, total });
}));

// POST /carbon-logs  body: { type, factorKey, quantity, date?, notes? }
router.post('/', wrap(async (req, res) => {
  const b = req.body || {};
  const p = await price(b.type, b.factorKey, b.quantity);
  if (p.error) return res.status(400).json({ message: p.error });
  const date = b.date === undefined ? new Date() : parseDate(b.date);
  if (!date) return res.status(400).json({ message: 'Invalid date.' });
  const log = await CarbonLog.create({
    user: req.user.id, date, type: b.type, factorKey: b.factorKey, quantity: p.quantity,
    unit: p.unit, emissionsKg: p.emissionsKg, notes: typeof b.notes === 'string' ? b.notes : undefined
  });
  res.status(201).json(log);
}));

// PUT /carbon-logs/:id - emissions are recalculated from the current factor
router.put('/:id', wrap(async (req, res) => {
  const log = await CarbonLog.findOne({ _id: req.params.id, user: req.user.id });
  if (!log) return res.status(404).json({ message: 'Log not found.' });
  const b = req.body || {};
  const type = b.type !== undefined ? b.type : log.type;
  const factorKey = b.factorKey !== undefined ? b.factorKey : log.factorKey;
  const p = await price(type, factorKey, b.quantity !== undefined ? b.quantity : log.quantity);
  if (p.error) return res.status(400).json({ message: p.error });
  if (b.date !== undefined) {
    const d = parseDate(b.date);
    if (!d) return res.status(400).json({ message: 'Invalid date.' });
    log.date = d;
  }
  if (b.notes !== undefined) log.notes = typeof b.notes === 'string' ? b.notes : undefined;
  Object.assign(log, { type, factorKey, quantity: p.quantity, unit: p.unit, emissionsKg: p.emissionsKg });
  res.json(await log.save());
}));

router.delete('/:id', wrap(async (req, res) => {
  const out = await CarbonLog.deleteOne({ _id: req.params.id, user: req.user.id });
  if (!out.deletedCount) return res.status(404).json({ message: 'Log not found.' });
  res.status(204).end();
}));

module.exports = router;
