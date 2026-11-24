const express = require('express');
const { Article, User } = require('../models');
const { wrap, requireLogin, requireAdmin, idParam, paging } = require('../middleware');

const router = express.Router();
router.param('id', idParam);

function parseArticle(b, partial) {
  b = b || {};
  const out = {};
  if (!partial || b.title !== undefined) {
    if (typeof b.title !== 'string' || !b.title.trim() || b.title.length > 150) return { error: 'Title is required (max 150 characters).' };
    out.title = b.title.trim();
  }
  if (!partial || b.body !== undefined) {
    if (typeof b.body !== 'string' || !b.body.trim() || b.body.length > 20000) return { error: 'Body is required (max 20000 characters).' };
    out.body = b.body;
  }
  if (b.summary !== undefined) out.summary = typeof b.summary === 'string' ? b.summary.slice(0, 300) : undefined;
  if (b.tags !== undefined) {
    if (!Array.isArray(b.tags) || b.tags.length > 10 || b.tags.some((t) => typeof t !== 'string' || t.length > 30)) return { error: 'Tags must be up to 10 short strings.' };
    out.tags = b.tags.map((t) => t.trim()).filter(Boolean);
  }
  return Object.keys(out).length ? { data: out } : { error: 'Nothing to update.' };
}

// GET /articles?tag=&page=&limit=  (public, list omits the long body)
router.get('/', wrap(async (req, res) => {
  const { page, limit, skip } = paging(req.query, 10);
  const q = typeof req.query.tag === 'string' && req.query.tag ? { tags: req.query.tag } : {};
  const [articles, total] = await Promise.all([
    Article.find(q).select('-body').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Article.countDocuments(q)
  ]);
  res.json({ articles, page, limit, total });
}));

// GET /articles/saved - the logged-in user's saved articles (must come before /:id)
router.get('/saved', requireLogin, wrap(async (req, res) => {
  const user = await User.findById(req.user.id).populate({ path: 'savedArticles', select: '-body' });
  res.json({ articles: user.savedArticles });
}));

router.get('/:id', wrap(async (req, res) => {
  const article = await Article.findById(req.params.id);
  if (!article) return res.status(404).json({ message: 'Article not found.' });
  res.json(article);
}));

router.post('/', requireAdmin, wrap(async (req, res) => {
  const { data, error } = parseArticle(req.body, false);
  if (error) return res.status(400).json({ message: error });
  res.status(201).json(await Article.create({ ...data, author: req.user.id }));
}));

router.put('/:id', requireAdmin, wrap(async (req, res) => {
  const { data, error } = parseArticle(req.body, true);
  if (error) return res.status(400).json({ message: error });
  const article = await Article.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
  if (!article) return res.status(404).json({ message: 'Article not found.' });
  res.json(article);
}));

router.delete('/:id', requireAdmin, wrap(async (req, res) => {
  const article = await Article.findByIdAndDelete(req.params.id);
  if (!article) return res.status(404).json({ message: 'Article not found.' });
  await User.updateMany({ savedArticles: article._id }, { $pull: { savedArticles: article._id } });
  res.status(204).end();
}));

// Save / unsave for the logged-in user
router.put('/:id/save', requireLogin, wrap(async (req, res) => {
  if (!(await Article.exists({ _id: req.params.id }))) return res.status(404).json({ message: 'Article not found.' });
  await User.updateOne({ _id: req.user.id }, { $addToSet: { savedArticles: req.params.id } });
  res.status(204).end();
}));
router.delete('/:id/save', requireLogin, wrap(async (req, res) => {
  await User.updateOne({ _id: req.user.id }, { $pull: { savedArticles: req.params.id } });
  res.status(204).end();
}));

module.exports = router;
