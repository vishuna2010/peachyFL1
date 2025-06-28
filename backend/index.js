// require('dotenv').config(); // Moved to config/index.js
const config = require('./config'); // Import the centralized config
const logger = require('./utils/logger'); // Import the structured logger
const pinoHttp = require('pino-http'); // Import pino-http
const express = require('express');
const cors = require('cors'); // Import CORS
const helmet = require('helmet'); // Import Helmet
// const authModule = require('./auth'); // No longer needed here, logic is in routes/auth.js
const authRoutes = require('./routes/auth'); // Import the new auth router
const db = require('./db'); // Import the db module to ensure tables are created
const productRoutes = require('./routes/products'); // Import product routes
const adminUserRoutes = require('./routes/adminUsers'); // Import admin user routes
const adminOrderRoutes = require('./routes/adminOrders'); // Import admin order routes
const adminProductRoutes = require('./routes/adminProducts'); // Import admin product routes
const adminDiscountRoutes = require('./routes/adminDiscounts'); // Import admin discount routes
const adminSupplierRoutes = require('./routes/adminSuppliers'); // Import admin supplier routes
const adminPurchaseOrderRoutes = require('./routes/adminPurchaseOrders'); // Import admin PO routes
const adminStockMovementLogsRoutes = require('./routes/adminStockMovementLogs');
const adminInventoryBatchesRoutes = require('./routes/adminInventoryBatches'); // Added this line
const adminReportRoutes = require('./routes/adminReports'); // Import admin report routes
const adminAuditLogsRouter = require('./routes/adminAuditLogs');
const adminAssignedOptionsRouter = require('./routes/adminAssignedOptions');
console.log('>>> adminAssignedOptionsRouter type:', typeof adminAssignedOptionsRouter, 'Is function:', adminAssignedOptionsRouter instanceof Function);
const adminProductSpecificOptionsRoutes = require('./routes/adminProductSpecificOptions'); // Import product-specific option config routes
const adminOptionManagementRoutes = require('./routes/adminOptionManagement'); // Import admin option management routes
const adminProductVariantsRoutes = require('./routes/adminProductVariants.js'); // Import admin product variants routes
// const adminVariantDetailRoutes = require('./routes/adminVariantDetails.js');   // For variant-specific GET/PUT/DELETE by variant ID - Note: adminProductVariantsRoutes now includes /variants/:variantId
const adminReviewRoutes = require('./routes/adminReviews'); // Import admin review routes
const adminCategoryRoutes = require('./routes/adminCategories'); // Import admin category routes
const adminStatsRoutes = require('./routes/adminStats'); // Import admin statistics routes
const adminProductImagesRoutes = require('./routes/adminProductImages');
const adminStockAdjustmentsRoutes = require('./routes/adminStockAdjustments');
const adminReturnsRoutes = require('./routes/adminReturns');
const adminTaxClassesRoutes = require('./routes/adminTaxClasses');
const adminTaxRatesRoutes = require('./routes/adminTaxRates'); // New import
// Duplicate imports for adminOptionManagementRoutes and adminProductSpecificOptionsRoutes were removed by only keeping the first ones.
const reviewRoutes = require('./routes/reviews'); // Import review routes
const userRoutes = require('./routes/users'); // Import user profile routes
const orderRoutes = require('./routes/orders'); // Import order routes
const categoryRoutes = require('./routes/categories'); // Import category routes
const cartRoutes = require('./routes/cart'); // Import cart routes
const optionsRoutes = require('./routes/options'); // Import public options routes
const path = require('path'); // Import path module
const globalErrorHandler = require('./middleware/errorHandler'); // Import global error handler

const app = express();
const port = config.port; // Use port from config

// Commented out specific options for diagnostics
// const corsOptions = {
//   origin: 'http://localhost:3001',
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
//   credentials: true
// };
// app.use(cors(corsOptions));

app.use(cors()); // Enable CORS for all routes with defaults
app.use(express.json()); // Middleware to parse JSON bodies
app.use(helmet()); // Use Helmet for security headers

// Add pino-http request logger middleware
// This should be one of the first middleware
app.use(pinoHttp({
  logger: logger, // Use our existing pino instance
  serializers: { // Customize what to log for req and res
    req(req) {
      return {
        method: req.method,
        url: req.url,
        // headers: req.headers, // Can be too verbose, enable if needed
        remoteAddress: req.remoteAddress,
        params: req.params,
        query: req.query,
      };
    },
    res(res) {
      return {
        statusCode: res.statusCode,
        // headers: res.getHeaders(), // Can be too verbose
      };
    }
  },
  customLogLevel: function (req, res, err) {
    if (res.statusCode >= 400 && res.statusCode < 500) {
      return 'warn'
    } else if (res.statusCode >= 500 || err) {
      return 'error'
    } else if (res.statusCode >= 300 && res.statusCode < 400) {
      return 'silent' // Don't log redirects by default
    }
    return 'info'
  },
  // Define a custom message for successful requests
  customSuccessMessage: function (req, res) {
    if (res.statusCode === 404) {
      return `${req.method} ${req.url} ${res.statusCode} - Not Found`
    }
    return `${req.method} ${req.url} ${res.statusCode}`
  },
    // Define a custom message for error requests
  customErrorMessage: function (req, res, err) {
    return `${req.method} ${req.url} ${res.statusCode} - Error: ${err.message}`
  }
}));

