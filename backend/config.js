// backend/config.js
require('dotenv').config();

const config = {
  databaseUrl: process.env.DATABASE_URL,
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET,
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  awsRegion: process.env.AWS_REGION,
  awsS3BucketName: process.env.AWS_S3_BUCKET_NAME,
  siteLogoUrl: process.env.SITE_LOGO_URL || '/assets/placeholder_logo.svg', // Fallback to a local placeholder if not defined
  nodeEnv: process.env.NODE_ENV || 'development',
};

// Validate essential configurations
if (!config.databaseUrl) {
  console.warn('DATABASE_URL is not defined in environment variables.');
}
if (!config.jwtSecret) {
  console.warn('JWT_SECRET is not defined in environment variables. Using a default (unsafe) secret for development is discouraged for production.');
}
if (!config.siteLogoUrl && config.nodeEnv !== 'test') { // Don't warn in test environment for this one
    console.warn('SITE_LOGO_URL is not defined. The application will use a default placeholder. Ensure this is set for production for S3 integration.');
}


// Log S3 configuration status for easier debugging
const s3Configured = config.awsAccessKeyId && config.awsSecretAccessKey && config.awsRegion && config.awsS3BucketName;
console.log(`S3 Storage Configured: ${s3Configured ? 'Yes' : 'No (some AWS variables are missing)'}`);
if (s3Configured && config.siteLogoUrl === '/assets/placeholder_logo.svg') {
    console.warn('S3 is configured, but SITE_LOGO_URL is using the default local placeholder. Ensure SITE_LOGO_URL points to your S3 logo.');
}


module.exports = config;
