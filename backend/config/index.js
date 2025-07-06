// backend/config/index.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',

  // AWS S3 Configuration (ensure these are set in your .env)
  aws: {
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    s3BucketName: process.env.AWS_S3_BUCKET_NAME,
    s3ProductImageUploadPath: process.env.AWS_S3_PRODUCT_IMAGE_UPLOAD_PATH || 'product-images/',
  },

  // Payment Gateway Configuration (secure credentials from environment)
  payment: {
    // Stripe Configuration
    stripe: {
      enabled: process.env.STRIPE_ENABLED === 'true',
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      secretKey: process.env.STRIPE_SECRET_KEY,
      testMode: process.env.STRIPE_TEST_MODE === 'true',
    },
    
    // PayPal Configuration
    paypal: {
      enabled: process.env.PAYPAL_ENABLED === 'true',
      clientId: process.env.PAYPAL_CLIENT_ID,
      secret: process.env.PAYPAL_SECRET,
      sandbox: process.env.PAYPAL_SANDBOX === 'true',
    },
    
    // PlugNPay Configuration
    plugnpay: {
      enabled: process.env.PLUGNPAY_ENABLED === 'true',
      merchantId: process.env.PLUGNPAY_MERCHANT_ID,
      username: process.env.PLUGNPAY_USERNAME,
      password: process.env.PLUGNPAY_PASSWORD,
      gatewayUrl: process.env.PLUGNPAY_GATEWAY_URL || 'https://pay1.plugnpay.com/pay',
      testMode: process.env.PLUGNPAY_TEST_MODE === 'true',
      achEnabled: process.env.PLUGNPAY_ACH_ENABLED === 'true',
      autoSettle: process.env.PLUGNPAY_AUTO_SETTLE === 'true',
    },
    
    // Cash on Delivery
    cod: {
      enabled: process.env.COD_ENABLED === 'true',
      instructions: process.env.COD_INSTRUCTIONS || 'Please have exact change ready for delivery.',
      requireChange: process.env.COD_REQUIRE_CHANGE === 'true',
    },
    
    // Bank Transfer
    bankTransfer: {
      enabled: process.env.BANK_TRANSFER_ENABLED === 'true',
      bankName: process.env.BANK_NAME,
      accountNumber: process.env.BANK_ACCOUNT_NUMBER,
      routingNumber: process.env.BANK_ROUTING_NUMBER,
      accountHolder: process.env.BANK_ACCOUNT_HOLDER,
      instructions: process.env.BANK_TRANSFER_INSTRUCTIONS,
    },
    
    // Mock Gateway (for testing)
    mockGateway: {
      enabled: process.env.MOCK_GATEWAY_ENABLED === 'true',
    },
    
    // General Payment Settings
    currency: process.env.PAYMENT_CURRENCY || 'USD',
    timeoutMinutes: parseInt(process.env.PAYMENT_TIMEOUT_MINUTES) || 30,
    autoCapture: process.env.AUTO_CAPTURE_PAYMENTS === 'true',
    requireConfirmation: process.env.REQUIRE_PAYMENT_CONFIRMATION === 'true',
  },

  // Email Configuration (ensure these are set if using a real email service)
  email: {
    service: process.env.EMAIL_SERVICE, // e.g., 'gmail', 'sendgrid', 'mailgun'
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true', // use 'true' or 'false' string in .env
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
    fromAddress: process.env.EMAIL_FROM_ADDRESS || '"My Awesome Store" <no-reply@example.com>',
    // For Ethereal (development/testing)
    ethereal: {
        host: process.env.ETHEREAL_HOST,
        port: process.env.ETHEREAL_PORT,
        user: process.env.ETHEREAL_USER,
        pass: process.env.ETHEREAL_PASS,
    }
  },

  // Frontend URL (for things like password reset links, invoice QR codes etc.)
  frontendUrlBase: process.env.FRONTEND_URL_BASE || 'http://localhost:3001',
  frontendInvoiceViewUrlBase: process.env.FRONTEND_INVOICE_VIEW_URL_BASE || 'http://localhost:3001/invoices', // Example for QR codes
  
  // Backend URL (for email tracking, API calls, etc.)
  backendUrlBase: process.env.BACKEND_URL_BASE || 'http://localhost:3000',

  // Company Details (for invoices, emails, etc.)
  company: {
    name: process.env.COMPANY_NAME || "YOUR_COMPANY_NAME",
    address: process.env.COMPANY_ADDRESS || "Your Company Address, Street, City, Postal Code",
    logoUrl: process.env.COMPANY_LOGO_URL || "https://example.com/Logo.svg", // Full public URL to your logo
    phone: process.env.COMPANY_PHONE || "Your Company Phone",
    email: process.env.COMPANY_EMAIL || "yourcompany@example.com",
    website: process.env.COMPANY_WEBSITE || "yourcompanywebsite.com"
  },

  // Default pagination settings
  pagination: {
    defaultLimit: parseInt(process.env.PAGINATION_DEFAULT_LIMIT, 10) || 10,
    maxLimit: parseInt(process.env.PAGINATION_MAX_LIMIT, 10) || 100,
  },

  // Logging configuration
  logLevel: process.env.LOG_LEVEL || 'info',

  // Secret for QR Code Delivery Confirmation
  deliveryConfirmationSecret: process.env.DELIVERY_CONFIRMATION_SECRET || 'default_super_secret_for_dev_only_change_this',

  // Ensure critical configurations are present
  checkCriticalConfig: function() {
    const criticalVars = ['DATABASE_URL', 'JWT_SECRET'];
    const missingVars = criticalVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      console.error(`FATAL ERROR: Missing critical environment variables: ${missingVars.join(', ')}`);
      console.error("Please ensure these are set in your .env file or environment.");
      process.exit(1); // Exit if critical vars are missing
    }

    // Check payment configurations if enabled
    if (this.payment.stripe.enabled) {
      const stripeVars = ['STRIPE_PUBLISHABLE_KEY', 'STRIPE_SECRET_KEY'];
      const missingStripeVars = stripeVars.filter(varName => !process.env[varName]);
      if (missingStripeVars.length > 0) {
        console.warn(`WARNING: Stripe is enabled but missing credentials: ${missingStripeVars.join(', ')}`);
      }
    }

    if (this.payment.paypal.enabled) {
      const paypalVars = ['PAYPAL_CLIENT_ID', 'PAYPAL_SECRET'];
      const missingPaypalVars = paypalVars.filter(varName => !process.env[varName]);
      if (missingPaypalVars.length > 0) {
        console.warn(`WARNING: PayPal is enabled but missing credentials: ${missingPaypalVars.join(', ')}`);
      }
    }

    if (this.payment.plugnpay.enabled) {
      const plugnpayVars = ['PLUGNPAY_MERCHANT_ID', 'PLUGNPAY_USERNAME', 'PLUGNPAY_PASSWORD'];
      const missingPlugNPayVars = plugnpayVars.filter(varName => !process.env[varName]);
      if (missingPlugNPayVars.length > 0) {
        console.warn(`WARNING: PlugNPay is enabled but missing credentials: ${missingPlugNPayVars.join(', ')}`);
      }
    }

    if (this.payment.bankTransfer.enabled) {
      const bankVars = ['BANK_NAME', 'BANK_ACCOUNT_NUMBER'];
      const missingBankVars = bankVars.filter(varName => !process.env[varName]);
      if (missingBankVars.length > 0) {
        console.warn(`WARNING: Bank Transfer is enabled but missing credentials: ${missingBankVars.join(', ')}`);
      }
    }

    if (this.email.service && this.email.service !== 'ethereal' && this.email.service !== 'console') {
        const emailCritical = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS', 'EMAIL_FROM_ADDRESS'];
        const missingEmailVars = emailCritical.filter(varName => !process.env[varName.toUpperCase()]);
        if (missingEmailVars.length > 0) {
            console.warn(`WARNING: Email service is '${this.email.service}' but some email configurations are missing: ${missingEmailVars.join(', ')}`);
        }
    }
    if (this.aws.s3BucketName) { // If S3 bucket is configured, assume AWS creds are important
        const awsCritical = ['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];
        const missingAwsVars = awsCritical.filter(varName => !process.env[varName]);
         if (missingAwsVars.length > 0) {
            console.warn(`WARNING: AWS S3 Bucket is configured but some AWS credentials are missing: ${missingAwsVars.join(', ')}`);
        }
    }
  }
};

// Run the check when the config module is loaded.
config.checkCriticalConfig();

module.exports = config;
