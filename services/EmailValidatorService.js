const dns = require('dns').promises;
const validator = require('validator');
const fs = require('fs').promises;
const path = require('path');

class EmailValidatorService {
  constructor() {
    this.disposableDomains = new Set();
    this.loadDisposableDomains();
  }

  async loadDisposableDomains() {
    try {
      const data = await fs.readFile(
        path.join(__dirname, '../data/disposable_domains.txt'), 
        'utf8'
      );
      this.disposableDomains = new Set(data.split('\n').map(domain => domain.trim()));
    } catch (error) {
      console.warn('Could not load disposable domains list:', error.message);
    }
  }

  validateSyntax(email) {
    return validator.isEmail(email);
  }

  isDisposableEmail(email) {
    const domain = email.split('@')[1];
    return this.disposableDomains.has(domain);
  }

  async validateDomain(email) {
    try {
      const domain = email.split('@')[1];
      const mxRecords = await dns.resolveMx(domain);
      return mxRecords && mxRecords.length > 0;
    } catch (error) {
      return false;
    }
  }

  async validateEmail(email) {
    const startTime = Date.now();
    
    // Basic validation
    if (!email || typeof email !== 'string') {
      return {
        email,
        valid: false,
        reason: 'Invalid email format',
        validationTime: 0
      };
    }

    const trimmedEmail = email.trim().toLowerCase();
    const result = {
      email: trimmedEmail,
      valid: false,
      checks: {
        syntax: false,
        disposable: false,
        domain: false
      },
      reason: '',
      validationTime: 0
    };

    // Syntax check
    result.checks.syntax = this.validateSyntax(trimmedEmail);
    if (!result.checks.syntax) {
      result.reason = 'Invalid email syntax';
      result.validationTime = Date.now() - startTime;
      return result;
    }

    // Disposable email check
    result.checks.disposable = this.isDisposableEmail(trimmedEmail);
    if (result.checks.disposable) {
      result.reason = 'Disposable email domain';
      result.validationTime = Date.now() - startTime;
      return result;
    }

    // Domain/MX record check
    result.checks.domain = await this.validateDomain(trimmedEmail);
    if (!result.checks.domain) {
      result.reason = 'Domain does not exist or has no MX records';
      result.validationTime = Date.now() - startTime;
      return result;
    }

    // All checks passed
    result.valid = true;
    result.reason = 'Valid email address';
    result.validationTime = Date.now() - startTime;
    
    return result;
  }

  async validateBulkEmails(emails, progressCallback = null) {
    const results = [];
    const total = emails.length;
    
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      try {
        const result = await this.validateEmail(email);
        results.push(result);
        
        // Progress callback
        if (progressCallback && typeof progressCallback === 'function') {
          progressCallback({
            processed: i + 1,
            total,
            currentEmail: email,
            currentResult: result
          });
        }
        
        // Small delay to avoid overwhelming DNS servers
        await new Promise(resolve => setTimeout(resolve, 10));
      } catch (error) {
        results.push({
          email,
          valid: false,
          reason: `Validation error: ${error.message}`,
          validationTime: 0
        });
      }
    }
    
    return results;
  }

  getValidationSummary(results) {
    const summary = {
      total: results.length,
      valid: 0,
      invalid: 0,
      reasons: {}
    };

    results.forEach(result => {
      if (result.valid) {
        summary.valid++;
      } else {
        summary.invalid++;
        summary.reasons[result.reason] = (summary.reasons[result.reason] || 0) + 1;
      }
    });

    return summary;
  }
}

module.exports = new EmailValidatorService();