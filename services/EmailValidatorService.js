const dns = require('dns').promises;
const validator = require('validator');
const fs = require('fs').promises;
const path = require('path');

class EmailValidatorService {
  constructor() {
    this.disposableDomains = new Set();
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

  /*isRoleBasedAccount(email) {
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
  }*/

  isRoleBasedAccount(email){
    const username = email.split('@')[0].toLowerCase();
    const domain = email.split('@')[1].toLowerCase();

    //Layer 1: Exact prefix match (high confidence)
    if (this.isExactRolePrefix(username)) {
      return { isRole: true, type: 'exact_prefix', confidence: 'high' };
    }

    // Layer 2: Pattern-based detection (medium confidence)
    const patternResult = this.detectRolePatterns(username);
    if (patternResult.isRole) {
      return patternResult;
    }

    // Layer 3: Domain-specific rules
    const domainResult = this.applyDomainRules(username, domain);
    if (domainResult.isRole) {
      return domainResult;
    }

    // Layer 4: Personal name exclusion (reduce false positives)
    if (this.isLikelyPersonalName(username)) {
      return { isRole: false, type: 'personal_name', confidence: 'high' };
    }

    return { isRole: false, type: 'personal', confidence: 'medium' };
  }

  isExactRolePrefix(username) {
  const highConfidenceRoles = new Set([
    // Administrative
    'admin', 'administrator', 'webmaster', 'postmaster', 'hostmaster', 
    'abuse', 'security', 'ssladmin',
    
    // Business Functions
    'info', 'information', 'contact', 'support', 'help', 'service',
    'sales', 'marketing', 'billing', 'accounts', 'payments', 'finance',
    'hr', 'humanresources', 'careers', 'jobs', 'recruitment', 'resumes',
    
    // Communications
    'newsletter', 'notifications', 'alerts', 'news', 'updates',
    'noreply', 'no-reply', 'no.reply', 'donotreply',
    
    // Technical
    'ftp', 'www', 'web', 'it', 'tech', 'technology', 'sysadmin', 'system',
    'network', 'server', 'hosting', 'domain', 'register', 'registration',
    
    // Management & Executive
    'ceo', 'cto', 'cfo', 'cio', 'director', 'manager', 'supervisor',
    'owner', 'founder', 'cofounder', 'executive',
    
    // Departmental
    'media', 'press', 'pr', 'publicrelations', 'legal', 'compliance',
    'feedback', 'complaints', 'suggestions', 'ideas'
  ]);
  
  return highConfidenceRoles.has(username);
}

detectRolePatterns(username) {
  // Split by common separators
  const parts = username.split(/[._-]/);
  
  // Single part usernames that match role patterns
  if (parts.length === 1) {
    // Role word followed by numbers (support2024, admin123)
    if (/^(admin|support|info|help|sales|marketing|billing|account|service|hr|tech|it)[0-9]{1,4}$/.test(username)) {
      return { isRole: true, type: 'role_with_numbers', confidence: 'medium' };
    }
    
    // Generic role patterns (team, office, desk)
    if (/^(team|office|desk|center|hq|global|corp)[0-9]*$/.test(username)) {
      return { isRole: true, type: 'generic_role', confidence: 'medium' };
    }
  }
  
  // Multi-part usernames
  if (parts.length >= 2) {
    const firstPart = parts[0];
    const secondPart = parts[1];
    
    // Role prefix combinations (admin.team, support.usa, hr.department)
    const rolePrefixes = ['admin', 'support', 'info', 'help', 'sales', 'marketing', 'hr', 'it', 'tech'];
    if (rolePrefixes.includes(firstPart)) {
      return { isRole: true, type: 'role_combination', confidence: 'high' };
    }
    
    // Department patterns (usa.sales, europe.support, tech.hr)
    const departments = ['sales', 'support', 'marketing', 'hr', 'finance', 'tech', 'it', 'admin'];
    if (departments.includes(secondPart)) {
      return { isRole: true, type: 'departmental', confidence: 'medium' };
    }
    
    // Location + role patterns (ny.support, london.sales)
    const locationPattern = /^(?:[a-z]{2,10}\.)?(?:support|sales|marketing|hr|info)$/;
    if (locationPattern.test(username)) {
      return { isRole: true, type: 'location_role', confidence: 'medium' };
    }
  }
  
  return { isRole: false, type: 'no_pattern', confidence: 'low' };
}

applyDomainRules(username, domain) {
  // Common personal email providers (less likely to have role accounts)
  const personalDomains = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
    'aol.com', 'icloud.com', 'protonmail.com'
  ];
  
  // If it's a personal domain and looks like a personal name, likely not role
  if (personalDomains.includes(domain)) {
    if (this.isLikelyPersonalName(username)) {
      return { isRole: false, type: 'personal_domain', confidence: 'high' };
    }
  }
  
  // Company domains might have more role accounts
  // You could add domain-specific rules here
  
  return { isRole: false, type: 'no_domain_rules', confidence: 'low' };
}

isLikelyPersonalName(username) {
  // Common personal name patterns (reduce false positives)
  const personalPatterns = [
    // First name only (john, sarah, mike)
    /^[a-z]{2,15}$/,
    
    // First.Last (john.doe, sarah.smith)
    /^[a-z]{2,20}\.[a-z]{2,20}$/,
    
    // First-Last (john-doe, sarah-smith)
    /^[a-z]{2,20}-[a-z]{2,20}$/,
    
    // First initial + last (jdoe, ssmith)
    /^[a-z][a-z]{3,15}$/,
    
    // Names with numbers (john123, sarah2024)
    /^[a-z]{2,15}[0-9]{1,4}$/
  ];
  
  // Check if username matches common personal name patterns
  return personalPatterns.some(pattern => pattern.test(username));
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
        validationTime: 0,
        checks: {
          syntax: false,
          disposable: false,
          domain: false,
          roleAccount: false
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
        roleAccount: false
      },
      details: {
        roleAccount: null
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
          validationTime: 0,
          checks: {
            syntax: false,
            disposable: false,
            domain: false,
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
      roleBreakdown: {},
      validityRate: 0
    };

    results.forEach(result => {
      if (result.valid) {
        summary.valid++;
        if (result.checks.roleAccount) summary.roleAccounts++;
        // Track types of role accounts
        const roleType = result.details?.roleAccount?.type || 'unknown';
        summary.roleBreakdown[roleType] = (summary.roleBreakdown[roleType] || 0) + 1;
      } else {
        summary.invalid++;
        summary.reasons[result.reason] = (summary.reasons[result.reason] || 0) + 1;
      }
    });

    summary.validityRate = summary.total > 0 
    ? ((summary.valid / summary.total) * 100).toFixed(2) 
    : 0;

    return summary;
  }
}

module.exports = new EmailValidatorService();