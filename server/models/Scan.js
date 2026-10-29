const mongoose = require('mongoose');

const scanSchema = new mongoose.Schema({
  fileName: { type: String, required: true },
  driveUrl: { type: String, required: true },
  geminiAnalysis: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Scan', scanSchema);