require('dotenv').config();
const express = require('express');
const cors = require('cors'); // Import CORS
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
const adminReportRoutes = require('./routes/adminReports'); // Import admin report routes
const adminProductSpecificOptionsRoutes = require('./routes/adminProductSpecificOptions'); // Import product-specific option routes
const adminOptionManagementRoutes = require('./routes/adminOptionManagement'); // Import general option/value management routes
const adminProductVariantsRoutes = require('./routes/adminProductVariants.js'); // For product-scoped variant actions
const adminVariantDetailRoutes = require('./routes/adminVariantDetails.js');   // For variant-specific GET/PUT/DELETE by variant ID
const orderRoutes = require('./routes/orders'); // Import order routes
const categoryRoutes = require('./routes/categories'); // Import category routes
const cartRoutes = require('./routes/cart'); // Import cart routes
const path = require('path'); // Import path module

const app = express();
const port = 3000;

app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Middleware to parse JSON bodies

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
// Mount order management specific admin routes
app.use('/api/admin', adminOrderRoutes); // This will make routes like /api/admin/orders available

// --- Public Category Routes ---
app.use('/api/categories', categoryRoutes);

// --- Public Cart Routes (e.g. for discount validation) ---
app.use('/api/cart', cartRoutes);

// --- Public Order Routes (e.g., for user to create their own order) ---
app.use('/api/orders', orderRoutes);


// Ensure DB connection is attempted and tables are created when server starts
// The db.js file already tries to connect and create tables upon import.
// If db.pool is not undefined, we can assume it's trying to connect.
if (db.pool) {
  console.log('Database module loaded, connection and table creation initiated.');
}


app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
