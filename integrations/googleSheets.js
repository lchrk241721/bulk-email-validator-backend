const { google } = require('googleapis');
const emailValidatorService = require('../services/EmailValidatorService');

class GoogleSheetsIntegration {
  constructor() {
    this.auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
  }

  async validateSheet(spreadsheetId, range = 'A:A') {
    try {
      const sheets = google.sheets({ version: 'v4', auth: this.auth });
      
      // Read data from sheet
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range
      });

      const emails = response.data.values.flat().filter(email => email && email.includes('@'));
      
      // Validate emails
      const results = await emailValidatorService.validateBulkEmails(emails);
      const summary = emailValidatorService.getValidationSummary(results);

      // Prepare results for sheet
      const outputData = results.map(result => [
        result.email,
        result.valid ? 'VALID' : 'INVALID',
        result.checks.syntax ? 'PASS' : 'FAIL',
        result.checks.domain ? 'PASS' : 'FAIL',
        result.checks.disposable ? 'YES' : 'NO',
        result.checks.roleAccount ? 'YES' : 'NO',
        result.reason,
        result.validationTime
      ]);

      // Write results to new sheet
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Validation_Results!A1',
        valueInputOption: 'RAW',
        resource: {
          values: [
            ['Email', 'Status', 'Syntax', 'Domain', 'Disposable', 'Role Account', 'Reason', 'Validation Time (ms)'],
            ...outputData
          ]
        }
      });

      return {
        success: true,
        processed: emails.length,
        summary,
        resultsSheet: 'Validation_Results!A1:H' + (results.length + 1)
      };

    } catch (error) {
      console.error('Google Sheets integration error:', error);
      throw new Error(`Google Sheets integration failed: ${error.message}`);
    }
  }
}

module.exports = new GoogleSheetsIntegration();