const axios = require('axios');

class HubSpotIntegration {
  constructor() {
    this.apiKey = process.env.HUBSPOT_API_KEY;
    this.baseURL = 'https://api.hubapi.com';
  }

  async validateAndUpdateContact(email, hubspotContactId) {
    try {
      // Validate email
      const validationResult = await emailValidatorService.validateEmail(email);
      
      // Prepare HubSpot properties
      const properties = {
        email_validity: validationResult.valid ? 'VALID' : 'INVALID',
        email_validation_status: validationResult.reason,
        email_last_validated: new Date().toISOString(),
        is_role_account: validationResult.checks.roleAccount ? 'YES' : 'NO',
        email_validation_details: JSON.stringify({
          syntax: validationResult.checks.syntax,
          domain: validationResult.checks.domain,
          disposable: validationResult.checks.disposable,
          role_type: validationResult.details?.roleAccount?.type
        })
      };

      // Update HubSpot contact
      const response = await axios.patch(
        `${this.baseURL}/crm/v3/objects/contacts/${hubspotContactId}`,
        { properties },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        validation: validationResult,
        hubspotUpdate: response.data
      };

    } catch (error) {
      console.error('HubSpot integration error:', error);
      throw new Error(`Failed to update HubSpot contact: ${error.message}`);
    }
  }

  async batchValidateContacts(emails) {
    try {
      const validationResults = await emailValidatorService.validateBulkEmails(emails);
      
      // Format for HubSpot batch update
      const batchUpdate = validationResults.map(result => ({
        email: result.email,
        properties: {
          email_validity: result.valid ? 'VALID' : 'INVALID',
          email_validation_status: result.reason,
          email_last_validated: new Date().toISOString(),
          is_role_account: result.checks.roleAccount ? 'YES' : 'NO'
        }
      }));

      return {
        results: validationResults,
        batchUpdate: batchUpdate,
        summary: emailValidatorService.getValidationSummary(validationResults)
      };

    } catch (error) {
      console.error('HubSpot batch validation error:', error);
      throw error;
    }
  }
}

module.exports = new HubSpotIntegration();