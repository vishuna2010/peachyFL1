// backend/scripts/uploadSiteLogo.js
const path = require('path');
console.log(`Script current working directory: ${process.cwd()}`);
const envPath = path.resolve(__dirname, '../.env');
console.log(`Attempting to load .env from: ${envPath}`);
require('dotenv').config({ path: envPath }); // Load .env from backend directory

const fs = require('fs');
// const path = require('path'); // Removed redundant declaration, already declared above
const { uploadFileToS3, isS3Configured } = require('../services/s3Service');

const LOGO_FILE_PATH = path.join(__dirname, '..', 'assets', 'placeholder_logo.svg');
const LOGO_S3_KEY = 'logos/site_logo.svg'; // Fixed key for the site logo
const LOGO_MIME_TYPE = 'image/svg+xml';

async function main() {
  console.log("Attempting to upload site logo to S3...");

  if (!isS3Configured()) {
    console.error("S3 is not configured. Please check your .env file for AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET_NAME, and AWS_REGION.");
    console.error("Logo upload will be skipped. The application might not display the logo correctly if it expects it from S3.");
    // For local dev without S3, you might copy it to a public static assets folder instead,
    // but the request was to use S3.
    return;
  }

  if (!fs.existsSync(LOGO_FILE_PATH)) {
    console.error(`Logo file not found at ${LOGO_FILE_PATH}`);
    return;
  }

  try {
    const fileBuffer = fs.readFileSync(LOGO_FILE_PATH);
    console.log(`Uploading ${LOGO_FILE_PATH} to S3 key ${LOGO_S3_KEY}...`);

    const uploadResult = await uploadFileToS3(fileBuffer, LOGO_S3_KEY, LOGO_MIME_TYPE);

    console.log("Logo uploaded successfully!");
    console.log("S3 Location:", uploadResult.Location);
    console.log("S3 Key:", uploadResult.Key);
    console.log("\nIMPORTANT: Ensure your backend configuration (e.g., .env file or a settings table)");
    console.log(`is updated with SITE_LOGO_URL=${uploadResult.Location}`);
    console.log("This URL will be used by the frontend and PDF/Email services to display the logo.");

  } catch (error) {
    console.error("Error uploading logo to S3:", error);
    console.error("Please ensure your S3 bucket permissions and AWS credentials are correct.");
  }
}

main().catch(error => {
  console.error("Script failed:", error);
  process.exit(1);
});
