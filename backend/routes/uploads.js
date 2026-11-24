const express = require('express');
const crypto = require('crypto');
const { requireLogin } = require('../middleware');

const router = express.Router();

// POST /uploads/signature - the browser uploads the photo straight to Cloudinary using this
// signature, then sends the returned secure_url as `photoUrl` when creating the report.
// The API secret never leaves the server.
router.post('/signature', requireLogin, (_req, res) => {
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: secret } = process.env;
  if (!cloudName || !apiKey || !secret) return res.status(503).json({ message: 'Photo uploads are not configured.' });
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'pollution-tracker';
  const signature = crypto.createHash('sha1').update('folder=' + folder + '&timestamp=' + timestamp + secret).digest('hex');
  res.json({ cloudName, apiKey, timestamp, folder, signature });
});

module.exports = router;
