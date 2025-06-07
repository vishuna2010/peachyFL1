const AWS = require('aws-sdk');

// --- AWS S3 Configuration ---
// These environment variables are CRUCIAL for S3 operations.
// Ensure they are set in your deployment environment.
// For local development, you might use a .env file (ensure it's in .gitignore)
// or configure AWS shared credentials (~/.aws/credentials).

const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;
const AWS_REGION = process.env.AWS_REGION;

let s3;

if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_S3_BUCKET_NAME || !AWS_REGION) {
  console.warn(
    'AWS S3 environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET_NAME, AWS_REGION) are not fully configured. ' +
    'S3 functionality will be disabled or may fail. This is expected if not using S3 for uploads.'
  );
  // Optionally, you could have a fallback storage mechanism or disable S3 features.
  // For this service, we'll let it attempt to initialize, and calls will fail if not configured.
} else {
    console.log(`S3 Service: Initializing S3 client for region ${AWS_REGION} and bucket ${AWS_S3_BUCKET_NAME}.`);
}

// Initialize S3 client
// The SDK will automatically pick up credentials from environment variables if set,
// or from shared credentials files, or IAM roles if running on EC2/ECS.
// Explicitly passing them is also an option but generally less secure if hardcoded.
// We rely on the environment variables being set.
try {
    s3 = new AWS.S3({
        accessKeyId: AWS_ACCESS_KEY_ID,         // Optional if using other auth methods like IAM roles
        secretAccessKey: AWS_SECRET_ACCESS_KEY, // Optional if using other auth methods
        region: AWS_REGION,
        // signatureVersion: 'v4' // Often recommended for security
    });
    console.log("S3 client initialized successfully.");
} catch (error) {
    console.error("Error initializing S3 client:", error);
    s3 = null; // Ensure s3 is null if initialization fails
}


/**
 * Uploads a file buffer to AWS S3.
 * @param {Buffer} fileBuffer - The buffer of the file to upload.
 * @param {string} fileName - The desired S3 object key (e.g., 'product-images/timestamp-originalfilename.ext').
 * @param {string} mimeType - The MIME type of the file (e.g., 'image/jpeg').
 * @returns {Promise<object>} An object containing the S3 Location (URL) and Key.
 * @throws {Error} If the upload fails.
 */
async function uploadFileToS3(fileBuffer, fileName, mimeType) {
  if (!s3) {
    console.error('S3 client not initialized. Upload aborted. Check AWS configuration.');
    throw new Error('S3 client not initialized. Cannot upload file.');
  }
  if (!AWS_S3_BUCKET_NAME) {
    console.error('AWS_S3_BUCKET_NAME is not configured. Upload aborted.');
    throw new Error('S3 bucket name not configured.');
  }

  const params = {
    Bucket: AWS_S3_BUCKET_NAME,
    Key: fileName, // File name to save as in S3 (e.g., product-images/image.jpg)
    Body: fileBuffer,
    ContentType: mimeType,
    ACL: 'public-read', // Makes the file publicly readable via its S3 URL
  };

  try {
    const data = await s3.upload(params).promise();
    console.log(`File uploaded successfully to S3. Location: ${data.Location}, Key: ${data.Key}`);
    return {
      Location: data.Location, // URL of the uploaded file
      Key: data.Key,           // S3 object key
    };
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw error; // Re-throw to be caught by the caller
  }
}

/**
 * Deletes a file from AWS S3.
 * @param {string} fileKey - The S3 object key of the file to delete.
 * @returns {Promise<object>} The response from S3's deleteObject.
 * @throws {Error} If the deletion fails.
 */
async function deleteFileFromS3(fileKey) {
  if (!s3) {
    console.error('S3 client not initialized. Deletion aborted. Check AWS configuration.');
    throw new Error('S3 client not initialized. Cannot delete file.');
  }
   if (!AWS_S3_BUCKET_NAME) {
    console.error('AWS_S3_BUCKET_NAME is not configured. Deletion aborted.');
    throw new Error('S3 bucket name not configured.');
  }

  const params = {
    Bucket: AWS_S3_BUCKET_NAME,
    Key: fileKey,
  };

  try {
    const response = await s3.deleteObject(params).promise();
    console.log(`File deleted successfully from S3. Key: ${fileKey}`);
    return response;
  } catch (error) {
    console.error(`Error deleting file ${fileKey} from S3:`, error);
    throw error; // Re-throw to be caught by the caller
  }
}

module.exports = {
  uploadFileToS3,
  deleteFileFromS3,
  isS3Configured: () => !!(s3 && AWS_S3_BUCKET_NAME) // Helper to check if S3 is likely usable
};
