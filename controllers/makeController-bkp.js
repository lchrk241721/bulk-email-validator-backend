const emailValidatorService = require('../services/EmailValidatorService');

// For Node.js environment, we need to import fetch if it's not available
let fetch;
if (typeof window === 'undefined') {
  fetch = require('node-fetch');
} else {
  fetch = window.fetch;
}

class MakeController {
  async makeIntegration(req, res) {
    try {
      const { emails, webhook_url, api_key, format = 'json' } = req.body;

      // Simple API key validation
      const expectedApiKey = process.env.MAKE_API_KEY || 'make_default_key_123';
      if (!api_key || api_key !== expectedApiKey) {
        return res.status(401).json({
          error: 'Invalid API key',
          message: 'Please provide a valid API key'
        });
      }

      if (!emails || !Array.isArray(emails)) {
        return res.status(400).json({
          error: 'Emails array is required'
        });
      }

      if (emails.length > 5000) {
        return res.status(400).json({
          error: 'Maximum 5,000 emails allowed per request for Make.com integration'
        });
      }

      console.log('Make.com integration request received:', { 
        emailCount: emails.length,
        format: format 
      });

      // Validate emails
      const results = await emailValidatorService.validateBulkEmails(emails);
      const summary = emailValidatorService.getValidationSummary(results);

      // Prepare response based on format
      let response;
      if (format === 'csv') {
        response = this.formatAsCSV(results);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=email-validation-results.csv');
        res.send(response);
      } else {
        response = {
          success: true,
          summary: {
            total: summary.total,
            valid: summary.valid,
            invalid: summary.invalid,
            validity_rate: summary.total > 0 ? ((summary.valid / summary.total) * 100).toFixed(2) : 0,
            role_accounts: summary.roleAccounts || 0
          },
          results: results.map(result => ({
            email: result.email,
            valid: result.valid,
            checks: result.checks,
            reason: result.reason,
            validation_time: result.validationTime
          })),
          timestamp: new Date().toISOString()
        };
        
        // If webhook URL provided, send results there as well
        if (webhook_url) {
          try {
            await this.sendToWebhook(webhook_url, response, api_key);
            response.webhook_delivered = true;
          } catch (webhookError) {
            console.error('Webhook delivery failed:', webhookError.message);
            response.webhook_delivered = false;
            response.webhook_error = webhookError.message;
          }
        }

        res.json(response);
      }

    } catch (error) {
      console.error('Make.com integration error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate emails',
        message: error.message
      });
    }
  }

  async makeWebhookTest(webhook_url, webhooktestdata, make_default_key_123) {
    // Test endpoint for Make.com webhook setup
    const webhooktestdata = res.json({
      status: 'success',
      message: 'Bulk Email Validator API is working',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      endpoints: {
        make_integration: 'POST /api/email/make/integration',
        features: [
          'Syntax validation',
          'Domain MX records check',
          'Disposable email detection',
          'Role-based account detection'
        ]
      }
    });
    const response = await fetch(webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'make_default_key_123',
        'User-Agent': 'BulkEmailValidator/1.0.0'
      },
      body: JSON.stringify(webhooktestdata),
      timeout: 10000 // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`Webhook delivery failed: ${response.status} ${response.statusText}`);
    }

    return response;
    
  }

  formatAsCSV(results) {
    const headers = 'Email,Valid,Syntax Check,Domain Check,Disposable Check,Role Account,Reason,Validation Time (ms)\n';
    
    const csvRows = results.map(result => {
      const row = [
        `"${result.email.replace(/"/g, '""')}"`,
        result.valid ? 'YES' : 'NO',
        result.checks.syntax ? 'PASS' : 'FAIL',
        result.checks.domain ? 'PASS' : 'FAIL',
        result.checks.disposable ? 'FAIL' : 'PASS',
        result.checks.roleAccount ? 'YES' : 'NO',
        `"${result.reason.replace(/"/g, '""')}"`,
        result.validationTime
      ];
      return row.join(',');
    });

    return headers + csvRows.join('\n');
  }

  async sendToWebhook(webhook_url, data, api_key) {
    const response = await fetch(webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': api_key,
        'User-Agent': 'BulkEmailValidator/1.0.0'
      },
      body: JSON.stringify(data),
      timeout: 10000 // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`Webhook delivery failed: ${response.status} ${response.statusText}`);
    }

    return response;
  }
}

module.exports = MakeController;