const axios = require('axios');
const { BadRequestError, PaymentError } = require('../utils/AppError');
const logger = require('../utils/logger');
const paymentCredentialService = require('./paymentCredentialService');

class PaymentService {
  constructor() {
    this.credentials = null;
  }

  /**
   * Initialize payment service with credentials
   */
  async initialize() {
    this.credentials = paymentCredentialService.getCredentials();
    paymentCredentialService.logConfigurationStatus();
  }

  /**
   * Get available payment methods based on credentials
   */
  getAvailablePaymentMethods() {
    const methods = [];
    
    if (this.credentials?.stripe.enabled && paymentCredentialService.isMethodConfigured('stripe')) {
      methods.push({
        id: 'stripe',
        name: 'Credit Card',
        description: 'Pay with credit or debit card',
        icon: 'credit-card',
        requiresSetup: false
      });
    }

    if (this.credentials?.paypal.enabled && paymentCredentialService.isMethodConfigured('paypal')) {
      methods.push({
        id: 'paypal',
        name: 'PayPal',
        description: 'Pay with PayPal account',
        icon: 'paypal',
        requiresSetup: false
      });
    }

    if (this.credentials?.plugnpay.enabled && paymentCredentialService.isMethodConfigured('plugnpay')) {
      methods.push({
        id: 'plugnpay',
        name: 'PlugNPay',
        description: 'Secure payment processing',
        icon: 'credit-card',
        requiresSetup: false
      });
    }

    if (this.credentials?.cod.enabled && paymentCredentialService.isMethodConfigured('cod')) {
      methods.push({
        id: 'cod',
        name: 'Cash on Delivery',
        description: 'Pay with cash when your order arrives',
        icon: 'cash',
        requiresSetup: false
      });
    }

    if (this.credentials?.bankTransfer.enabled && paymentCredentialService.isMethodConfigured('bank_transfer')) {
      methods.push({
        id: 'bank_transfer',
        name: 'Bank Transfer',
        description: 'Pay via bank transfer',
        icon: 'bank',
        requiresSetup: false
      });
    }

    if (this.credentials?.mockGateway.enabled && paymentCredentialService.isMethodConfigured('mock_gateway')) {
      methods.push({
        id: 'mock_gateway',
        name: 'Mock Gateway',
        description: 'Simulated payment for testing',
        icon: 'test-tube',
        requiresSetup: false
      });
    }

    return methods;
  }

  /**
   * Process payment with the specified method
   */
  async processPayment(paymentData) {
    const { method, amount, currency, orderId, customerData, paymentToken } = paymentData;

    if (!this.credentials) {
      throw new PaymentError('Payment service not initialized');
    }

    switch (method) {
      case 'stripe':
        return await this.processStripePayment(paymentData);
      case 'paypal':
        return await this.processPayPalPayment(paymentData);
      case 'plugnpay':
        return await this.processPlugNPayPayment(paymentData);
      case 'cod':
        return await this.processCODPayment(paymentData);
      case 'bank_transfer':
        return await this.processBankTransferPayment(paymentData);
      case 'mock_gateway':
        return await this.processMockGatewayPayment(paymentData);
      default:
        throw new BadRequestError(`Unsupported payment method: ${method}`);
    }
  }

  /**
   * Process Stripe payment
   */
  async processStripePayment(paymentData) {
    const { amount, currency, paymentToken, orderId } = paymentData;
    
    if (!this.credentials.stripe.secretKey) {
      throw new PaymentError('Stripe is not properly configured');
    }

    try {
      const stripe = require('stripe')(this.credentials.stripe.secretKey);
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        payment_method: paymentToken,
        confirm: true,
        return_url: `${process.env.FRONTEND_URL}/orders/thank-you?order_id=${orderId}`,
        metadata: {
          order_id: orderId
        }
      });

