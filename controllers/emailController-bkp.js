const emailValidatorService = require('../services/EmailValidatorService');
const csv = require('csv-parser');
const stream = require('stream');

class EmailController {
  async validateBulk(req, res) {
    try {
      const { emails } = req.body;
      
      if (!emails || !Array.isArray(emails)) {
        return res.status(400).json({
          error: 'Emails array is required'
        });
      }

      if (emails.length > 10000) {
        return res.status(400).json({
          error: 'Maximum 10,000 emails allowed per request'
        });
      }

      const results = await emailValidatorService.validateBulkEmails(emails);
      const summary = emailValidatorService.getValidationSummary(results);

      res.json({
        summary,
        results,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Bulk validation error:', error);
      res.status(500).json({
        error: 'Failed to validate emails',
        message: error.message
      });
    }
  }

  async validateSingle(req, res) {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          error: 'Email is required'
        });
      }

      const result = await emailValidatorService.validateEmail(email);
      
      res.json({
        result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Single validation error:', error);
      res.status(500).json({
        error: 'Failed to validate email',
        message: error.message
      });
    }
  }

  parseCSV(req, res) {
    if (!req.file) {
      return res.status(400).json({ error: 'CSV file is required' });
    }

    const emails = [];
    const bufferStream = new stream.PassThrough();
    bufferStream.end(req.file.buffer);

    bufferStream
      .pipe(csv())
      .on('data', (row) => {
        // Extract email from first column or look for email field
        const email = row.email || row.Email || row.EMAIL || Object.values(row)[0];
        if (email) {
          emails.push(email);
        }
      })
      .on('end', () => {
        res.json({
          emails,
          count: emails.length
        });
      })
      .on('error', (error) => {
        res.status(400).json({
          error: 'Failed to parse CSV file',
          message: error.message
        });
      });
  }
}

module.exports = new EmailController();