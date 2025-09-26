const emailValidatorService = require('../services/EmailValidatorService');

class MakeController {
  async makeIntegration(req, res) {
    try {
      const { emails, webhook_url, api_key, format = 'json' } = req.body;

      // Simple API key validation (you can make this more secure)
      if (!api_key || api_key !== process.env.MAKE_API_KEY) {
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

      // Validate emails
      const results = await emailValidatorService.validateBulkEmails(emails);
      const summary = emailValidatorService.getValidationSummary(results);

      // Prepare response based on format
      let response;
      if (format === 'csv') {
        response = this.formatAsCSV(results);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=email-validation-results.csv');
      } else {
        response = {
          success: true,
          summary: {
            total: summary.total,
            valid: summary.valid,
            invalid: summary.invalid,
            validity_rate: ((summary.valid / summary.total) * 100).toFixed(2),
            role_accounts: summary.roleAccounts
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
        res.setHeader('Content-Type', 'application/json');
      }

      // If webhook URL provided, send results there as well
      if (webhook_url) {
        try {
          await this.sendToWebhook(webhook_url, response, api_key);
        } catch (webhookError) {
          console.error('Webhook delivery failed:', webhookError.message);
        }
      }

      if (format === 'csv') {
        res.send(response);
      } else {
        res.json(response);
      }

    } catch (error) {
      console.error('Make.com integration error:', error);
      res.status(500).json({
        error: 'Failed to validate emails',
        message: error.message
      });
    }
  }

  async makeWebhookTest(req, res) {
    // Test endpoint for Make.com webhook setup
    res.json({
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
  }

  formatAsCSV(results) {
    const headers = 'Email,Valid,Syntax Check,Domain Check,Disposable Check,Role Account,Reason,Validation Time (ms)\n';
    
    const csvRows = results.map(result => {
      const row = [
        `"${result.email}"`,
        result.valid ? 'YES' : 'NO',
        result.checks.syntax ? 'PASS' : 'FAIL',
        result.checks.domain ? 'PASS' : 'FAIL',
        result.checks.disposable ? 'FAIL' : 'PASS',
        result.checks.roleAccount ? 'YES' : 'NO',
        `"${result.reason}"`,
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
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Webhook delivery failed: ${response.status} ${response.statusText}`);
    }

    return response;
  }
}

module.exports = new MakeController();