const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const { stream } = require('stream');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const router = express.Router();

// 1. Store file in RAM
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

router.post('/upload-and-scan', upload.single('media'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { originalname, mimetype, buffer } = req.file;

    // --- A. Upload to Google Drive ---
    const bufferStream = new require('stream').PassThrough();
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
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = "Analyze this image for brand compliance. Point out any logos, text, or elements that look out of place, inappropriate, or low resolution.";
    
    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimetype
      },
    };

    const geminiResult = await model.generateContent([prompt, imagePart]);
    const analysis = geminiResult.response.text();

    // --- C. Return results ---
    res.status(200).json({
      success: true,
      driveUrl: driveLink,
      geminiAnalysis: analysis
    });

  } catch (error) {
    console.error('Pipeline Error:', error);
    res.status(500).json({ error: 'Failed to process file' });
  }
});

module.exports = router;