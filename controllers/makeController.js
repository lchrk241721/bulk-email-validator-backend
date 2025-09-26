const emailValidatorService = require('../services/EmailValidatorService');
const axios = require('axios'); // Using axios instead of fetch for better Node.js support

class MakeController {
  async makeIntegration(req, res) {
    try {
      const { emails, webhook_url, api_key, format = 'json' } = req.body;

      const expectedApiKey = process.env.MAKE_API_KEY || 'make_default_key_123';
      if (!api_key || api_key !== expectedApiKey) {
        return res.status(401).json({
          success: false,
          error: 'Invalid API key',
          message: 'Please provide a valid API key'
        });
      }

      if (!emails || !Array.isArray(emails)) {
        return res.status(400).json({
          success: false,
          error: 'Emails array is required'
        });
      }

      if (emails.length > 5000) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 5,000 emails allowed per request for Make.com integration'
        });
      }

      console.log('Make.com integration request received:', { 
        emailCount: emails.length,
        format: format 
      });

      const results = await emailValidatorService.validateBulkEmails(emails);
      const summary = emailValidatorService.getValidationSummary(results);

      let response;
      if (format === 'csv') {
        response = this.formatAsCSV(results);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=email-validation-results.csv');
        return res.send(response);
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
        
        if (webhook_url) {
          try {
            await this.sendToWebhook(webhook_url, response, api_key);
            response.webhook_delivered = true;
            response.webhook_url = webhook_url;
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

  async makeWebhookTest(req, res) {
    try {
      const { webhook_url, api_key } = req.body;

      const expectedApiKey = process.env.MAKE_API_KEY || 'make_default_key_123';
      if (!api_key || api_key !== expectedApiKey) {
        return res.status(401).json({
          success: false,
          error: 'Invalid API key'
        });
      }

      if (!webhook_url) {
        return res.status(400).json({
          success: false,
          error: 'Webhook URL is required'
        });
      }

      const testData = {
        success: true,
        test: true,
        message: 'Webhook test from Bulk Email Validator',
        timestamp: new Date().toISOString(),
        sample_data: {
          total: 3,
          valid: 2,
          invalid: 1,
          validity_rate: "66.67"
        }
      };

      await this.sendToWebhook(webhook_url, testData, api_key);
      
      res.json({
        success: true,
        message: 'Webhook test delivered successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Webhook test error:', error);
      res.status(500).json({
        success: false,
        error: 'Webhook test failed',
        message: error.message
      });
    }
  }

  async makeStatus(req, res) {
    res.json({
      status: 'success',
      message: 'Bulk Email Validator API is working',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      endpoints: {
        make_integration: 'POST /api/email/make/integration',
        make_webhook_test: 'POST /api/email/make/webhook-test',
        make_status: 'GET /api/email/make/status',
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
        `"${result.email.replace(/"/g, '""')}"`,
        result.valid ? 'YES' : 'NO',
        result.checks.syntax ? 'PASS' : 'FAIL',
        result.checks.domain ? 'PASS' : 'FAIL',
        result.checks.disposable ? 'FAIL' : 'PASS',
        result.checks.roleAccount ? 'YES' : 'NO',
        `"${(result.reason || '').replace(/"/g, '""')}"`,
        result.validationTime
      ];
      return row.join(',');
    });

    return headers + csvRows.join('\n');
  }

  async sendToWebhook(webhook_url, data, api_key) {
    try {
      const response = await axios.post(webhook_url, data, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': api_key,
          'User-Agent': 'BulkEmailValidator/1.0.0'
        },
        timeout: 10000
      });

      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`Webhook delivery failed: ${error.response.status} ${error.response.statusText}`);
      } else if (error.request) {
        throw new Error('Webhook delivery failed: No response received from server');
      } else {
        throw new Error(`Webhook delivery failed: ${error.message}`);
      }
    }
  }
}

module.exports = MakeController;