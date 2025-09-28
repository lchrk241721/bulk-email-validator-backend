const emailValidatorService = require('../services/EmailValidatorService');

class ZapierIntegration {
  async processZap(request, response) {
    try {
      const { email, emails, triggerType = 'single' } = request.body;

      // Single email validation
      if (triggerType === 'single' && email) {
        const result = await emailValidatorService.validateEmail(email);
        return response.json({
          id: Date.now(),
          email: result.email,
          valid: result.valid,
          checks: result.checks,
          reason: result.reason,
          validation_time: result.validationTime,
          timestamp: new Date().toISOString()
        });
      }

      // Bulk email validation
      if (triggerType === 'bulk' && emails && Array.isArray(emails)) {
        const results = await emailValidatorService.validateBulkEmails(emails.slice(0, 1000)); // Zapier limit
        const summary = emailValidatorService.getValidationSummary(results);
        
        return response.json({
          results: results.map(result => ({
            email: result.email,
            valid: result.valid,
            checks: result.checks,
            reason: result.reason,
            validation_time: result.validationTime
          })),
          summary: {
            total: summary.total,
            valid: summary.valid,
            invalid: summary.invalid,
            validity_rate: summary.validityRate,
            role_accounts: summary.roleAccounts
          },
          timestamp: new Date().toISOString()
        });
      }

      throw new Error('Invalid request format');

    } catch (error) {
      console.error('Zapier integration error:', error);
      response.status(400).json({
        error: error.message
      });
    }
  }

  getZapierSampleData() {
    return {
      single_email: {
        email: "test@example.com"
      },
      bulk_emails: {
        emails: ["test1@example.com", "test2@example.com", "invalid-email"]
      }
    };
  }
}

module.exports = new ZapierIntegration();