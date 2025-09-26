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

  async validateBulkWithProgress(req, res) {
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

      // Set headers for Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      // Send initial connection message
      res.write('data: ' + JSON.stringify({ 
        type: 'connected', 
        data: { 
          total: emails.length
        } 
      }) + '\n\n');

      const results = await emailValidatorService.validateBulkEmails(
        emails,
        (progress) => {
          // Send progress update as SSE with proper formatting
          try {
            const progressData = JSON.stringify({ 
              type: 'progress', 
              data: progress 
            });
            res.write('data: ' + progressData + '\n\n');
          } catch (error) {
            console.error('Error sending progress update:', error);
          }
        }
      );

      const summary = emailValidatorService.getValidationSummary(results);
      
      // Send final result
      const completeData = JSON.stringify({ 
        type: 'complete', 
        data: { results, summary } 
      });
      res.write('data: ' + completeData + '\n\n');
      res.end();
      
    } catch (error) {
      console.error('Bulk validation with progress error:', error);
      const errorData = JSON.stringify({ 
        type: 'error', 
        data: { error: error.message } 
      });
      res.write('data: ' + errorData + '\n\n');
      res.end();
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