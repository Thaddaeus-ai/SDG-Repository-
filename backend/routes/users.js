const express = require('express');
const { User, Report, CarbonLog, Feedback } = require('../models');
const { wrap, requireAdmin, idParam, paging } = require('../middleware');

const router = express.Router();
router.use(requireAdmin);
router.param('id', idParam);

router.get('/', wrap(async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const [users, total] = await Promise.all([
    User.find().select('-savedArticles').sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments()
  ]);
  res.json({ users, page, limit, total });
}));

// DELETE /users/:id - removes the account and everything the user submitted
router.delete('/:id', wrap(async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ message: 'You cannot delete your own account.' });
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  await Promise.all([
    Report.deleteMany({ reporter: user._id }),
    CarbonLog.deleteMany({ user: user._id }),
    Feedback.deleteMany({ user: user._id })
  ]);
  res.status(204).end();
}));

module.exports = router;
