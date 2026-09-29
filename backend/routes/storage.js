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
      let fileBuffer = req.file?.buffer;
      let originalName = req.file?.originalname;
      let mimetype = req.file?.mimetype || 'application/octet-stream';
      let folder = req.body?.folder || 'uploads';

      if (!fileBuffer && (req.body?.fileData || req.body?.base64)) {
        let rawBase64 = req.body.fileData || req.body.base64;
        const match = rawBase64.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          mimetype = match[1];
          rawBase64 = match[2];
        } else if (req.body.fileType) {
          mimetype = req.body.fileType;
        }
        fileBuffer = Buffer.from(rawBase64, 'base64');
        originalName = req.body.fileName || `asset-${Date.now()}`;
      }

      if (!fileBuffer) {
        return res.status(400).json({ error: 'No file provided in upload request' });
      }

      if (isR2Configured()) {
        try {
          const result = await compressAndUploadToR2({
            buffer: fileBuffer,
            originalName: originalName || 'image.webp',
            folder,
            mimetype,
          });

          return res.json({
            success: true,
            ...result
          });
        } catch (r2Err) {
          console.warn('[Storage Warning] R2 upload error, falling back to local server storage:', r2Err.message);
        }
      }

      // Local filesystem storage with Sharp WebP optimization
      const fs = require('fs');
      const uploadDir = path.join(__dirname, '..', '..', 'uploads');
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

      let finalBuffer = fileBuffer;
      let targetExt = path.extname(originalName || '') || '.png';
      let mime = mimetype || 'application/octet-stream';

      if (mimetype.startsWith('image/') || /\.(png|jpe?g|webp|gif|avif)$/i.test(originalName)) {
        try {
          const sharp = require('sharp');
          finalBuffer = await sharp(fileBuffer)
            .resize(1200, 1500, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer();
          targetExt = '.webp';
          mime = 'image/webp';
        } catch (sharpErr) {
          console.warn('Sharp compression note:', sharpErr.message);
        }
      }

      const cleanName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${targetExt}`;
      const filePath = path.join(uploadDir, cleanName);
      fs.writeFileSync(filePath, finalBuffer);

      const fileUrl = `/uploads/${cleanName}`;
      return res.json({
        success: true,
        url: fileUrl,
        key: `${folder}/${cleanName}`,
        provider: 'local-storage',
      });
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