// Serve static files from the 'uploads' directory - REMOVING THIS as S3 is now primary for product images
// If other uploads still use this, it might need to stay or be refined. Assuming only product images used it.
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// API Health Check or Info
app.get('/api', (req, res) => {
  res.send('Hello World! Welcome to the E-commerce API. All routes are under /api.');
});

// --- Authentication Routes ---
app.use('/api/auth', authRoutes); // Use the new dedicated auth router

// --- Product Routes ---
app.use('/api/products', productRoutes); // Mount product routes under /api/products

// --- Admin Routes ---
// Mount user management specific admin routes
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/categories', adminCategoryRoutes); // Mount admin category routes
app.use('/api/admin/stats', adminStatsRoutes); // Mount admin statistics routes
app.use('/api/admin/options', adminOptionManagementRoutes.optionsRouter); // Mount global options API
app.use('/api/admin/option-values', adminOptionManagementRoutes.optionValuesRouter); // Mount global option values API
console.log('>>> Mounting /api/admin/assigned-options NOW');
app.use('/api/admin/assigned-options', adminAssignedOptionsRouter); // Moved earlier
console.log('>>> MOUNTED /api/admin/assigned-options');
app.use('/api/admin', adminProductSpecificOptionsRoutes); // Mount product-specific option config routes
app.use('/api/admin', adminProductVariantsRoutes); // Mount product variants routes (e.g., /products/:productId/variants and /variants/:variantId)
app.use('/api/admin/reviews', adminReviewRoutes); // Mount admin review management routes
// Consider if adminVariantDetailRoutes is still needed or if its functionality is covered by adminProductVariantsRoutes. For now, keeping it if it serves other specific details.
// app.use('/api/admin', adminVariantDetailRoutes); // If it has distinct routes like /variant-details/:id for other purposes.

// --- Public and User-Specific Review Routes ---
// (e.g. POST /api/products/:productId/reviews, GET /api/products/:productId/reviews)
// These routes are defined in reviews.js starting with /products/:productId/reviews
// So, if reviewsRouter is mounted at /api, the paths will be correct.
app.use('/api', reviewRoutes);


// Mount order management specific admin routes
// Note: adminOrderRoutes might contain routes starting with just '/orders', '/products' etc.
// Ensure its routes are specific enough or consider prefixing them within adminOrders.js if they are too generic.
// For now, assuming adminOrderRoutes are like /api/admin/orders etc.
// If adminOrderRoutes contains a root '/' GET or similar, it might conflict if not ordered carefully
// or if paths are not specific enough.
// The current setup seems to imply adminOrderRoutes paths start like /orders, /products etc.
// which are then prefixed by /api/admin by app.use('/api/admin', adminOrderRoutes);
app.use('/api/admin', adminOrderRoutes); // Routes like /orders, /orders/:id/status
app.use('/api/admin/products', adminProductRoutes); // Existing: general product admin like stock updates
app.use('/api/admin/products', adminProductImagesRoutes); // Mounts /:productId/images and /images/:imageId under /api/admin/products
app.use('/api/admin/discounts', adminDiscountRoutes);
app.use('/api/admin/suppliers', adminSupplierRoutes);
app.use('/api/admin/purchase-orders', adminPurchaseOrderRoutes);
app.use('/api/admin/stock-movement-logs', adminStockMovementLogsRoutes);
app.use('/api/admin/inventory-batches', adminInventoryBatchesRoutes); // Added this line
app.use('/api/admin/reports', adminReportRoutes);
app.use('/api/admin/audit-logs', adminAuditLogsRouter);
// adminAssignedOptionsRouter was here, moved earlier
app.use('/api/admin/stock-adjustments', adminStockAdjustmentsRoutes);
app.use('/api/admin/returns', adminReturnsRoutes);
app.use('/api/admin/tax-classes', adminTaxClassesRoutes);
app.use('/api/admin/tax-rates', adminTaxRatesRoutes); // New mount


// --- User Profile Routes ---
app.use('/api/users', userRoutes); // Mount user profile routes under /api/users

// --- Public Category Routes ---
app.use('/api/categories', categoryRoutes);

// --- Public Cart Routes (e.g. for discount validation) ---
app.use('/api/cart', cartRoutes);

// --- Public Order Routes (e.g., for user to create their own order) ---
app.use('/api/orders', orderRoutes);

// --- Public Options Routes (e.g., for product filters) ---
app.use('/api/options', optionsRoutes);

// --- Other Public Utility Routes (e.g., delivery confirmation) ---
const publicUtilityRoutes = require('./routes/public');
app.use('/api/public', publicUtilityRoutes);

// --- Admin RBAC Management Routes ---
const adminPermissionsRoutes = require('./routes/adminPermissions');
const adminRolesRoutes = require('./routes/adminRoles');
app.use('/api/admin/permissions', adminPermissionsRoutes);
app.use('/api/admin/roles', adminRolesRoutes);


// Ensure DB connection is attempted and tables are created when server starts
// The db.js file already tries to connect and create tables upon import.
// If db.pool is not undefined, we can assume it's trying to connect.
if (db.pool) {
  logger.info('Database module loaded, connection and table creation initiated.');
}

// Global Error Handling Middleware - MUST BE LAST
app.use(globalErrorHandler);

app.listen(port, () => {
  logger.info(`Server listening at http://localhost:${port} in ${config.nodeEnv} mode`);
});