      return {
        success: true,
        transactionId: paymentIntent.id,
        status: paymentIntent.status,
        amount: amount,
        currency: currency,
        method: 'stripe',
        paymentIntent: paymentIntent
      };
    } catch (error) {
      logger.error('Stripe payment error:', error);
      throw new PaymentError(`Stripe payment failed: ${error.message}`);
    }
  }

  /**
   * Process PayPal payment
   */
  async processPayPalPayment(paymentData) {
    const { amount, currency, paymentToken, orderId } = paymentData;
    
    if (!this.credentials.paypal.clientId || !this.credentials.paypal.secret) {
      throw new PaymentError('PayPal is not properly configured');
    }

    try {
      // Get PayPal access token
      const authResponse = await axios.post(
        this.credentials.paypal.sandbox 
          ? 'https://api-m.sandbox.paypal.com/v1/oauth2/token'
          : 'https://api-m.paypal.com/v1/oauth2/token',
        'grant_type=client_credentials',
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${this.credentials.paypal.clientId}:${this.credentials.paypal.secret}`).toString('base64')}`
          }
        }
      );

      const accessToken = authResponse.data.access_token;

      // Capture the payment
      const captureResponse = await axios.post(
        `${this.credentials.paypal.sandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'}/v2/checkout/orders/${paymentToken}/capture`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const capture = captureResponse.data;

      return {
        success: true,
        transactionId: capture.id,
        status: capture.status,
        amount: amount,
        currency: currency,
        method: 'paypal',
        capture: capture
      };
    } catch (error) {
      logger.error('PayPal payment error:', error);
      throw new PaymentError(`PayPal payment failed: ${error.message}`);
    }
  }

  /**
   * Process PlugNPay payment
   */
  async processPlugNPayPayment(paymentData) {
    const { amount, currency, paymentToken, orderId, customerData } = paymentData;
    
    if (!this.credentials.plugnpay.merchantId || !this.credentials.plugnpay.username || !this.credentials.plugnpay.password) {
      throw new PaymentError('PlugNPay is not properly configured');
    }

    try {
      const gatewayUrl = this.credentials.plugnpay.gatewayUrl;
      
      // Prepare PlugNPay request data
      const requestData = {
        pnpremote: '1',
        x_login: this.credentials.plugnpay.username,
        x_password: this.credentials.plugnpay.password,
        x_type: 'AUTH_CAPTURE',
        x_amount: amount.toFixed(2),
        x_currency_code: currency,
        x_invoice_num: orderId,
        x_description: `Order #${orderId}`,
        x_email: customerData.email,
        x_first_name: customerData.firstName,
        x_last_name: customerData.lastName,
        x_address: customerData.address?.street || '',
        x_city: customerData.address?.city || '',
        x_state: customerData.address?.state || '',
        x_zip: customerData.address?.postalCode || '',
        x_country: customerData.address?.country || '',
        x_phone: customerData.phone || '',
        x_test_request: this.credentials.plugnpay.testMode ? 'TRUE' : 'FALSE',
        x_autosettle: this.credentials.plugnpay.autoSettle ? 'TRUE' : 'FALSE'
      };

      // Add payment token data if provided
      if (paymentToken) {
        requestData.x_card_num = paymentToken.cardNumber;
        requestData.x_exp_date = paymentToken.expiryDate;
        requestData.x_card_code = paymentToken.cvv;
      }

      // Make request to PlugNPay
      const response = await axios.post(gatewayUrl, requestData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      // Parse PlugNPay response
      const responseText = response.data;
      const responseLines = responseText.split('\n');
      const responseData = {};
      
      responseLines.forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
          responseData[key.trim()] = value.trim();
        }
      });

      // Check if payment was successful
      if (responseData.x_response_code === '1' && responseData.x_response_reason_code === '1') {
        return {
          success: true,
          transactionId: responseData.x_trans_id,
          status: 'approved',
          amount: amount,
          currency: currency,
          method: 'plugnpay',
          responseData: responseData
        };
      } else {
        throw new PaymentError(`PlugNPay payment failed: ${responseData.x_response_reason_text || 'Unknown error'}`);
      }
    } catch (error) {
      logger.error('PlugNPay payment error:', error);
      throw new PaymentError(`PlugNPay payment failed: ${error.message}`);
    }
  }

  /**
   * Process Cash on Delivery payment
   */
  async processCODPayment(paymentData) {
    const { amount, currency, orderId } = paymentData;

    // COD payments are always successful but require manual confirmation
    return {
      success: true,
      transactionId: `COD-${orderId}-${Date.now()}`,
      status: 'pending',
      amount: amount,
      currency: currency,
      method: 'cod',
      requiresConfirmation: true,
      instructions: this.credentials.cod.instructions
    };
  }

  /**
   * Process Bank Transfer payment
   */
  async processBankTransferPayment(paymentData) {
    const { amount, currency, orderId } = paymentData;

    if (!this.credentials.bankTransfer.bankName || !this.credentials.bankTransfer.accountNumber) {
      throw new PaymentError('Bank transfer is not properly configured');
    }

    // Bank transfer payments are always successful but require manual confirmation
    return {
      success: true,
      transactionId: `BANK-${orderId}-${Date.now()}`,
      status: 'pending',
      amount: amount,
      currency: currency,
      method: 'bank_transfer',
      requiresConfirmation: true,
      bankDetails: {
        bankName: this.credentials.bankTransfer.bankName,
        accountNumber: this.credentials.bankTransfer.accountNumber,
        routingNumber: this.credentials.bankTransfer.routingNumber,
        accountHolder: this.credentials.bankTransfer.accountHolder,
        instructions: this.credentials.bankTransfer.instructions
      }
    };
  }

  /**
   * Process Mock Gateway payment
   */
  async processMockGatewayPayment(paymentData) {
    const { amount, currency, orderId } = paymentData;
    // Always succeeds instantly for testing
    return {
      success: true,
      transactionId: `MOCK-${orderId}-${Date.now()}`,
      status: 'paid',
      amount: amount,
      currency: currency,
      method: 'mock_gateway',
      test: true
    };
  }

  /**
   * Process refund
   */
  async processRefund(refundData) {
    const { transactionId, amount, currency, method, reason } = refundData;

    switch (method) {
      case 'stripe':
        return await this.processStripeRefund(refundData);
      case 'paypal':
        return await this.processPayPalRefund(refundData);
      case 'plugnpay':
        return await this.processPlugNPayRefund(refundData);
      case 'cod':
      case 'bank_transfer':
        return await this.processManualRefund(refundData);
      case 'mock_gateway':
        return await this.processMockGatewayRefund(refundData);
      default:
        throw new BadRequestError(`Unsupported refund method: ${method}`);
    }
  }

  /**
   * Process Stripe refund
   */
  async processStripeRefund(refundData) {
    const { transactionId, amount, reason } = refundData;

    try {
      const stripe = require('stripe')(this.credentials.stripe.secretKey);
      
      const refund = await stripe.refunds.create({
        payment_intent: transactionId,
        amount: Math.round(amount * 100), // Convert to cents
        reason: reason || 'requested_by_customer'
      });

      return {
        success: true,
        refundId: refund.id,
        status: refund.status,
        amount: amount,
        method: 'stripe'
      };
    } catch (error) {
      logger.error('Stripe refund error:', error);
      throw new PaymentError(`Stripe refund failed: ${error.message}`);
    }
  }

  /**
   * Process PayPal refund
   */
  async processPayPalRefund(refundData) {
    const { transactionId, amount, reason } = refundData;

    try {
      // Get PayPal access token
      const authResponse = await axios.post(
        this.credentials.paypal.sandbox 
          ? 'https://api-m.sandbox.paypal.com/v1/oauth2/token'
          : 'https://api-m.paypal.com/v1/oauth2/token',
        'grant_type=client_credentials',
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${this.credentials.paypal.clientId}:${this.credentials.paypal.secret}`).toString('base64')}`
          }
        }
      );

      const accessToken = authResponse.data.access_token;

      // Process refund
      const refundResponse = await axios.post(
        `${this.credentials.paypal.sandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'}/v2/payments/captures/${transactionId}/refund`,
        {
          amount: {
            value: amount.toFixed(2),
            currency_code: 'USD'
          },
          note_to_payer: reason || 'Refund requested'
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        refundId: refundResponse.data.id,
        status: refundResponse.data.status,
        amount: amount,
        method: 'paypal'
      };
    } catch (error) {
      logger.error('PayPal refund error:', error);
      throw new PaymentError(`PayPal refund failed: ${error.message}`);
    }
  }

  /**
   * Process PlugNPay refund
   */
  async processPlugNPayRefund(refundData) {
    const { transactionId, amount, reason } = refundData;

    try {
      const gatewayUrl = this.credentials.plugnpay.gatewayUrl;
      
      const requestData = {
        pnpremote: '1',
        x_login: this.credentials.plugnpay.username,
        x_password: this.credentials.plugnpay.password,
        x_type: 'CREDIT',
        x_trans_id: transactionId,
        x_amount: amount.toFixed(2),
        x_test_request: this.credentials.plugnpay.testMode ? 'TRUE' : 'FALSE'
      };

      const response = await axios.post(gatewayUrl, requestData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const responseText = response.data;
      const responseLines = responseText.split('\n');
      const responseData = {};
      
      responseLines.forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
          responseData[key.trim()] = value.trim();
        }
      });

      if (responseData.x_response_code === '1' && responseData.x_response_reason_code === '1') {
        return {
          success: true,
          refundId: responseData.x_trans_id,
          status: 'approved',
          amount: amount,
          method: 'plugnpay'
        };
      } else {
        throw new PaymentError(`PlugNPay refund failed: ${responseData.x_response_reason_text || 'Unknown error'}`);
      }
    } catch (error) {
      logger.error('PlugNPay refund error:', error);
      throw new PaymentError(`PlugNPay refund failed: ${error.message}`);
    }
  }

  /**
   * Process manual refund (COD, Bank Transfer)
   */
  async processManualRefund(refundData) {
    const { amount, method, reason } = refundData;

    return {
      success: true,
      refundId: `MANUAL-${Date.now()}`,
      status: 'pending',
      amount: amount,
      method: method,
      requiresManualProcessing: true,
      reason: reason
    };
  }

  /**
   * Process Mock Gateway refund
   */
  async processMockGatewayRefund(refundData) {
    const { transactionId, amount } = refundData;
    // Always succeeds instantly for testing
    return {
      success: true,
      refundId: `MOCK-REFUND-${transactionId}`,
      status: 'approved',
      amount: amount,
      method: 'mock_gateway',
      test: true
    };
  }

  /**
   * Validate payment method configuration
   */
  validatePaymentMethod(method) {
    const isConfigured = paymentCredentialService.isMethodConfigured(method);
    
    switch (method) {
      case 'stripe':
        return {
          valid: isConfigured,
          message: !this.credentials?.stripe.enabled ? 'Stripe is disabled' :
                   !isConfigured ? 'Stripe is not properly configured' : null
        };
      
      case 'paypal':
        return {
          valid: isConfigured,
          message: !this.credentials?.paypal.enabled ? 'PayPal is disabled' :
                   !isConfigured ? 'PayPal is not properly configured' : null
        };
      
      case 'plugnpay':
        return {
          valid: isConfigured,
          message: !this.credentials?.plugnpay.enabled ? 'PlugNPay is disabled' :
                   !isConfigured ? 'PlugNPay is not properly configured' : null
        };
      
      case 'cod':
        return {
          valid: isConfigured,
          message: !this.credentials?.cod.enabled ? 'Cash on Delivery is disabled' : null
        };
      
      case 'bank_transfer':
        return {
          valid: isConfigured,
          message: !this.credentials?.bankTransfer.enabled ? 'Bank Transfer is disabled' :
                   !isConfigured ? 'Bank Transfer is not properly configured' : null
        };
      
      case 'mock_gateway':
        return {
          valid: isConfigured,
          message: !this.credentials?.mockGateway.enabled ? 'Mock Gateway is disabled' : null
        };
      
      default:
        return {
          valid: false,
          message: `Unknown payment method: ${method}`
        };
    }
  }

  /**
   * Get public payment settings (safe to expose to frontend)
   */
  getPublicSettings() {
    return paymentCredentialService.getPublicCredentials();
  }
}

module.exports = new PaymentService(); 