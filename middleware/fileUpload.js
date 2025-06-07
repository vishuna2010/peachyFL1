const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Define the destination folder for product images
const uploadDir = 'uploads/product_images/';

// Ensure the upload directory exists
if (!fs.existsSync(uploadDir)) {
  // fs.mkdirSync(uploadDir, { recursive: true }); // No longer needed for memoryStorage
  // console.log(`Created directory: ${uploadDir}`);
// } else {
  // console.log(`Directory already exists: ${uploadDir}`);
// }

// Multer memory storage configuration
// This keeps the file in memory as a Buffer, accessible via req.file.buffer
const storage = multer.memoryStorage();

// File filter to accept only images
const imageFileFilter = (req, file, cb) => {
  // Allowed ext
  const filetypes = /jpeg|jpg|png|gif|webp/;
  // Check ext
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  // Check mime
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Error: Images Only! (jpeg, jpg, png, gif, webp)'), false);
  }
};

// Initialize multer with storage and file filter configuration
// 'productImage' will be the field name in the form-data
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
  fileFilter: imageFileFilter
});

// Middleware to handle 'productImage' field.
// This can be directly used in routes.
// Example: router.post('/upload', productImageUploadMiddleware, (req, res) => { ... });
const productImageUploadMiddleware = upload.single('productImage');

// Custom error handling middleware for multer errors (optional, but good for users)
// This should be used in the route handling chain *after* the multer middleware.
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // A Multer error occurred when uploading.
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Maximum size is 5MB.' });
    }
    // Handle other multer errors if needed
    return res.status(400).json({ message: err.message });
  } else if (err) {
    // An unknown error occurred when uploading (e.g., our custom "Images Only!" error)
    // Check if it's our custom file filter error
    if (err.message && err.message.startsWith('Error: Images Only!')) {
        return res.status(400).json({ message: err.message });
    }
    return res.status(500).json({ message: `Unknown upload error: ${err.message}` });
  }
  // Everything went fine, proceed to next middleware or route handler
  next();
};


module.exports = {
    productImageUploadMiddleware,
    handleMulterError
};
