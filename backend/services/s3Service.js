const AWS = require('aws-sdk');
const config = require('../config'); // Import the centralized config

// --- AWS S3 Configuration ---
// Configuration is now sourced from the central config module.
// The config module itself handles checking for critical AWS env vars if S3 is intended to be used.

let s3 = null; // Initialize s3 as null

// Check if essential S3 configuration is available
if (config.aws.accessKeyId && config.aws.secretAccessKey && config.aws.s3BucketName && config.aws.region) {
  try {
    s3 = new AWS.S3({
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey,
      region: config.aws.region,
      // signatureVersion: 'v4' // Often recommended, can be added to config if needed
    });
    console.log(`S3 Service: Initializing S3 client for region ${config.aws.region} and bucket ${config.aws.s3BucketName}.`);
    console.log("S3 client initialized successfully.");
  } catch (error) {
    console.error("Error initializing S3 client:", error);
    s3 = null; // Ensure s3 is null if initialization fails
  }
} else {
  console.warn(
    'AWS S3 configuration (accessKeyId, secretAccessKey, s3BucketName, region) is not fully set in the config. ' +
    'S3 functionality will be disabled. This is expected if not using S3 for uploads.'
  );
  // s3 remains null, functions below will check for this.
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
  // AWS_S3_BUCKET_NAME is now config.aws.s3BucketName
  // The check for s3 initialization already implies that config.aws.s3BucketName was present if s3 is not null.
  // However, an explicit check against config.aws.s3BucketName is safer if s3 could be partially initialized.
  if (!config.aws.s3BucketName) {
    console.error('AWS_S3_BUCKET_NAME is not configured in config. Upload aborted.');
    throw new Error('S3 bucket name not configured.');
  }

  const params = {
    Bucket: config.aws.s3BucketName,
    Key: fileName, // File name to save as in S3 (e.g., product-images/image.jpg)
    Body: fileBuffer,
    ContentType: mimeType,
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
   // AWS_S3_BUCKET_NAME is now config.aws.s3BucketName
   if (!config.aws.s3BucketName) {
    console.error('AWS_S3_BUCKET_NAME is not configured in config. Deletion aborted.');
    throw new Error('S3 bucket name not configured.');
  }

  const params = {
    Bucket: config.aws.s3BucketName,
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
  isS3Configured: () => !!(s3 && config.aws.s3BucketName) // Use config for the check
};
