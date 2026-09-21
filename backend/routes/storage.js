const express = require('express');
const path = require('path');
const multer = require('multer');
const { isR2Configured, compressAndUploadToR2, getPresignedUploadUrl } = require('../services/r2Service');

// Multer memory storage for direct streaming to R2
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024 } // 60MB max for high-res images & reel videos
});

module.exports = (db) => {
  const router = express.Router();

  // Check R2 Storage health & configuration status
  router.get('/status', (req, res) => {
    res.json({
      configured: isR2Configured(),
      provider: isR2Configured() ? 'cloudflare-r2' : 'local-storage',
      timestamp: new Date().toISOString()
    });
  });

  // Upload file (images / videos) to Cloudflare R2 with auto compression and Class-A minimizing deduplication
  router.post('/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided in multipart/form-data request' });
      }

      const folder = req.body.folder || 'uploads';

      if (isR2Configured()) {
        const result = await compressAndUploadToR2({
          buffer: req.file.buffer,
          originalName: req.file.originalname,
          folder,
          mimetype: req.file.mimetype,
        });

        return res.json({
          success: true,
          ...result
        });
      } else {
        const ext = path.extname(req.file.originalname) || '.bin';
        const cleanName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
        const mockUrl = `/uploads/${cleanName}`;
        return res.json({
          success: true,
          url: mockUrl,
          key: `${folder}/${cleanName}`,
          provider: 'pending-r2-credentials',
          note: 'Add your Cloudflare R2 credentials to .env to enable live cloud storage.'
        });
      }
    } catch (err) {
      console.error('Storage upload route error:', err);
      res.status(500).json({ error: err.message || 'Upload failed' });
    }
  });

  // Generate Pre-signed URL for direct client-to-R2 upload (ideal for large video reels)
  router.post('/presigned-url', async (req, res) => {
    try {
      const { filename, contentType = 'video/mp4', folder = 'reels' } = req.body;
      if (!filename) {
        return res.status(400).json({ error: 'filename is required' });
      }

      if (isR2Configured()) {
        const presigned = await getPresignedUploadUrl({
          contentType,
          folder,
          expiresIn: 3600 // 1 hour validity
        });

        return res.json({
          success: true,
          ...presigned,
          provider: 'cloudflare-r2'
        });
      } else {
        return res.json({
          success: false,
          configured: false,
          note: 'Cloudflare R2 credentials pending in .env'
        });
      }
    } catch (err) {
      console.error('Presigned URL generation error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
