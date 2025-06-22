const AWS = require('aws-sdk');

// --- AWS S3 Configuration ---
const config = require('../config'); // Import centralized configuration

// --- AWS S3 Configuration ---
// Fetched from the central config module.

const AWS_ACCESS_KEY_ID = config.awsAccessKeyId;
const AWS_SECRET_ACCESS_KEY = config.awsSecretAccessKey;
const AWS_S3_BUCKET_NAME = config.awsS3BucketName;
const AWS_REGION = config.awsRegion;

let s3;

if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_S3_BUCKET_NAME || !AWS_REGION) {
  console.warn(
    'S3Service: AWS S3 environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET_NAME, AWS_REGION) are not fully configured via config.js. ' +
    'S3 functionality will be disabled or may fail. This is expected if not using S3 for uploads.'
  );
} else {
    console.log(`S3Service: Initializing S3 client for region ${AWS_REGION} and bucket ${AWS_S3_BUCKET_NAME}.`);
}

try {
    // Only initialize if essential params are present
    if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY && AWS_REGION && AWS_S3_BUCKET_NAME) {
        s3 = new AWS.S3({
            accessKeyId: AWS_ACCESS_KEY_ID,
            secretAccessKey: AWS_SECRET_ACCESS_KEY,
            region: AWS_REGION,
        });
        console.log("S3Service: S3 client initialized successfully.");
    } else {
        s3 = null;
        console.log("S3Service: S3 client not initialized due to missing configuration.");
    }
} catch (error) {
    console.error("S3Service: Error initializing S3 client:", error);
    s3 = null;
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
    console.error('S3Service: S3 client not initialized. Upload aborted. Check AWS configuration via config.js.');
    throw new Error('S3 client not initialized. Cannot upload file.');
  }
  // AWS_S3_BUCKET_NAME is already checked during s3 initialization effectively

  const params = {
    Bucket: AWS_S3_BUCKET_NAME, // This comes from config now
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
