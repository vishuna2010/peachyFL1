const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');
const { productImageUploadMiddleware, handleMulterError } = require('../middleware/fileUpload');
const { uploadFileToS3, deleteFileFromS3, isS3Configured, getS3KeyFromUrl } = require('../services/s3Service'); // Assuming getS3KeyFromUrl might be useful later
const { param, body, validationResult } = require('express-validator');

router.use(isAuthenticated, isAdmin); // Apply to all routes in this file

// POST /products/:productId/images
router.post(
  '/:productId/images',
  [ // productId validation
    param('productId').isInt({ gt: 0 }).withMessage('Product ID must be a positive integer.')
  ],
  productImageUploadMiddleware, // Handles single file upload to req.file
  handleMulterError,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId } = req.params;
    const { alt_text, display_order } = req.body; // display_order can be optional

    if (!req.file) {
      return res.status(400).json({ message: 'Image file is required.' });
    }

    let imageUrl = null;
    let s3FileKey = null;
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Check if product exists
      const productCheck = await client.query('SELECT id FROM products WHERE id = $1', [productId]);
      if (productCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: `Product with ID ${productId} not found.` });
      }

      if (isS3Configured()) {
        const uniqueFileName = `product-gallery/${productId}/image-${Date.now()}-${req.file.originalname.replace(/\s+/g, '_')}`;
        const s3Data = await uploadFileToS3(req.file.buffer, uniqueFileName, req.file.mimetype);
        imageUrl = s3Data.Location;
        s3FileKey = s3Data.Key;
      } else {
        // For product gallery, not having S3 is a bigger issue than for a single product main image.
        // Consider this an error or unsupported configuration for this feature.
        await client.query('ROLLBACK');
        console.error("Product Image Gallery: S3 not configured. Cannot upload image.");
        return res.status(500).json({ message: "Image storage service is not configured for gallery." });
      }

      const insertQuery = `
        INSERT INTO product_images (product_id, image_url, s3_key, alt_text, display_order)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `;
      // display_order validation and parsing
      let parsedDisplayOrder = 0; // Default if not provided or empty
      if (display_order !== undefined && display_order !== null && display_order !== '') {
          parsedDisplayOrder = parseInt(display_order);
          if (isNaN(parsedDisplayOrder)) {
              await client.query('ROLLBACK');
              if (s3FileKey) { // S3 upload might have happened before this check
                  try { await deleteFileFromS3(s3FileKey); } catch (e) { console.error("Failed to delete S3 object after invalid display_order:", e); }
              }
              return res.status(400).json({ message: "Invalid display_order format. Must be an integer." });
          }
      }


      const values = [
        productId,
        imageUrl,
        s3FileKey,
        alt_text || null,
        parsedDisplayOrder
      ];

      const result = await client.query(insertQuery, values);
      await client.query('COMMIT');
      res.status(201).json(result.rows[0]);

    } catch (error) {
      if (!client._hadError) { // Check if rollback hasn't already been called by a client error
          try { await client.query('ROLLBACK'); } catch (rbError) { console.error("Error rolling back transaction:", rbError); }
      }
      // If S3 upload was successful but DB operations failed, try to delete the S3 object
      if (s3FileKey && isS3Configured()) {
        try {
          await deleteFileFromS3(s3FileKey);
          console.log(`Rolled back S3 upload for key: ${s3FileKey} due to DB error.`);
        } catch (s3DeleteError) {
          console.error(`Failed to rollback S3 upload for key ${s3FileKey}:`, s3DeleteError);
          // Potentially log this for manual cleanup: orphan S3 object
        }
      }
      console.error('Error uploading product image:', error);
      // Avoid sending generic 500 if it's a known validation type error from display_order parsing for example
      if (res.headersSent) return;
      return res.status(500).json({ message: 'Failed to upload product image.' });
    } finally {
      client.release();
    }
  }
);

