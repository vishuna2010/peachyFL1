const config = require('../config');
const logger = require('../utils/logger');

class PaymentCredentialService {
  constructor() {
    this.credentials = null;
  }

  /**
   * Get all payment credentials from environment variables
   */
  getCredentials() {
    if (this.credentials) {
      return this.credentials;
    }

    this.credentials = {
      // Stripe credentials
      stripe: {
        enabled: config.payment.stripe.enabled,
        publishableKey: config.payment.stripe.publishableKey,
        secretKey: config.payment.stripe.secretKey,
        testMode: config.payment.stripe.testMode,
      },

      // PayPal credentials
      paypal: {
        enabled: config.payment.paypal.enabled,
        clientId: config.payment.paypal.clientId,
        secret: config.payment.paypal.secret,
        sandbox: config.payment.paypal.sandbox,
      },

      // PlugNPay credentials
      plugnpay: {
        enabled: config.payment.plugnpay.enabled,
        merchantId: config.payment.plugnpay.merchantId,
        username: config.payment.plugnpay.username,
        password: config.payment.plugnpay.password,
        gatewayUrl: config.payment.plugnpay.gatewayUrl,
        testMode: config.payment.plugnpay.testMode,
        achEnabled: config.payment.plugnpay.achEnabled,
        autoSettle: config.payment.plugnpay.autoSettle,
      },

      // Cash on Delivery settings
      cod: {
        enabled: config.payment.cod.enabled,
        instructions: config.payment.cod.instructions,
        requireChange: config.payment.cod.requireChange,
      },

      // Bank Transfer settings
      bankTransfer: {
        enabled: config.payment.bankTransfer.enabled,
        bankName: config.payment.bankTransfer.bankName,
        accountNumber: config.payment.bankTransfer.accountNumber,
        routingNumber: config.payment.bankTransfer.routingNumber,
        accountHolder: config.payment.bankTransfer.accountHolder,
        instructions: config.payment.bankTransfer.instructions,
      },

      // Mock Gateway settings
      mockGateway: {
        enabled: config.payment.mockGateway.enabled,
      },

      // General payment settings
      general: {
        currency: config.payment.currency,
        timeoutMinutes: config.payment.timeoutMinutes,
        autoCapture: config.payment.autoCapture,
        requireConfirmation: config.payment.requireConfirmation,
      }
    };

    return this.credentials;
  }

  /**
   * Get credentials for a specific payment method
   */
  getMethodCredentials(method) {
    const credentials = this.getCredentials();
    return credentials[method] || null;
  }

  /**
   * Check if a payment method is properly configured
   */
  isMethodConfigured(method) {
    const credentials = this.getMethodCredentials(method);
    
    if (!credentials || !credentials.enabled) {
      return false;
    }

    switch (method) {
      case 'stripe':
        return !!(credentials.publishableKey && credentials.secretKey);
      
      case 'paypal':
        return !!(credentials.clientId && credentials.secret);
      
      case 'plugnpay':
        return !!(credentials.merchantId && credentials.username && credentials.password);
      
      case 'cod':
        return credentials.enabled;
      
      case 'bank_transfer':
        return !!(credentials.bankName && credentials.accountNumber);
      
      case 'mock_gateway':
        return credentials.enabled;
      
      default:
        return false;
    }
  }

  /**
   * Get public credentials (safe to expose to frontend)
   */
  getPublicCredentials() {
    const credentials = this.getCredentials();
    
    return {
      stripe: {
        enabled: credentials.stripe.enabled,
        publishableKey: credentials.stripe.publishableKey, // Safe to expose
        testMode: credentials.stripe.testMode,
      },
      paypal: {
        enabled: credentials.paypal.enabled,
        clientId: credentials.paypal.clientId, // Safe to expose
        sandbox: credentials.paypal.sandbox,
      },
      plugnpay: {
        enabled: credentials.plugnpay.enabled,
        testMode: credentials.plugnpay.testMode,
      },
      cod: {
        enabled: credentials.cod.enabled,
        instructions: credentials.cod.instructions,
      },
      bankTransfer: {
        enabled: credentials.bankTransfer.enabled,
        bankName: credentials.bankTransfer.bankName,
        accountHolder: credentials.bankTransfer.accountHolder,
        instructions: credentials.bankTransfer.instructions,
      },
      mockGateway: {
        enabled: credentials.mockGateway.enabled,
      },
      general: {
        currency: credentials.general.currency,
        timeoutMinutes: credentials.general.timeoutMinutes,
      }
    };
  }

  /**
   * Validate all payment configurations
   */
  validateConfigurations() {
    const credentials = this.getCredentials();
    const issues = [];

    // Check Stripe
    if (credentials.stripe.enabled) {
      if (!credentials.stripe.publishableKey) {
        issues.push('Stripe publishable key is missing');
      }
      if (!credentials.stripe.secretKey) {
        issues.push('Stripe secret key is missing');
      }
    }

    // Check PayPal
    if (credentials.paypal.enabled) {
      if (!credentials.paypal.clientId) {
        issues.push('PayPal client ID is missing');
      }
      if (!credentials.paypal.secret) {
        issues.push('PayPal secret is missing');
      }
    }

    // Check PlugNPay
    if (credentials.plugnpay.enabled) {
      if (!credentials.plugnpay.merchantId) {
        issues.push('PlugNPay merchant ID is missing');
      }
      if (!credentials.plugnpay.username) {
        issues.push('PlugNPay username is missing');
      }
      if (!credentials.plugnpay.password) {
        issues.push('PlugNPay password is missing');
      }
    }

    // Check Bank Transfer
    if (credentials.bankTransfer.enabled) {
      if (!credentials.bankTransfer.bankName) {
        issues.push('Bank name is missing');
      }
      if (!credentials.bankTransfer.accountNumber) {
        issues.push('Bank account number is missing');
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Log configuration status (without exposing sensitive data)
   */
  logConfigurationStatus() {
    const credentials = this.getCredentials();
    const status = {
      stripe: {
        enabled: credentials.stripe.enabled,
        configured: this.isMethodConfigured('stripe'),
        testMode: credentials.stripe.testMode
      },
      paypal: {
        enabled: credentials.paypal.enabled,
        configured: this.isMethodConfigured('paypal'),
        sandbox: credentials.paypal.sandbox
      },
      plugnpay: {
        enabled: credentials.plugnpay.enabled,
        configured: this.isMethodConfigured('plugnpay'),
        testMode: credentials.plugnpay.testMode
      },
      cod: {
        enabled: credentials.cod.enabled,
        configured: this.isMethodConfigured('cod')
      },
      bankTransfer: {
        enabled: credentials.bankTransfer.enabled,
        configured: this.isMethodConfigured('bank_transfer')
      },
      mockGateway: {
        enabled: credentials.mockGateway.enabled,
        configured: this.isMethodConfigured('mock_gateway')
      }
    };

    logger.info('Payment configuration status:', status);
    return status;
  }
}

module.exports = new PaymentCredentialService(); 