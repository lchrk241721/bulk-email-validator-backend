const express = require('express');
const multer = require('multer');
const emailController = require('../controllers/emailController'); // Fixed the filename

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

// Single email validation
router.post('/validate', emailController.validateSingle);

// Bulk email validation (without progress)
router.post('/validate-bulk', emailController.validateBulk);

// Bulk email validation with progress updates
router.post('/validate-bulk-progress', emailController.validateBulkWithProgress);

// CSV upload and parsing
router.post('/upload-csv', upload.single('file'), emailController.parseCSV);

// Make.com integration routes
router.post('/make/integration', (req, res) => emailController.makeIntegration(req, res));
router.post('/make/webhook-test', (req, res) => emailController.makeWebhookTest(req, res));
router.get('/make/status', (req, res) => emailController.makeStatus(req, res));

module.exports = router;