// PUT /images/:imageId - Update image metadata
router.put(
  '/images/:imageId',
  [
    param('imageId').isInt({ gt: 0 }).withMessage('Image ID must be a positive integer.'),
    body('alt_text').optional({ nullable: true }).isString().trim().isLength({ max: 255 }).withMessage('Alt text must be a string up to 255 characters.'),
    // Ensure display_order is an integer. toInt() will coerce valid number strings.
    body('display_order').optional().isInt({min: 0}).withMessage('Display order must be a non-negative integer.').toInt()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { imageId } = req.params;
    // req.body will have coerced values if validation passed
    const { alt_text, display_order } = req.body;

    if (alt_text === undefined && display_order === undefined) {
      return res.status(400).json({ message: 'No fields provided for update. Please provide alt_text or display_order.' });
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Check if image exists and lock the row
      const currentImageResult = await client.query('SELECT id FROM product_images WHERE id = $1 FOR UPDATE', [imageId]);
      if (currentImageResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: `Product image with ID ${imageId} not found.` });
      }

      const setClauses = [];
      const values = [];
      let paramIndex = 1;

      if (alt_text !== undefined) {
        setClauses.push(`alt_text = $${paramIndex++}`);
        // If alt_text is an empty string, it will be stored as such.
        // If it was validated with .optional({nullable: true}) and client sends null, it will be null.
        values.push(alt_text);
      }
      if (display_order !== undefined) {
        // display_order is already an integer due to .isInt().toInt() or undefined
        setClauses.push(`display_order = $${paramIndex++}`);
        values.push(display_order);
      }

      // This check should ideally not be hit if the initial check for no fields is in place.
      if (setClauses.length === 0) {
        await client.query('ROLLBACK'); // Should not happen due to initial check
        return res.status(400).json({ message: 'No valid fields to update provided.' });
      }

      setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(imageId); // For the WHERE id = $N clause

      const updateQuery = `
        UPDATE product_images
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *;
      `;

      const result = await client.query(updateQuery, values);
      await client.query('COMMIT');

      res.status(200).json(result.rows[0]);

    } catch (error) {
      if (!client._hadError) { // Check if rollback hasn't already been called
          try { await client.query('ROLLBACK'); } catch (rbError) { console.error("Error rolling back transaction:", rbError); }
      }
      console.error(`Error updating product image ID ${imageId}:`, error);
      if (res.headersSent) return;
      return res.status(500).json({ message: 'Failed to update product image metadata.' });
    } finally {
      client.release();
    }
  }
);

// DELETE /images/:imageId
router.delete(
  '/images/:imageId', // Path relative to this router's mount point
  [
    param('imageId').isInt({ gt: 0 }).withMessage('Image ID must be a positive integer.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { imageId } = req.params;
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Fetch image details, especially s3_key
      const imageResult = await client.query('SELECT product_id, s3_key, image_url FROM product_images WHERE id = $1 FOR UPDATE', [imageId]);
      if (imageResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: `Product image with ID ${imageId} not found.` });
      }
      const { product_id, s3_key, image_url } = imageResult.rows[0];

      // Delete from product_images table
      const deleteDbResult = await client.query('DELETE FROM product_images WHERE id = $1 RETURNING id', [imageId]);
      if (deleteDbResult.rowCount === 0) {
        // Should not happen if previous select found it and FOR UPDATE was used, but as a safeguard
        await client.query('ROLLBACK');
        return res.status(404).json({ message: `Product image with ID ${imageId} not found during delete operation.` });
      }

      // If S3 key exists, attempt to delete from S3
      if (s3_key && isS3Configured()) {
        try {
          await deleteFileFromS3(s3_key);
          console.log(`Successfully deleted image from S3: ${s3_key}`);
        } catch (s3Error) {
          console.error(`Error deleting image from S3 (key: ${s3_key}, imageId: ${imageId}, url: ${image_url}):`, s3Error);
          // Log this error for potential manual cleanup of an orphan S3 object.
          // The DB record is deleted, and we will commit this change.
        }
      } else if (s3_key && !isS3Configured()) {
        console.warn(`S3 not configured. Cannot delete S3 object for key: ${s3_key} (imageId: ${imageId})`);
      }

      await client.query('COMMIT');
      // Return 200 with imageId and productId for client-side state update
      res.status(200).json({ message: 'Product image deleted successfully.', imageId: parseInt(imageId), productId: product_id });
      // Or use res.status(204).send(); if no content is preferred

    } catch (error) {
      if (!client._hadError) { // Check if rollback hasn't already been called
          try { await client.query('ROLLBACK'); } catch (rbError) { console.error("Error rolling back transaction:", rbError); }
      }
      console.error(`Error deleting product image ID ${imageId}:`, error);
      if (res.headersSent) return;
      return res.status(500).json({ message: 'Failed to delete product image.' });
    } finally {
      client.release();
    }
  }
);

module.exports = router;
