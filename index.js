const express = require('express');
const cors = require('cors'); // Import CORS
const authModule = require('./auth'); // Renamed to avoid conflict with authRouter
const db = require('./db'); // Import the db module to ensure tables are created
const productRoutes = require('./routes/products'); // Import product routes
const adminUserRoutes = require('./routes/adminUsers'); // Import admin user routes
const adminOrderRoutes = require('./routes/adminOrders'); // Import admin order routes
const orderRoutes = require('./routes/orders'); // Import order routes
const path = require('path'); // Import path module

const app = express();
const port = 3000;

app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Middleware to parse JSON bodies

// Serve static files from the 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// API Health Check or Info
app.get('/api', (req, res) => {
  res.send('Hello World! Welcome to the E-commerce API. All routes are under /api.');
});

// --- Authentication Routes ---
const authRouter = express.Router();

// Register
authRouter.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }
  const result = await authModule.registerUser(email, password);
  if (result.success) {
    // Exclude password from the response if user object is sent
    // Ensure result.user is defined before destructuring
    const userResponse = result.user ? (({ password, ...rest }) => rest)(result.user) : {}; // result.user already excludes password due to auth.js change
    res.status(201).json({ message: 'User registered successfully.', user: userResponse });
  } else {
    res.status(400).json({ message: result.message });
  }
});

// Login
authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }
  const result = await authModule.loginUser(email, password);
  if (result.success) {
    res.status(200).json({ message: 'Login successful.', token: result.token });
  } else {
    res.status(401).json({ message: result.message });
  }
});

// Request Password Reset
authRouter.post('/request-password-reset', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }
  const result = await authModule.requestPasswordReset(email);
  res.status(200).json({ message: result.message });
});

// Reset Password
authRouter.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Token and new password are required.' });
  }
  const result = await authModule.resetPassword(token, newPassword);
  res.status(200).json({ message: result.message });
});

app.use('/api/auth', authRouter); // Mount auth router under /api/auth

// --- Product Routes ---
app.use('/api/products', productRoutes); // Mount product routes under /api/products

// --- Admin Routes ---
// Mount user management specific admin routes
app.use('/api/admin/users', adminUserRoutes);
// Mount order management specific admin routes
app.use('/api/admin', adminOrderRoutes); // This will make routes like /api/admin/orders available


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
