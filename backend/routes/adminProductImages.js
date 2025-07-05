const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');
const { productImageUploadMiddleware, handleMulterError } = require('../middleware/fileUpload');
const { uploadFileToS3, deleteFileFromS3, isS3Configured } = require('../services/s3Service');
const { getS3KeyFromUrl } = require('../utils/productHelpers');
const { param, body, validationResult } = require('express-validator');

router.use(isAuthenticated, isAdmin); // Apply to all routes in this file

// GET /products/:productId/images - List all images for a product
router.get(
  '/:productId/images',
  [
    param('productId').isInt({ gt: 0 }).withMessage('Product ID must be a positive integer.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId } = req.params;

    try {
      // Check if product exists
      const productCheck = await db.query('SELECT id FROM products WHERE id = $1', [productId]);
      if (productCheck.rows.length === 0) {
        return res.status(404).json({ message: `Product with ID ${productId} not found.` });
      }

      const imagesQuery = `
        SELECT id, product_id, image_url, alt_text, display_order, is_primary, created_at, updated_at
        FROM product_images
        WHERE product_id = $1
        ORDER BY display_order ASC, id ASC;
      `;
      const { rows } = await db.query(imagesQuery, [productId]);
      res.status(200).json(rows);
    } catch (error) {
      console.error(`Error fetching images for product ID ${productId}:`, error);
      next(error);
    }
  }
);

// POST /products/:productId/images
router.post(
  '/:productId/images',
  [ // productId validation
    param('productId').isInt({ gt: 0 }).withMessage('Product ID must be a positive integer.'),
    body('is_primary').optional().isBoolean().toBoolean() // Added validator for is_primary
  ],
  productImageUploadMiddleware, // Handles single file upload to req.file
  handleMulterError,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId } = req.params;
    const { alt_text, display_order, is_primary } = req.body; // Added is_primary

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

      // Handle is_primary logic
      let newImageIsPrimary = is_primary || false; // is_primary from body (coerced to boolean), defaults to false

      if (newImageIsPrimary) {
        // Unset other primary images for this product
        await client.query(
          'UPDATE product_images SET is_primary = FALSE, updated_at = CURRENT_TIMESTAMP WHERE product_id = $1 AND is_primary = TRUE',
          [productId]
        );
      } else {
        // Check if any other image is primary for this product
        const primaryCheck = await client.query(
          'SELECT id FROM product_images WHERE product_id = $1 AND is_primary = TRUE LIMIT 1',
          [productId]
        );
        if (primaryCheck.rows.length === 0) {
          newImageIsPrimary = true; // Make this one primary if no other primary exists
        }
      }

      const insertQuery = `
        INSERT INTO product_images (product_id, image_url, s3_key, alt_text, display_order, is_primary)
        VALUES ($1, $2, $3, $4, $5, $6)
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
        parsedDisplayOrder,
        newImageIsPrimary // Use the determined is_primary state
      ];

      const result = await client.query(insertQuery, values);
      const newImage = result.rows[0]; // Get the newly inserted image

      if (newImage.is_primary) {
        // Update the parent product's image_url
        await client.query(
          'UPDATE products SET image_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [newImage.image_url, productId]
        );
      }

      await client.query('COMMIT');
      res.status(201).json(newImage); // Return the new image object

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
    body('display_order').optional().isInt({min: 0}).withMessage('Display order must be a non-negative integer.').toInt(),
    body('is_primary').optional().isBoolean().toBoolean() // Added is_primary validation
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { imageId } = req.params;
    const { alt_text, display_order, is_primary } = req.body; // Added is_primary

    if (alt_text === undefined && display_order === undefined && is_primary === undefined) {
      return res.status(400).json({ message: 'No fields provided for update. Please provide alt_text, display_order, or is_primary.' });
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Fetch current image details to know its product_id and current is_primary state
      const currentImageQuery = 'SELECT id, product_id, is_primary as current_is_primary, image_url FROM product_images WHERE id = $1 FOR UPDATE';
      const currentImageResult = await client.query(currentImageQuery, [imageId]);
      if (currentImageResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: `Product image with ID ${imageId} not found.` });
      }
      const currentImage = currentImageResult.rows[0];
      const parentProductId = currentImage.product_id;

      // If is_primary is true in the request and the image is not already primary
      if (is_primary === true && !currentImage.current_is_primary) {
        // Unset other primary images for this product
        await client.query(
          'UPDATE product_images SET is_primary = FALSE, updated_at = CURRENT_TIMESTAMP WHERE product_id = $1 AND is_primary = TRUE',
          [parentProductId]
        );
      }

      const setClauses = [];
      const values = [];
      let paramIndex = 1;

      if (alt_text !== undefined) {
        setClauses.push(`alt_text = $${paramIndex++}`);
        values.push(alt_text);
      }
      if (display_order !== undefined) {
        setClauses.push(`display_order = $${paramIndex++}`);
        values.push(display_order);
      }
      if (is_primary !== undefined) {
        setClauses.push(`is_primary = $${paramIndex++}`);
        values.push(is_primary);
      }

      if (setClauses.length === 0) {
        // This case is effectively handled by the initial check for any undefined fields.
        // If somehow reached, returning the current image might be an option, or 304 Not Modified.
        // For now, consistent with previous check, this implies an issue if reached.
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'No valid fields specified for update.' });
      }

      setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(imageId);

      const updateQuery = `
        UPDATE product_images
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *;
      `;

      const result = await client.query(updateQuery, values);
      const updatedImage = result.rows[0];

      // Update parent product's image_url based on is_primary changes
      if (is_primary !== undefined) { // Only if is_primary was part of this update request
        if (updatedImage.is_primary) {
          await client.query(
            'UPDATE products SET image_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [updatedImage.image_url, parentProductId]
          );
        } else if (currentImage.current_is_primary) {
          // If this image WAS primary and is now set to false, set parent product image_url to null
          // This assumes no other image was made primary in this same transaction explicitly by this logic path.
          // The unique constraint handles direct conflicts.
           const productUrlCheck = await client.query(
              'SELECT image_url FROM products WHERE id = $1',
              [parentProductId]
           );
           // Only set to NULL if this specific image_url was the one on the product record
           if (productUrlCheck.rows.length > 0 && productUrlCheck.rows[0].image_url === currentImage.image_url) {
              await client.query(
                'UPDATE products SET image_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
                [parentProductId]
              );
           }
        }
      }

      await client.query('COMMIT');
      res.status(200).json(updatedImage);

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

      // Fetch image details, including is_primary, s3_key
      const imageResult = await client.query('SELECT product_id, s3_key, image_url, is_primary FROM product_images WHERE id = $1 FOR UPDATE', [imageId]);
      if (imageResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: `Product image with ID ${imageId} not found.` });
      }
      const { product_id, s3_key, image_url, is_primary } = imageResult.rows[0];

      // If the image being deleted was primary, set parent product's image_url to NULL
      if (is_primary) {
        await client.query(
          'UPDATE products SET image_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
          [product_id]
        );
      }

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
