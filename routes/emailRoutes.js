const express = require('express');
const multer = require('multer');
const emailController = require('../controllers/emailController');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
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

// Bulk email validation
router.post('/validate-bulk', emailController.validateBulk);

// CSV upload and parsing
router.post('/upload-csv', upload.single('file'), emailController.parseCSV);

module.exports = router;