const dns = require('dns').promises;
const validator = require('validator');
const fs = require('fs').promises;
const path = require('path');
const net = require('net');

class EmailValidatorService {
  constructor() {
    this.disposableDomains = new Set();
    this.loadDisposableDomains();
    this.roleBasedPrefixes = new Set([
      'admin', 'administrator', 'webmaster', 'info', 'contact', 'support',
      'help', 'sales', 'marketing', 'billing', 'payments', 'accounts',
      'newsletter', 'notifications', 'alerts', 'noreply', 'no-reply',
      'hello', 'hi', 'contactus', 'careers', 'jobs', 'recruitment',
      'media', 'press', 'pr', 'publicrelations', 'feedback', 'complaints',
      'abuse', 'postmaster', 'hostmaster', 'ssl', 'security', 'ftp',
      'www', 'web', 'it', 'tech', 'technology', 'sysadmin', 'system',
      'network', 'server', 'hosting', 'domain', 'register', 'registration',
      'enquiry', 'query', 'questions', 'helpdesk', 'service', 'customer',
      'client', 'partners', 'affiliates', 'collaboration', 'team',
      'office', 'headquarters', 'hr', 'humanresources', 'legal',
      'management', 'executive', 'ceo', 'cto', 'cfo', 'cio', 'director',
      'manager', 'supervisor', 'owner', 'founder', 'cofounder'
    ]);
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

  isRoleBasedAccount(email) {
    const username = email.split('@')[0].toLowerCase();
    
    // Check against common role-based prefixes
    if (this.roleBasedPrefixes.has(username)) {
      return { isRole: true, type: 'common_role' };
    }
    
    // Check for pattern-based role accounts
    const rolePatterns = [
      /^[a-z]+\.?[a-z]+$/, // single word or dotted words (admin, support.team)
      /^[a-z]+[0-9]+$/, // word followed by numbers (support2024)
      /^[a-z]+[-_][a-z]+$/, // words with separators (customer-support)
    ];
    
    for (const pattern of rolePatterns) {
      if (pattern.test(username) && username.length <= 20) {
        return { isRole: true, type: 'pattern_based' };
      }
    }
    
    return { isRole: false, type: 'personal' };
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

  //SMTP Verification
  async verifySMTP(email) {
    return new Promise(async (resolve) => {
      try {
        const domain = email.split('@')[1];
        
        // Get MX records
        const mxRecords = await dns.resolveMx(domain);
        if (!mxRecords || mxRecords.length === 0) {
          resolve({ valid: false, error: 'No MX records found' });
          return;
        }

        // Sort MX records by priority
        mxRecords.sort((a, b) => a.priority - b.priority);
        
        const mxRecord = mxRecords[0].exchange;
        const timeout = 10000; // 10 seconds timeout
        
        const socket = net.createConnection(25, mxRecord);
        
        let response = '';
        let validated = false;
        
        const timeoutId = setTimeout(() => {
          socket.destroy();
          resolve({ valid: false, error: 'SMTP connection timeout' });
        }, timeout);
        
        socket.setTimeout(timeout);
        
        socket.on('connect', () => {
          // Send EHLO
          socket.write(`EHLO ${domain}\r\n`);
        });
        
        socket.on('data', (data) => {
          response += data.toString();
          
          if (response.includes('220') && response.includes('EHLO')) {
            // Send MAIL FROM
            socket.write(`MAIL FROM: <check@${domain}>\r\n`);
          } else if (response.includes('250') && response.includes('MAIL FROM')) {
            // Send RCPT TO
            socket.write(`RCPT TO: <${email}>\r\n`);
          } else if (response.includes('250') && response.includes('RCPT TO')) {
            clearTimeout(timeoutId);
            validated = true;
            socket.write('QUIT\r\n');
            resolve({ valid: true, response: 'Mailbox exists' });
          } else if (response.includes('550') || response.includes('551') || response.includes('553')) {
            clearTimeout(timeoutId);
            socket.write('QUIT\r\n');
            resolve({ valid: false, error: 'Mailbox does not exist' });
          }
        });
        
        socket.on('error', (error) => {
          clearTimeout(timeoutId);
          resolve({ valid: false, error: error.message });
        });
        
        socket.on('close', () => {
          if (!validated) {
            resolve({ valid: false, error: 'Connection closed unexpectedly' });
          }
        });
        
      } catch (error) {
        resolve({ valid: false, error: error.message });
      }
    });
  }

  async validateEmail(email, enableSMTP = true) {
    const startTime = Date.now();
    
    // Basic validation
    if (!email || typeof email !== 'string') {
      return {
        email,
        valid: false,
        reason: 'Invalid email format',
        validationTime: 0,
        checks: {
          syntax : false,
          disposable : false,
          domain : false,
          smtp : false,
          roleAccount : false
        }
      };
    }

    const trimmedEmail = email.trim().toLowerCase();
    const result = {
      email: trimmedEmail,
      valid: false,
      checks: {
        syntax: false,
        disposable: false,
        domain: false,
        smtp: false,
        roleAccount: false
      },
      details: {
        roleAccount: null,
        smtpResponse: null
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

    // Role-based account check
    const roleCheck = this.isRoleBasedAccount(trimmedEmail);
    result.checks.roleAccount = roleCheck.isRole;
    result.details.roleAccount = roleCheck;

    // SMTP verification (only if domain check passed)
    if (enableSMTP) {
      try {
        const smtpResult = await this.verifySMTP(trimmedEmail);
        result.checks.smtp = smtpResult.valid;
        result.details.smtpResponse = smtpResult;
        
        if (!smtpResult.valid) {
          result.reason = 'Mailbox does not exist (SMTP verification failed)';
          result.validationTime = Date.now() - startTime;
          return result;
        }
      } catch (error) {
        result.checks.smtp = false;
        result.details.smtpResponse = { error: error.message };
        // Don't fail validation if SMTP check fails, just note it
      }
    }

    // All checks passed
    result.valid = true;
    result.reason = 'Valid email address';
    result.validationTime = Date.now() - startTime;
    
    return result;
  }

  async validateBulkEmails(emails, progressCallback = null, enableSMTP = true) {
    const results = [];
    const total = emails.length;
    
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      try {
        const result = await this.validateEmail(email, enableSMTP);
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
        await new Promise(resolve => setTimeout(resolve, enableSMTP ? 100 : 10));
      } catch (error) {
        results.push({
          email,
          valid: false,
          reason: `Validation error: ${error.message}`,
          validationTime: 0,
          checks: {
            syntax: false,
            disposable: false,
            domain: false,
            smtp: false,
            roleAccount: false
          }
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
      reasons: {},
      roleAccounts: 0,
      smtpVerified: 0
    };

    results.forEach(result => {
      if (result.valid) {
        summary.valid++;
        if (result.checks.smtp) summary.smtpVerified++;
        if (result.checks.roleAccount) summary.roleAccounts++;
      } else {
        summary.invalid++;
        summary.reasons[result.reason] = (summary.reasons[result.reason] || 0) + 1;
      }
    });

    return summary;
  }
}

module.exports = new EmailValidatorService();