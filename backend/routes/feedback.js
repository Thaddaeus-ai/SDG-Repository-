const express = require('express');
const { Feedback } = require('../models');
const { wrap, requireLogin, requireAdmin, idParam, paging, toNum } = require('../middleware');

const router = express.Router();
router.param('id', idParam);

router.get('/', requireAdmin, wrap(async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const [feedback, total] = await Promise.all([
    Feedback.find().populate('user', 'name email').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Feedback.countDocuments()
  ]);
  res.json({ feedback, page, limit, total });
}));

router.post('/', requireLogin, wrap(async (req, res) => {
  const { message, rating } = req.body || {};
  if (typeof message !== 'string' || message.trim().length < 3 || message.length > 1000) return res.status(400).json({ message: 'Write 3 to 1000 characters.' });
  const data = { user: req.user.id, message };
  if (rating !== undefined) {
    const r = toNum(rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) return res.status(400).json({ message: 'Rating must be 1 to 5.' });
    data.rating = r;
  }
  const fb = await Feedback.create(data);
  res.status(201).json(fb);
}));

router.delete('/:id', requireAdmin, wrap(async (req, res) => {
  const out = await Feedback.deleteOne({ _id: req.params.id });
  if (!out.deletedCount) return res.status(404).json({ message: 'Feedback not found.' });
  res.status(204).end();
}));

module.exports = router;
