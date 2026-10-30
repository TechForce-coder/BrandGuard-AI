const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const { PassThrough } = require('stream');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Scan = require('../models/Scan');

const router = express.Router();

// Fallback hierarchy of active multimodal models
const DEFAULT_IMAGE_MODELS = [
  process.env.GEMINI_MODEL || "gemini-2.5-flash",
  process.env.GEMINI_FALLBACK_MODEL || "gemini-1.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro"
];

// Helper to pause between transient retries
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 1. Store files in RAM (allow up to 5 files)
const upload = multer({ storage: multer.memoryStorage() });

// 2. Auth for Google Drive (OAuth2 Method)
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });

// 3. Auth for Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Executes multimodal image scanning across candidate fallback models
 */
async function analyzeImageWithFallback(prompt, imagePart) {
  const candidateModels = [...new Set(DEFAULT_IMAGE_MODELS.filter(Boolean))];
  let lastError = null;

  for (const modelName of candidateModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        console.log(`[BrandGuard Media] Trying Gemini model: ${modelName} (attempt ${attempt + 1})`);
        
        const model = genAI.getGenerativeModel({ model: modelName });
        const geminiResult = await model.generateContent([prompt, imagePart]);
        const response = await geminiResult.response;
        const analysis = response.text();

        if (analysis && analysis.trim()) {
          console.log(`[BrandGuard Media] Image scan succeeded with: ${modelName}`);
          return { analysis, modelUsed: modelName };
        }
      } catch (err) {
        lastError = err;
        const status = Number(err.status || err.code || err.error?.code);
        console.warn(`[BrandGuard Media] Model ${modelName} failed: ${err.message} (status: ${status || 'N/A'})`);

        const isTransient = status === 429 || status === 503 || status >= 500;
        if (isTransient && attempt === 0) {
          await sleep(2500);
        } else {
          break;
        }
      }
    }
  }

  throw new Error(`All image fallback models failed. Last error: ${lastError?.message}`);
}

router.post('/upload-and-scan', upload.array('media', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    }

    const results = [];
    const prompt = "Analyze this image for brand compliance. Point out any logos, text, or elements that look out of place, inappropriate, or low resolution.";

    for (const file of req.files) {
      const { originalname, mimetype, buffer } = file;

      // --- A. Upload to Google Drive ---
      const bufferStream = new PassThrough();
      bufferStream.end(buffer);

      let driveLink = '';
      let directImageUrl = '';

      try {
        const driveResponse = await drive.files.create({
          requestBody: {
            name: originalname,
            parents: process.env.GOOGLE_DRIVE_FOLDER_ID ? [process.env.GOOGLE_DRIVE_FOLDER_ID] : [],
          },
          media: {
            mimeType: mimetype,
            body: bufferStream,
          },
          fields: 'id, webViewLink',
        });

        const fileId = driveResponse.data.id;
        driveLink = driveResponse.data.webViewLink;

        // Make file publicly readable so it can display as an image tag
        try {
          await drive.permissions.create({
            fileId: fileId,
            requestBody: {
              role: 'reader',
              type: 'anyone',
            },
          });
        } catch (permErr) {
          console.warn(`Drive permission grant warning:`, permErr.message);
        }

        // Direct embeddable image URL
        directImageUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
      } catch (driveErr) {
        console.warn(`Drive upload failed for ${originalname}:`, driveErr.message);
      }

      // --- B. Scan with Gemini ---
      const base64Data = buffer.toString('base64');
      const imagePart = {
        inlineData: {
          data: base64Data,
          mimeType: mimetype
        },
      };

      const { analysis, modelUsed } = await analyzeImageWithFallback(prompt, imagePart);

      // --- C. Save record to MongoDB ---
      const newScan = new Scan({
        fileName: originalname,
        driveUrl: directImageUrl || driveLink,
        geminiAnalysis: analysis,
        modelUsed
      });
      await newScan.save();

      results.push({
        fileName: originalname,
        driveUrl: directImageUrl || driveLink,
        webViewLink: driveLink,
        geminiAnalysis: analysis,
        modelUsed
      });
    }

    // --- D. Return processed scans ---
    // Expose url and driveUrl on root for single-image upload compatibility
    const primaryUrl = results[0]?.driveUrl || '';

    return res.status(200).json({
      success: true,
      url: primaryUrl,
      driveUrl: primaryUrl,
      scans: results
    });

  } catch (error) {
    console.error('Pipeline Error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to process file(s)' });
  }
});

// --- E. Fetch Scan History ---
router.get('/history', async (req, res) => {
  try {
    const scans = await Scan.find().sort({ createdAt: -1 });
    res.status(200).json(scans);
  } catch (error) {
    console.error('History Fetch Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch scan history' });
  }
});

module.exports = router;