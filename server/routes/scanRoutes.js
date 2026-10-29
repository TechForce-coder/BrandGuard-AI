const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const { PassThrough } = require('stream');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Scan = require('../models/Scan');

const router = express.Router();

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
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post('/upload-and-scan', upload.array('media', 5), async (req, res) => {
  try {
    // Check if files exist in req.files (array)
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = [];
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });
    const prompt = "Analyze this image for brand compliance. Point out any logos, text, or elements that look out of place, inappropriate, or low resolution.";

    // Loop through each uploaded file
    for (const file of req.files) {
      const { originalname, mimetype, buffer } = file;

      // --- A. Upload to Google Drive ---
      const bufferStream = new PassThrough();
      bufferStream.end(buffer);

      const driveResponse = await drive.files.create({
        requestBody: {
          name: originalname,
          parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
        },
        media: {
          mimeType: mimetype,
          body: bufferStream,
        },
        fields: 'id, webViewLink',
      });

      const driveLink = driveResponse.data.webViewLink;

      // --- B. Scan with Gemini ---
      const base64Data = buffer.toString('base64');
      const imagePart = {
        inlineData: {
          data: base64Data,
          mimeType: mimetype
        },
      };

      const geminiResult = await model.generateContent([prompt, imagePart]);
      const analysis = geminiResult.response.text();

      // --- C. Save record to MongoDB ---
      const newScan = new Scan({
        fileName: originalname,
        driveUrl: driveLink,
        geminiAnalysis: analysis
      });
      await newScan.save();
      console.log(`Scan saved to MongoDB: ${originalname}`);

      // Collect processed result
      results.push({
        fileName: originalname,
        driveUrl: driveLink,
        geminiAnalysis: analysis
      });
    }

    // --- D. Return all processed scans ---
    res.status(200).json({
      success: true,
      scans: results
    });

  } catch (error) {
    console.error('Pipeline Error:', error);
    res.status(500).json({ error: 'Failed to process file(s)' });
  }
});

// --- E. Fetch Scan History ---
router.get('/history', async (req, res) => {
  try {
    const scans = await Scan.find().sort({ createdAt: -1 }); // Newest first
    res.status(200).json(scans);
  } catch (error) {
    console.error('History Fetch Error:', error);
    res.status(500).json({ error: 'Failed to fetch scan history' });
  }
});

module.exports = router;