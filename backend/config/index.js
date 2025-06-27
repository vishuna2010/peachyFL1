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

  // Ensure critical configurations are present
  checkCriticalConfig: function() {
    const criticalVars = ['DATABASE_URL', 'JWT_SECRET'];
    const missingVars = criticalVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      console.error(`FATAL ERROR: Missing critical environment variables: ${missingVars.join(', ')}`);
      console.error("Please ensure these are set in your .env file or environment.");
      process.exit(1); // Exit if critical vars are missing
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
